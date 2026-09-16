'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireSession } from '@/lib/auth/session'
import { canAddContent, canDeleteContent, findAuthorizedStudent, isUuid } from '@/lib/permissions'
import { buildObjectPath, checkUpload, IMAGE_RULE, VIDEO_RULE } from '@/lib/storage/upload'
import { removeObject, statObject } from '@/lib/storage/media'
import { noteSchema } from '@/lib/validation/schemas'
import type { StudentContent } from '@/lib/types/database'

export interface ActionResult {
  ok: boolean
  error?: string
}

/**
 * Content mutations.
 *
 * Every action re-establishes who the caller is from the session cookie and
 * re-checks authorization server-side. Nothing here trusts an id, a path or a
 * size that arrived from the browser, and RLS refuses the write independently
 * if any of these checks were ever removed.
 */

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function addNoteAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession()

  const parsed = noteSchema.safeParse({
    student_id: formData.get('student_id'),
    title: formData.get('title'),
    description: formData.get('description'),
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  }

  const { student_id, title, description } = parsed.data

  if (!(await canAddContent(session, student_id))) {
    return { ok: false, error: 'You do not have access to this student.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('student_content').insert({
    student_id,
    created_by: session.userId,
    content_type: 'note',
    title,
    description,
  })

  if (error) {
    console.error('addNoteAction insert failed', { code: error.code })
    return { ok: false, error: 'The note could not be saved. Please try again.' }
  }

  revalidatePath(`/teacher/students/${student_id}`)
  revalidatePath(`/admin/students/${student_id}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export interface PrepareUploadResult {
  ok: boolean
  path?: string
  error?: string
}

/**
 * Authorize an upload and hand back the object path to write to.
 *
 * The server chooses the path; the browser never names the file. The returned
 * path is not a capability on its own — the storage policy re-derives the
 * student id from it and checks the caller again at write time.
 */
export async function prepareUploadAction(input: {
  studentId: string
  kind: 'image' | 'video'
  fileName: string
  fileType: string
  fileSize: number
}): Promise<PrepareUploadResult> {
  const session = await requireSession()

  if (!isUuid(input.studentId)) {
    return { ok: false, error: 'Unknown student.' }
  }

  if (!(await canAddContent(session, input.studentId))) {
    return { ok: false, error: 'You do not have access to this student.' }
  }

  const check = checkUpload(
    { name: input.fileName, type: input.fileType, size: input.fileSize },
    input.kind,
  )
  if (!check.ok) return { ok: false, error: check.error }

  const rule = input.kind === 'image' ? IMAGE_RULE : VIDEO_RULE
  return { ok: true, path: buildObjectPath(input.studentId, rule.folder, check.extension) }
}

/**
 * Record a media object that has landed in storage.
 *
 * Size and MIME type are read back from storage rather than accepted from the
 * caller, so the row always describes the bytes that were actually stored. If
 * the object is missing or unreadable, nothing is recorded.
 */
export async function recordMediaAction(input: {
  studentId: string
  storagePath: string
  kind: 'image' | 'video'
  title?: string | null
  description?: string | null
}): Promise<ActionResult> {
  const session = await requireSession()

  if (!(await canAddContent(session, input.studentId))) {
    return { ok: false, error: 'You do not have access to this student.' }
  }

  // The path must sit inside this student's own folder. Without this a
  // teacher could record an object belonging to a different student.
  const expectedPrefix = `students/${input.studentId}/`
  if (!input.storagePath.startsWith(expectedPrefix) || input.storagePath.includes('..')) {
    return { ok: false, error: 'That upload could not be verified.' }
  }

  const stat = await statObject(input.storagePath)
  if (!stat) {
    return { ok: false, error: 'The upload did not complete. Please try again.' }
  }

  // Re-run the allowlist against what storage reports, not what was claimed.
  const rule = input.kind === 'image' ? IMAGE_RULE : VIDEO_RULE
  if (!(stat.mimeType in rule.types) || stat.size > rule.maxBytes) {
    await removeObject(input.storagePath)
    return { ok: false, error: 'That file type or size is not allowed.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('student_content').insert({
    student_id: input.studentId,
    created_by: session.userId,
    content_type: input.kind,
    title: input.title?.trim() || null,
    description: input.description?.trim() || null,
    storage_path: input.storagePath,
    mime_type: stat.mimeType,
    file_size: stat.size,
  })

  if (error) {
    // Do not leave an orphaned object behind when the row fails to write.
    await removeObject(input.storagePath)
    console.error('recordMediaAction insert failed', { code: error.code })
    return { ok: false, error: 'The upload could not be saved. Please try again.' }
  }

  revalidatePath(`/teacher/students/${input.studentId}`)
  revalidatePath(`/admin/students/${input.studentId}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

export async function deleteContentAction(contentId: string): Promise<ActionResult> {
  const session = await requireSession()
  if (!isUuid(contentId)) return { ok: false, error: 'Unknown item.' }

  const supabase = await createClient()

  // RLS already limits this read to content the caller may see.
  const { data: content } = await supabase
    .from('student_content')
    .select('id, student_id, created_by, storage_path')
    .eq('id', contentId)
    .maybeSingle<Pick<StudentContent, 'id' | 'student_id' | 'created_by' | 'storage_path'>>()

  if (!content) return { ok: false, error: 'That item no longer exists.' }

  if (!canDeleteContent(session, content)) {
    return { ok: false, error: 'You can only remove items you added.' }
  }

  const { error } = await supabase.from('student_content').delete().eq('id', contentId)
  if (error) {
    console.error('deleteContentAction failed', { code: error.code })
    return { ok: false, error: 'That item could not be removed.' }
  }

  // Row first, then bytes: a failed object delete leaves an orphan, which is
  // recoverable, whereas the reverse would leave a row pointing at nothing.
  if (content.storage_path) await removeObject(content.storage_path)

  revalidatePath(`/teacher/students/${content.student_id}`)
  revalidatePath(`/admin/students/${content.student_id}`)
  return { ok: true }
}

/** Used by the client uploader to confirm the student before touching storage. */
export async function assertStudentAccessAction(studentId: string): Promise<boolean> {
  await requireSession()
  return (await findAuthorizedStudent(studentId)) !== null
}
