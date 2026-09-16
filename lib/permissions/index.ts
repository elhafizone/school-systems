import 'server-only'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Session } from '@/lib/auth/session'
import type { StudentWithClass } from '@/lib/types/database'

/**
 * Application-level authorization.
 *
 * These helpers are a second gate in front of RLS, not a replacement for it.
 * They read through the session-bound client, so an unauthorized row comes
 * back empty because the database refused it — the check and the enforcement
 * cannot drift apart.
 *
 * Unauthorized and non-existent deliberately collapse into the same result.
 * A parent who guesses another child's UUID gets the same 404 as one who
 * guesses a UUID that was never issued, so the URL reveals nothing.
 */

export async function findAuthorizedStudent(
  studentId: string,
): Promise<StudentWithClass | null> {
  if (!isUuid(studentId)) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('students')
    .select('*, classes(id, name, grade, academic_year)')
    .eq('id', studentId)
    .maybeSingle<StudentWithClass>()

  return data ?? null
}

/** Student the caller may view, or a 404 that leaks nothing. */
export async function requireAuthorizedStudent(
  studentId: string,
): Promise<StudentWithClass> {
  const student = await findAuthorizedStudent(studentId)
  if (!student) notFound()
  return student
}

/**
 * Whether the caller may attach content to this student.
 * Admins may document anyone; teachers only students in their assigned
 * classes; parents never.
 */
export async function canAddContent(
  session: Session,
  studentId: string,
): Promise<boolean> {
  if (session.profile.role === 'parent') return false
  if (session.profile.role === 'admin') return isUuid(studentId)
  return (await findAuthorizedStudent(studentId)) !== null
}

/** Whether the caller may remove a specific timeline entry. */
export function canDeleteContent(
  session: Session,
  content: { created_by: string },
): boolean {
  if (session.profile.role === 'admin') return true
  if (session.profile.role === 'teacher') return content.created_by === session.userId
  return false
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Cheap shape check before a query. Postgres raises on a malformed uuid rather
 * than returning empty, which would surface as a 500 on a hand-edited URL.
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}
