'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/session'
import { isUuid } from '@/lib/permissions'
import {
  classSchema,
  parentLinkSchema,
  staffAccountSchema,
  studentSchema,
  teacherAssignmentSchema,
} from '@/lib/validation/schemas'

export interface ActionResult {
  ok: boolean
  error?: string
}

/**
 * Administrative mutations.
 *
 * requireAdmin() is the first statement of every action, before any input is
 * read. RLS would refuse these writes anyway for a non-admin, so a mistake
 * here fails closed rather than open — the check exists to return a clean
 * error instead of a database refusal.
 */

const GENERIC_WRITE_ERROR = 'That change could not be saved. Please try again.'

/** Postgres surfaces a unique-constraint breach as 23505. */
function describeDbError(error: { code?: string; message?: string }, context: string): string {
  if (error.code === '23505') {
    if (context === 'student') return 'That student code is already in use.'
    if (context === 'class') return 'A class with that name already exists for this year.'
    return 'That record already exists.'
  }
  console.error(`admin action failed [${context}]`, { code: error.code })
  return GENERIC_WRITE_ERROR
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export async function saveStudentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin()

  const studentId = formData.get('id')
  const parsed = studentSchema.safeParse({
    student_code: formData.get('student_code'),
    full_name: formData.get('full_name'),
    date_of_birth: formData.get('date_of_birth'),
    gender: formData.get('gender'),
    class_id: formData.get('class_id'),
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  }

  const supabase = await createClient()

  if (typeof studentId === 'string' && studentId.length > 0) {
    if (!isUuid(studentId)) return { ok: false, error: 'Unknown student.' }

    const { error } = await supabase.from('students').update(parsed.data).eq('id', studentId)
    if (error) return { ok: false, error: describeDbError(error, 'student') }

    revalidatePath('/admin/students')
    revalidatePath(`/admin/students/${studentId}`)
    return { ok: true }
  }

  const { error } = await supabase.from('students').insert(parsed.data)
  if (error) return { ok: false, error: describeDbError(error, 'student') }

  revalidatePath('/admin/students')
  return { ok: true }
}

/**
 * Deactivate rather than delete.
 *
 * A student's timeline is a record the school may need to keep; removing the
 * row would cascade it away. Deactivating hides them from the working lists
 * while preserving history.
 */
export async function setStudentActiveAction(
  studentId: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requireAdmin()
  if (!isUuid(studentId)) return { ok: false, error: 'Unknown student.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('students')
    .update({ is_active: isActive })
    .eq('id', studentId)

  if (error) return { ok: false, error: describeDbError(error, 'student') }

  revalidatePath('/admin/students')
  revalidatePath(`/admin/students/${studentId}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export async function saveClassAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin()

  const classId = formData.get('id')
  const parsed = classSchema.safeParse({
    name: formData.get('name'),
    grade: formData.get('grade'),
    academic_year: formData.get('academic_year'),
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  }

  const supabase = await createClient()

  if (typeof classId === 'string' && classId.length > 0) {
    if (!isUuid(classId)) return { ok: false, error: 'Unknown class.' }
    const { error } = await supabase.from('classes').update(parsed.data).eq('id', classId)
    if (error) return { ok: false, error: describeDbError(error, 'class') }
  } else {
    const { error } = await supabase.from('classes').insert(parsed.data)
    if (error) return { ok: false, error: describeDbError(error, 'class') }
  }

  revalidatePath('/admin/classes')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Teacher and parent accounts
// ---------------------------------------------------------------------------

/**
 * Provision a teacher or parent account.
 *
 * This is one of only two places the service-role key is used: creating an
 * auth user is not something the signed-in admin's own token can do. The admin
 * check above runs first, and the role is constrained by the schema to
 * 'teacher' or 'parent', so this cannot mint another administrator.
 */
export async function createStaffAccountAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin()

  const parsed = staffAccountSchema.safeParse({
    email: formData.get('email'),
    full_name: formData.get('full_name'),
    phone: formData.get('phone'),
    role: formData.get('role'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  }

  const { email, full_name, phone, role, password } = parsed.data
  const admin = createAdminClient()

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !created.user) {
    if (authError?.message?.toLowerCase().includes('already')) {
      return { ok: false, error: 'An account with that email address already exists.' }
    }
    console.error('createStaffAccountAction: auth user creation failed')
    return { ok: false, error: 'The account could not be created.' }
  }

  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: created.user.id, full_name, role, phone })

  if (profileError) {
    // Roll the auth user back so a failed profile insert cannot strand an
    // account that can sign in but resolves to nothing.
    await admin.auth.admin.deleteUser(created.user.id)
    console.error('createStaffAccountAction: profile insert failed', { code: profileError.code })
    return { ok: false, error: 'The account could not be created.' }
  }

  revalidatePath(role === 'teacher' ? '/admin/teachers' : '/admin/parents')
  return { ok: true }
}

/** Deactivating a profile revokes access immediately: see auth_role(). */
export async function setProfileActiveAction(
  profileId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const session = await requireAdmin()
  if (!isUuid(profileId)) return { ok: false, error: 'Unknown user.' }

  // Without this an administrator could lock themselves out mid-session.
  if (profileId === session.userId) {
    return { ok: false, error: 'You cannot deactivate your own account.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', profileId)

  if (error) return { ok: false, error: describeDbError(error, 'profile') }

  revalidatePath('/admin/teachers')
  revalidatePath('/admin/parents')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

export async function assignTeacherAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin()

  const parsed = teacherAssignmentSchema.safeParse({
    teacher_id: formData.get('teacher_id'),
    class_id: formData.get('class_id'),
  })
  if (!parsed.success) return { ok: false, error: 'Choose both a teacher and a class.' }

  const supabase = await createClient()
  const { error } = await supabase.from('teacher_classes').insert(parsed.data)

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'That teacher is already assigned to this class.' }
    return { ok: false, error: describeDbError(error, 'assignment') }
  }

  revalidatePath('/admin/classes')
  revalidatePath(`/admin/classes/${parsed.data.class_id}`)
  return { ok: true }
}

export async function unassignTeacherAction(assignmentId: string): Promise<ActionResult> {
  await requireAdmin()
  if (!isUuid(assignmentId)) return { ok: false, error: 'Unknown assignment.' }

  const supabase = await createClient()
  const { error } = await supabase.from('teacher_classes').delete().eq('id', assignmentId)
  if (error) return { ok: false, error: describeDbError(error, 'assignment') }

  revalidatePath('/admin/classes')
  return { ok: true }
}

export async function linkParentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin()

  const parsed = parentLinkSchema.safeParse({
    parent_id: formData.get('parent_id'),
    student_id: formData.get('student_id'),
    relationship: formData.get('relationship') || 'guardian',
  })
  if (!parsed.success) return { ok: false, error: 'Choose both a parent and a student.' }

  const supabase = await createClient()
  const { error } = await supabase.from('parent_students').insert(parsed.data)

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'That parent is already linked to this student.' }
    return { ok: false, error: describeDbError(error, 'link') }
  }

  revalidatePath('/admin/parents')
  revalidatePath(`/admin/students/${parsed.data.student_id}`)
  return { ok: true }
}

export async function unlinkParentAction(linkId: string): Promise<ActionResult> {
  await requireAdmin()
  if (!isUuid(linkId)) return { ok: false, error: 'Unknown link.' }

  const supabase = await createClient()
  const { error } = await supabase.from('parent_students').delete().eq('id', linkId)
  if (error) return { ok: false, error: describeDbError(error, 'link') }

  revalidatePath('/admin/parents')
  return { ok: true }
}
