/**
 * Database shapes.
 *
 * Hand-maintained to mirror supabase/migrations. Regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > lib/types/database.ts
 */

export type UserRole = 'admin' | 'teacher' | 'parent'
export type ContentType = 'image' | 'video' | 'note'
export type StudentGender = 'male' | 'female'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SchoolClass {
  id: string
  name: string
  grade: string
  academic_year: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  student_code: string
  full_name: string
  date_of_birth: string | null
  gender: StudentGender | null
  class_id: string | null
  photo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TeacherClass {
  id: string
  teacher_id: string
  class_id: string
  created_at: string
}

export interface ParentStudent {
  id: string
  parent_id: string
  student_id: string
  relationship: string
  created_at: string
}

export interface StudentContent {
  id: string
  student_id: string
  created_by: string
  content_type: ContentType
  title: string | null
  description: string | null
  storage_path: string | null
  thumbnail_path: string | null
  file_size: number | null
  mime_type: string | null
  created_at: string
}

/** Active staff display names, for content attribution. No contact details. */
export interface StaffDirectoryEntry {
  id: string
  full_name: string
  role: UserRole
}

/** A student row joined with its class, as read by the list and profile pages. */
export type StudentWithClass = Student & {
  classes: Pick<SchoolClass, 'id' | 'name' | 'grade' | 'academic_year'> | null
}

/** A timeline entry joined with its author's display name. */
export type ContentWithAuthor = StudentContent & {
  author: Pick<StaffDirectoryEntry, 'id' | 'full_name'> | null
}
