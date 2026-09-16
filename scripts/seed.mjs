#!/usr/bin/env node
/**
 * Development seed.
 *
 * Creates a small, entirely fictional school so the application can be
 * exercised end to end. Every name is invented, every address is on
 * example.com (reserved by IANA for documentation, so it can never reach a
 * real inbox), and every student code is prefixed DEMO.
 *
 * Never run this against a database holding real student records.
 *
 *   node scripts/seed.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  try {
    const text = readFileSync(resolve(root, '.env.local'), 'utf8')
    for (const line of text.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // Fall through to process.env, which is how CI would supply these.
  }
}

loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.')
  process.exit(1)
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Shared password for demo accounts only. Never use this pattern in production. */
const DEMO_PASSWORD = 'DemoPassw0rd!2026'

const PEOPLE = [
  { key: 'admin', email: 'admin@example.com', full_name: 'Dana Whitfield', role: 'admin' },
  { key: 'teacher1', email: 'teacher1@example.com', full_name: 'Marta Oyelaran', role: 'teacher' },
  { key: 'teacher2', email: 'teacher2@example.com', full_name: 'Samuel Ntanda', role: 'teacher' },
  { key: 'parent1', email: 'parent1@example.com', full_name: 'Rosa Delacroix', role: 'parent' },
  { key: 'parent2', email: 'parent2@example.com', full_name: 'Idris Fakhouri', role: 'parent' },
]

const CLASSES = [
  { key: 'willow', name: 'Willow', grade: 'Year 2', academic_year: '2026-2027' },
  { key: 'cedar', name: 'Cedar', grade: 'Year 3', academic_year: '2026-2027' },
  { key: 'rowan', name: 'Rowan', grade: 'Year 4', academic_year: '2026-2027' },
]

const STUDENTS = [
  { code: 'DEMO-001', name: 'Amara Delacroix', class: 'willow', dob: '2019-04-12', gender: 'female' },
  { code: 'DEMO-002', name: 'Bruno Delacroix', class: 'cedar', dob: '2018-09-03', gender: 'male' },
  { code: 'DEMO-003', name: 'Chiara Fakhouri', class: 'willow', dob: '2019-01-27', gender: 'female' },
  { code: 'DEMO-004', name: 'Dmitri Halvorsen', class: 'cedar', dob: '2018-06-15', gender: 'male' },
  { code: 'DEMO-005', name: 'Esi Boateng', class: 'rowan', dob: '2017-11-30', gender: 'female' },
  { code: 'DEMO-006', name: 'Farid Nakamura', class: 'rowan', dob: '2017-08-21', gender: 'male' },
]

async function upsertUser({ email, full_name, role }) {
  // createUser fails if the address already exists, so look first and reuse.
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = list?.users?.find((u) => u.email === email)

  let userId = existing?.id
  if (!userId) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    })
    if (error) throw new Error(`createUser ${email}: ${error.message}`)
    userId = data.user.id
  }

  const { error } = await db
    .from('profiles')
    .upsert({ id: userId, full_name, role, is_active: true }, { onConflict: 'id' })
  if (error) throw new Error(`profile ${email}: ${error.message}`)

  return userId
}

async function main() {
  console.log('Seeding demo data. This is fictional data for development only.\n')

  const ids = {}
  for (const person of PEOPLE) {
    ids[person.key] = await upsertUser(person)
    console.log(`  user     ${person.role.padEnd(8)} ${person.email}`)
  }

  const classIds = {}
  for (const c of CLASSES) {
    const { data, error } = await db
      .from('classes')
      .upsert(
        { name: c.name, grade: c.grade, academic_year: c.academic_year },
        { onConflict: 'name,academic_year' },
      )
      .select('id')
      .single()
    if (error) throw new Error(`class ${c.name}: ${error.message}`)
    classIds[c.key] = data.id
    console.log(`  class    ${c.name} (${c.grade})`)
  }

  const studentIds = {}
  for (const s of STUDENTS) {
    const { data, error } = await db
      .from('students')
      .upsert(
        {
          student_code: s.code,
          full_name: s.name,
          date_of_birth: s.dob,
          gender: s.gender,
          class_id: classIds[s.class],
        },
        { onConflict: 'student_code' },
      )
      .select('id')
      .single()
    if (error) throw new Error(`student ${s.code}: ${error.message}`)
    studentIds[s.code] = data.id
    console.log(`  student  ${s.code} ${s.name}`)
  }

  // Marta teaches Willow and Cedar; Samuel teaches Rowan only. This split is
  // what the authorization tests rely on to prove a teacher cannot reach a
  // class they are not assigned to.
  const assignments = [
    { teacher_id: ids.teacher1, class_id: classIds.willow },
    { teacher_id: ids.teacher1, class_id: classIds.cedar },
    { teacher_id: ids.teacher2, class_id: classIds.rowan },
  ]
  for (const a of assignments) {
    const { error } = await db
      .from('teacher_classes')
      .upsert(a, { onConflict: 'teacher_id,class_id' })
    if (error) throw new Error(`assignment: ${error.message}`)
  }
  console.log(`  assigned ${assignments.length} teacher-class links`)

  // Rosa parents DEMO-001 and DEMO-002; Idris parents DEMO-003 only.
  const links = [
    { parent_id: ids.parent1, student_id: studentIds['DEMO-001'], relationship: 'mother' },
    { parent_id: ids.parent1, student_id: studentIds['DEMO-002'], relationship: 'mother' },
    { parent_id: ids.parent2, student_id: studentIds['DEMO-003'], relationship: 'father' },
  ]
  for (const l of links) {
    const { error } = await db
      .from('parent_students')
      .upsert(l, { onConflict: 'parent_id,student_id' })
    if (error) throw new Error(`parent link: ${error.message}`)
  }
  console.log(`  linked   ${links.length} parent-student links`)

  const { count } = await db
    .from('student_content')
    .select('id', { count: 'exact', head: true })

  if ((count ?? 0) === 0) {
    const notes = [
      {
        student_id: studentIds['DEMO-001'],
        created_by: ids.teacher1,
        content_type: 'note',
        title: 'Settling in well',
        description: 'Amara joined the reading circle today and read a full page aloud.',
      },
      {
        student_id: studentIds['DEMO-002'],
        created_by: ids.teacher1,
        content_type: 'note',
        title: 'Maths progress',
        description: 'Bruno completed the number bonds worksheet without help.',
      },
      {
        student_id: studentIds['DEMO-005'],
        created_by: ids.teacher2,
        content_type: 'note',
        title: 'Science project',
        description: 'Esi presented her plant growth chart to the class.',
      },
    ]
    const { error } = await db.from('student_content').insert(notes)
    if (error) throw new Error(`notes: ${error.message}`)
    console.log(`  notes    ${notes.length} sample notes`)
  } else {
    console.log('  notes    skipped, content already present')
  }

  console.log(`\nDone. All demo accounts use the password: ${DEMO_PASSWORD}`)
  console.log('Change or remove these accounts before the school uses the system.')
}

main().catch((error) => {
  console.error('\nSeed failed:', error.message)
  process.exit(1)
})
