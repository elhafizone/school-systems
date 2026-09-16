#!/usr/bin/env node
/**
 * Authorization and RLS test suite.
 *
 * These tests do the thing an attacker would do: sign in as a real low-
 * privilege user and ask the database directly for rows that belong to someone
 * else, using the same publishable key the browser holds. No application code
 * is involved, so nothing here can be satisfied by a UI that merely hides a
 * button — every assertion is about what Postgres itself will hand over.
 *
 * Requires: a seeded database (node scripts/seed.mjs).
 * Run with:  node tests/security.test.mjs
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

try {
  const text = readFileSync(resolve(root, '.env.local'), 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  /* env may come from the environment instead */
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !ANON) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  process.exit(1)
}

const PASSWORD = 'DemoPassw0rd!2026'

/** A client carrying only the publishable key, exactly like the browser. */
async function signIn(email) {
  const client = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`sign in ${email}: ${error.message}`)
  return client
}

const anonClient = () =>
  createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } })

/** Service-role client, used only to look up fixture ids the tests assert against. */
const admin = SERVICE
  ? createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
  : null

let fixtures

test('load fixtures', async () => {
  assert.ok(admin, 'SUPABASE_SERVICE_ROLE_KEY is required to resolve fixture ids')

  const { data: students } = await admin.from('students').select('id, student_code, class_id')
  const byCode = Object.fromEntries(students.map((s) => [s.student_code, s]))

  const { data: profiles } = await admin.from('profiles').select('id, full_name, role')

  fixtures = {
    // DEMO-001/002 belong to Rosa and to Marta's classes.
    amara: byCode['DEMO-001'],
    bruno: byCode['DEMO-002'],
    // DEMO-003 belongs to Idris, and to Marta's class.
    chiara: byCode['DEMO-003'],
    // DEMO-005 is in Rowan: Samuel's class, and nobody's child in this fixture.
    esi: byCode['DEMO-005'],
    profiles,
  }

  assert.ok(fixtures.amara && fixtures.esi, 'seed data missing - run: node scripts/seed.mjs')
})

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

test('authentication', async (t) => {
  await t.test('each role can sign in', async () => {
    for (const email of ['admin@example.com', 'teacher1@example.com', 'parent1@example.com']) {
      const client = await signIn(email)
      const { data } = await client.auth.getUser()
      assert.equal(data.user.email, email)
    }
  })

  await t.test('a wrong password is rejected', async () => {
    const client = anonClient()
    const { error } = await client.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'not-the-password',
    })
    assert.ok(error, 'a bad password must not authenticate')
  })

  await t.test('an unknown address is rejected', async () => {
    const client = anonClient()
    const { error } = await client.auth.signInWithPassword({
      email: 'nobody@example.com',
      password: PASSWORD,
    })
    assert.ok(error)
  })

  await t.test('sign out drops the session', async () => {
    const client = await signIn('parent1@example.com')
    await client.auth.signOut()
    const { data } = await client.auth.getUser()
    assert.equal(data.user, null)
  })
})

// ---------------------------------------------------------------------------
// Anonymous access
// ---------------------------------------------------------------------------

test('an anonymous caller reads nothing', async (t) => {
  const client = anonClient()

  for (const table of ['students', 'profiles', 'student_content', 'classes', 'parent_students']) {
    await t.test(`${table} is closed to anon`, async () => {
      const { data } = await client.from(table).select('*').limit(5)
      assert.deepEqual(data ?? [], [], `anon must not read ${table}`)
    })
  }
})

// ---------------------------------------------------------------------------
// Teacher authorization
// ---------------------------------------------------------------------------

test('teacher authorization', async (t) => {
  const marta = await signIn('teacher1@example.com')
  const samuel = await signIn('teacher2@example.com')

  await t.test('sees students in an assigned class', async () => {
    const { data } = await marta.from('students').select('id').eq('id', fixtures.amara.id)
    assert.equal(data.length, 1, 'Marta must see her own student')
  })

  await t.test('cannot read a student from an unassigned class by id', async () => {
    const { data } = await samuel.from('students').select('id').eq('id', fixtures.amara.id)
    assert.deepEqual(data, [], 'Samuel must not reach Marta’s student')
  })

  await t.test('an unfiltered select still returns only assigned students', async () => {
    const { data } = await samuel.from('students').select('id, student_code')
    const codes = data.map((s) => s.student_code)
    assert.ok(!codes.includes('DEMO-001'), 'leaked a student from another class')
    assert.ok(codes.includes('DEMO-005'), 'should see own class')
  })

  await t.test('cannot add content for an unauthorized student', async () => {
    const { data: me } = await samuel.auth.getUser()
    const { error } = await samuel.from('student_content').insert({
      student_id: fixtures.amara.id,
      created_by: me.user.id,
      content_type: 'note',
      description: 'unauthorized write attempt',
    })
    assert.ok(error, 'writing to another class’s student must be refused')
  })

  await t.test('cannot attribute content to another user', async () => {
    const otherTeacher = fixtures.profiles.find((p) => p.role === 'teacher')
    const { data: me } = await samuel.auth.getUser()
    const impersonated = fixtures.profiles.find(
      (p) => p.role === 'teacher' && p.id !== me.user.id,
    )

    const { error } = await samuel.from('student_content').insert({
      student_id: fixtures.esi.id,
      created_by: (impersonated ?? otherTeacher).id,
      content_type: 'note',
      description: 'spoofed author',
    })
    assert.ok(error, 'created_by must be pinned to the caller')
  })

  await t.test('cannot read another teacher’s class assignments', async () => {
    const { data } = await samuel.from('teacher_classes').select('teacher_id')
    const { data: me } = await samuel.auth.getUser()
    assert.ok(
      data.every((row) => row.teacher_id === me.user.id),
      'a teacher must only see their own assignments',
    )
  })

  await t.test('cannot grant themselves a class', async () => {
    const { data: me } = await samuel.auth.getUser()
    const { error } = await samuel
      .from('teacher_classes')
      .insert({ teacher_id: me.user.id, class_id: fixtures.amara.class_id })
    assert.ok(error, 'a teacher must not be able to self-assign a class')
  })

  await t.test('cannot see guardian relationships', async () => {
    const { data } = await samuel.from('parent_students').select('*')
    assert.deepEqual(data ?? [], [], 'teachers must not read parent links')
  })

  await t.test('cannot promote themselves to admin', async () => {
    const { data: me } = await samuel.auth.getUser()
    await samuel.from('profiles').update({ role: 'admin' }).eq('id', me.user.id)

    const { data: after } = await admin
      .from('profiles')
      .select('role')
      .eq('id', me.user.id)
      .single()
    assert.equal(after.role, 'teacher', 'role escalation must not persist')
  })

  await t.test('cannot reactivate themselves after deactivation', async () => {
    const { data: me } = await samuel.auth.getUser()
    await samuel.from('profiles').update({ is_active: false }).eq('id', me.user.id)

    const { data: after } = await admin
      .from('profiles')
      .select('is_active')
      .eq('id', me.user.id)
      .single()
    assert.equal(after.is_active, true, 'is_active must be admin-controlled')
  })
})

// ---------------------------------------------------------------------------
// Parent authorization — the headline requirement
// ---------------------------------------------------------------------------

test('parent authorization', async (t) => {
  const rosa = await signIn('parent1@example.com')
  const idris = await signIn('parent2@example.com')

  await t.test('sees their own children', async () => {
    const { data } = await rosa.from('students').select('student_code')
    const codes = data.map((s) => s.student_code).sort()
    assert.deepEqual(codes, ['DEMO-001', 'DEMO-002'], 'Rosa should see exactly her two children')
  })

  await t.test('guessing another child’s id returns nothing', async () => {
    const { data } = await rosa.from('students').select('id').eq('id', fixtures.chiara.id)
    assert.deepEqual(data, [], 'Rosa must not reach Idris’s child by id')
  })

  await t.test('cannot read another child’s content', async () => {
    const { data } = await rosa
      .from('student_content')
      .select('id')
      .eq('student_id', fixtures.chiara.id)
    assert.deepEqual(data, [], 'content of another family must be invisible')
  })

  await t.test('an unfiltered content read stays within their own children', async () => {
    const { data } = await rosa.from('student_content').select('student_id')
    const allowed = new Set([fixtures.amara.id, fixtures.bruno.id])
    assert.ok(
      data.every((row) => allowed.has(row.student_id)),
      'parent content query leaked another student',
    )
  })

  await t.test('cannot write content at all', async () => {
    const { data: me } = await rosa.auth.getUser()
    const { error } = await rosa.from('student_content').insert({
      student_id: fixtures.amara.id,
      created_by: me.user.id,
      content_type: 'note',
      description: 'parents are read-only',
    })
    assert.ok(error, 'a parent must never write content, even for their own child')
  })

  await t.test('cannot link themselves to another child', async () => {
    const { data: me } = await rosa.auth.getUser()
    const { error } = await rosa
      .from('parent_students')
      .insert({ parent_id: me.user.id, student_id: fixtures.esi.id, relationship: 'mother' })
    assert.ok(error, 'self-linking would be a total authorization bypass')
  })

  await t.test('cannot see other parents', async () => {
    const { data } = await idris.from('profiles').select('id')
    const { data: me } = await idris.auth.getUser()
    assert.ok(
      data.every((row) => row.id === me.user.id),
      'a parent must only ever read their own profile row',
    )
  })

  await t.test('cannot edit a student record', async () => {
    await rosa.from('students').update({ full_name: 'Renamed By Parent' }).eq('id', fixtures.amara.id)
    const { data: after } = await admin
      .from('students')
      .select('full_name')
      .eq('id', fixtures.amara.id)
      .single()
    assert.notEqual(after.full_name, 'Renamed By Parent', 'parents must not mutate student records')
  })
})

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

test('private media', async (t) => {
  const rosa = await signIn('parent1@example.com')

  await t.test('the bucket is not public', async () => {
    const { data } = await admin.storage.getBucket('student-media')
    assert.equal(data.public, false, 'student media must never be a public bucket')
  })

  await t.test('cannot sign a URL for another family’s student', async () => {
    const { data, error } = await rosa.storage
      .from('student-media')
      .createSignedUrl(`students/${fixtures.chiara.id}/images/anything.jpg`, 60)
    assert.ok(error || !data?.signedUrl, 'signing must be refused for an unauthorized path')
  })

  await t.test('cannot upload into another family’s folder', async () => {
    const { error } = await rosa.storage
      .from('student-media')
      .upload(`students/${fixtures.chiara.id}/images/evil.jpg`, new Blob(['x']), {
        contentType: 'image/jpeg',
      })
    assert.ok(error, 'a parent must not be able to write to storage')
  })

  await t.test('a disallowed mime type is rejected by the bucket', async () => {
    const marta = await signIn('teacher1@example.com')
    const { error } = await marta.storage
      .from('student-media')
      .upload(`students/${fixtures.amara.id}/images/payload.svg`, new Blob(['<svg/>']), {
        contentType: 'image/svg+xml',
      })
    assert.ok(error, 'the bucket allowlist must reject image/svg+xml')
  })
})

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

test('admin authorization', async (t) => {
  const dana = await signIn('admin@example.com')

  await t.test('sees every student', async () => {
    const { data } = await dana.from('students').select('student_code')
    assert.ok(data.length >= 6, 'an admin should see the whole roll')
  })

  await t.test('sees guardian links', async () => {
    const { data } = await dana.from('parent_students').select('id')
    assert.ok(data.length >= 3, 'an admin manages parent links')
  })

  await t.test('can edit a student', async () => {
    const { error } = await dana
      .from('students')
      .update({ full_name: fixtures.amara.full_name ?? 'Amara Delacroix' })
      .eq('id', fixtures.amara.id)
    assert.equal(error, null, 'an admin must be able to edit student records')
  })
})
