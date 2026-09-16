import { z } from 'zod'

/**
 * Every schema here is applied on the server. Client-side checks exist only to
 * give faster feedback and are never the thing that decides an outcome.
 */

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`)

export const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

export const uuidSchema = z.uuid('Not a valid identifier.')

/** Matches the DB check constraint: letters, digits, dash, underscore. */
export const studentCodeSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9_-]{3,32}$/,
    'Student code must be 3-32 characters using letters, numbers, - or _.',
  )

export const studentSchema = z.object({
  student_code: studentCodeSchema,
  full_name: trimmed(2, 120, 'Full name'),
  // The DB constraint can only carry immutable bounds, so the "not in the
  // future" rule is enforced here.
  date_of_birth: z
    .union([z.iso.date(), z.literal('')])
    .optional()
    .transform((v) => (v ? v : null))
    .refine(
      (v) => v === null || new Date(v) <= new Date(),
      'Date of birth cannot be in the future.',
    )
    .refine(
      (v) => v === null || new Date(v) >= new Date('1990-01-01'),
      'Date of birth looks too far in the past.',
    ),
  gender: z
    .union([z.enum(['male', 'female']), z.literal('')])
    .optional()
    .transform((v) => (v ? v : null)),
  class_id: z
    .union([z.uuid(), z.literal('')])
    .optional()
    .transform((v) => (v ? v : null)),
})

export const classSchema = z.object({
  name: trimmed(1, 80, 'Class name'),
  grade: trimmed(1, 40, 'Grade'),
  academic_year: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, 'Academic year must look like 2026-2027.')
    .refine((v) => {
      const [start, end] = v.split('-').map(Number)
      return end === start + 1
    }, 'Academic year must span consecutive years, e.g. 2026-2027.'),
})

/** Admin creating a teacher or parent account. */
export const staffAccountSchema = z.object({
  email: z.email('Enter a valid email address.'),
  full_name: trimmed(2, 120, 'Full name'),
  phone: z
    .union([trimmed(5, 30, 'Phone'), z.literal('')])
    .optional()
    .transform((v) => (v ? v : null)),
  role: z.enum(['teacher', 'parent']),
  password: z
    .string()
    .min(10, 'Temporary password must be at least 10 characters.')
    .max(72, 'Password must be at most 72 characters.'),
})

export const noteSchema = z.object({
  student_id: uuidSchema,
  title: z
    .union([trimmed(1, 160, 'Title'), z.literal('')])
    .optional()
    .transform((v) => (v ? v : null)),
  description: trimmed(1, 4000, 'Note'),
})

/** Metadata recorded after a media object lands in storage. */
export const mediaRecordSchema = z.object({
  student_id: uuidSchema,
  content_type: z.enum(['image', 'video']),
  storage_path: z
    .string()
    .regex(
      /^students\/[0-9a-f-]{36}\/(images|videos)\/[A-Za-z0-9_-]+\.[A-Za-z0-9]{2,5}$/,
      'Malformed storage path.',
    ),
  mime_type: z.string().min(3).max(100),
  file_size: z.number().int().positive(),
  title: z
    .union([trimmed(1, 160, 'Title'), z.literal('')])
    .optional()
    .transform((v) => (v ? v : null)),
  description: z
    .union([trimmed(1, 4000, 'Description'), z.literal('')])
    .optional()
    .transform((v) => (v ? v : null)),
})

export const parentLinkSchema = z.object({
  parent_id: uuidSchema,
  student_id: uuidSchema,
  relationship: trimmed(2, 40, 'Relationship'),
})

export const teacherAssignmentSchema = z.object({
  teacher_id: uuidSchema,
  class_id: uuidSchema,
})

/** Query string for the student list and the admin content browser. */
export const contentFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  class_id: z.union([z.uuid(), z.literal('')]).optional(),
  teacher_id: z.union([z.uuid(), z.literal('')]).optional(),
  student_id: z.union([z.uuid(), z.literal('')]).optional(),
  type: z.union([z.enum(['image', 'video', 'note']), z.literal('')]).optional(),
  from: z.union([z.iso.date(), z.literal('')]).optional(),
  to: z.union([z.iso.date(), z.literal('')]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

export type StudentInput = z.infer<typeof studentSchema>
export type ClassInput = z.infer<typeof classSchema>
export type StaffAccountInput = z.infer<typeof staffAccountSchema>
export type ContentFilter = z.infer<typeof contentFilterSchema>
