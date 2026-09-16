import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type {
  ContentWithAuthor,
  Profile,
  SchoolClass,
  StaffDirectoryEntry,
  Student,
  StudentContent,
  StudentWithClass,
  UserRole,
} from '@/lib/types/database'
import type { ContentFilter } from '@/lib/validation/schemas'

/**
 * Read queries.
 *
 * Every query runs through the session-bound client, so RLS scopes the result
 * to what the caller may see. The role-specific functions below add ordering,
 * paging and joins — they are not what enforces access, and they are written
 * so that a missing filter would return less, never more.
 */

export const PAGE_SIZE = 20

export interface Page<T> {
  rows: T[]
  total: number
  page: number
  pageCount: number
}

function range(page: number): [number, number] {
  const from = (page - 1) * PAGE_SIZE
  return [from, from + PAGE_SIZE - 1]
}

function toPage<T>(rows: T[] | null, count: number | null, page: number): Page<T> {
  const total = count ?? 0
  return {
    rows: rows ?? [],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  }
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

/**
 * Paged student list with optional name search and class filter.
 *
 * Filtering and paging both happen in Postgres. A teacher sees only their own
 * students here because RLS narrows the rows before the count is taken, so the
 * pagination total is already correct for them.
 */
export async function listStudents(filter: {
  q?: string
  class_id?: string
  page: number
  includeInactive?: boolean
}): Promise<Page<StudentWithClass>> {
  const supabase = await createClient()
  const [from, to] = range(filter.page)

  let query = supabase
    .from('students')
    .select('*, classes(id, name, grade, academic_year)', { count: 'exact' })

  if (!filter.includeInactive) query = query.eq('is_active', true)
  if (filter.class_id) query = query.eq('class_id', filter.class_id)
  if (filter.q) {
    // Backed by the trigram index on students.full_name.
    query = query.ilike('full_name', `%${filter.q}%`)
  }

  const { data, count } = await query.order('full_name').range(from, to)
  return toPage<StudentWithClass>(data as StudentWithClass[] | null, count, filter.page)
}

/** Students in one class. Returns empty for a class the caller cannot see. */
export async function listStudentsInClass(classId: string): Promise<Student[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('students')
    .select('*')
    .eq('class_id', classId)
    .eq('is_active', true)
    .order('full_name')
  return data ?? []
}

/** Children of the signed-in parent, resolved through parent_students. */
export async function listMyChildren(parentId: string): Promise<StudentWithClass[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('parent_students')
    .select('students(*, classes(id, name, grade, academic_year))')
    .eq('parent_id', parentId)

  return (data ?? [])
    .map((row) => (row as unknown as { students: StudentWithClass | null }).students)
    .filter((s): s is StudentWithClass => s !== null && s.is_active)
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/**
 * Attach author display names to a batch of content rows.
 *
 * Read from staff_directory rather than profiles: a parent is entitled to know
 * which teacher wrote a note, but not that teacher's phone number.
 */
async function withAuthors(rows: StudentContent[]): Promise<ContentWithAuthor[]> {
  if (rows.length === 0) return []

  const supabase = await createClient()
  const authorIds = [...new Set(rows.map((r) => r.created_by))]
  const { data: staff } = await supabase
    .from('staff_directory')
    .select('id, full_name')
    .in('id', authorIds)

  const byId = new Map((staff ?? []).map((s: Pick<StaffDirectoryEntry, 'id' | 'full_name'>) => [s.id, s]))
  return rows.map((row) => ({ ...row, author: byId.get(row.created_by) ?? null }))
}

/** One student's timeline, newest first. */
export async function listStudentTimeline(
  studentId: string,
  page = 1,
): Promise<Page<ContentWithAuthor>> {
  const supabase = await createClient()
  const [from, to] = range(page)

  const { data, count } = await supabase
    .from('student_content')
    .select('*', { count: 'exact' })
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .range(from, to)

  const rows = await withAuthors((data ?? []) as StudentContent[])
  return toPage(rows, count, page)
}

/** Admin content browser: filter across every student. */
export async function listAllContent(filter: ContentFilter): Promise<Page<ContentWithAuthor>> {
  const supabase = await createClient()
  const [from, to] = range(filter.page)

  let query = supabase.from('student_content').select('*', { count: 'exact' })

  if (filter.student_id) query = query.eq('student_id', filter.student_id)
  if (filter.teacher_id) query = query.eq('created_by', filter.teacher_id)
  if (filter.type) query = query.eq('content_type', filter.type)
  if (filter.from) query = query.gte('created_at', `${filter.from}T00:00:00Z`)
  // Inclusive of the whole end day, which is what a person picking a date means.
  if (filter.to) query = query.lte('created_at', `${filter.to}T23:59:59Z`)

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  const rows = await withAuthors((data ?? []) as StudentContent[])
  return toPage(rows, count, filter.page)
}

// ---------------------------------------------------------------------------
// Classes and people
// ---------------------------------------------------------------------------

export async function listClasses(includeInactive = false): Promise<SchoolClass[]> {
  const supabase = await createClient()
  let query = supabase.from('classes').select('*')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data } = await query.order('academic_year', { ascending: false }).order('name')
  return data ?? []
}

export async function getClass(classId: string): Promise<SchoolClass | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('classes')
    .select('*')
    .eq('id', classId)
    .maybeSingle<SchoolClass>()
  return data
}

/** Classes assigned to one teacher, with a live student count for each. */
export async function listTeacherClasses(
  teacherId: string,
): Promise<Array<SchoolClass & { student_count: number }>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('teacher_classes')
    .select('classes(*)')
    .eq('teacher_id', teacherId)

  const classes = (data ?? [])
    .map((row) => (row as unknown as { classes: SchoolClass | null }).classes)
    .filter((c): c is SchoolClass => c !== null && c.is_active)

  // One HEAD count per class. Fine at a primary school's scale (a handful of
  // classes per teacher); revisit if a teacher is ever assigned dozens.
  const counts = await Promise.all(
    classes.map(async (c) => {
      const { count } = await supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', c.id)
        .eq('is_active', true)
      return [c.id, count ?? 0] as const
    }),
  )
  const countById = new Map(counts)

  return classes
    .map((c) => ({ ...c, student_count: countById.get(c.id) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Admin-only: list users of one role. */
export async function listProfiles(role: UserRole): Promise<Profile[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', role)
    .order('full_name')
  return data ?? []
}

/** Admin-only: guardians linked to a student, with the relationship label. */
export async function listGuardians(
  studentId: string,
): Promise<Array<{ relationship: string; profile: Profile }>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('parent_students')
    .select('relationship, profiles!parent_students_parent_id_fkey(*)')
    .eq('student_id', studentId)

  return (data ?? [])
    .map((row) => {
      const r = row as unknown as { relationship: string; profiles: Profile | null }
      return r.profiles ? { relationship: r.relationship, profile: r.profiles } : null
    })
    .filter((r): r is { relationship: string; profile: Profile } => r !== null)
}

/** Class ids assigned to a teacher, used to scope admin-style views. */
export async function listAssignedClassIds(teacherId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('teacher_classes')
    .select('class_id')
    .eq('teacher_id', teacherId)
  return (data ?? []).map((r) => (r as { class_id: string }).class_id)
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface AdminStats {
  students: number
  teachers: number
  parents: number
  classes: number
  contentThisWeek: number
}

/**
 * Counts for the admin dashboard.
 *
 * `head: true` means Postgres returns the count without shipping any rows.
 * Only figures an administrator would actually act on are shown.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const supabase = await createClient()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const countOf = async (
    table: string,
    apply: (q: ReturnType<typeof buildCount>) => ReturnType<typeof buildCount>,
  ) => {
    const { count } = await apply(buildCount(table))
    return count ?? 0
  }

  function buildCount(table: string) {
    return supabase.from(table).select('id', { count: 'exact', head: true })
  }

  const [students, teachers, parents, classes, contentThisWeek] = await Promise.all([
    countOf('students', (q) => q.eq('is_active', true)),
    countOf('profiles', (q) => q.eq('role', 'teacher').eq('is_active', true)),
    countOf('profiles', (q) => q.eq('role', 'parent').eq('is_active', true)),
    countOf('classes', (q) => q.eq('is_active', true)),
    countOf('student_content', (q) => q.gte('created_at', weekAgo)),
  ])

  return { students, teachers, parents, classes, contentThisWeek }
}

/** Most recent content across the school, for the dashboard feed. */
export async function listRecentContent(limit = 8): Promise<
  Array<ContentWithAuthor & { student: Pick<Student, 'id' | 'full_name'> | null }>
> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('student_content')
    .select('*, students(id, full_name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  const rows = (data ?? []) as Array<
    StudentContent & { students: Pick<Student, 'id' | 'full_name'> | null }
  >
  const withAuthor = await withAuthors(rows)

  return withAuthor.map((row, i) => ({ ...row, student: rows[i]?.students ?? null }))
}
