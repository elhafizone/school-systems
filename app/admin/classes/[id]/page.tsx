import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { AssignTeacherForm } from '@/components/admin-forms'
import { RemoveLink } from '@/components/remove-link'
import { StudentList } from '@/components/student-list'
import { requireAdmin } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { getClass, listProfiles, listStudentsInClass } from '@/lib/data/queries'
import { isUuid } from '@/lib/permissions'
import type { Profile } from '@/lib/types/database'

export default async function AdminClassPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  if (!isUuid(id)) notFound()

  const schoolClass = await getClass(id)
  if (!schoolClass) notFound()

  const supabase = await createClient()
  const [{ data: assignments }, students, teachers] = await Promise.all([
    supabase
      .from('teacher_classes')
      .select('id, profiles!teacher_classes_teacher_id_fkey(id, full_name, is_active)')
      .eq('class_id', id),
    listStudentsInClass(id),
    listProfiles('teacher'),
  ])

  const assigned = (assignments ?? []).map((row) => {
    const r = row as unknown as { id: string; profiles: Pick<Profile, 'id' | 'full_name' | 'is_active'> | null }
    return { assignmentId: r.id, teacher: r.profiles }
  })

  const assignedIds = new Set(assigned.map((a) => a.teacher?.id).filter(Boolean))
  const available = teachers.filter((t) => t.is_active && !assignedIds.has(t.id))

  return (
    <>
      <Link
        href="/admin/classes"
        className="mb-4 inline-block text-sm text-brand-700 hover:underline"
      >
        ← All classes
      </Link>

      <PageHeader
        title={schoolClass.name}
        description={`${schoolClass.grade} · ${schoolClass.academic_year}`}
      />

      <section aria-labelledby="teachers-heading" className="mb-8">
        <h2 id="teachers-heading" className="mb-3 text-lg font-semibold text-ink-900">
          Teachers
        </h2>

        {assigned.length > 0 && (
          <Card className="mb-4">
            <ul className="divide-y divide-ink-100">
              {assigned.map(({ assignmentId, teacher }) => (
                <li key={assignmentId} className="flex items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1 truncate font-medium text-ink-900">
                    {teacher?.full_name ?? 'Unknown teacher'}
                  </span>
                  <RemoveLink
                    id={assignmentId}
                    kind="assignment"
                    description={`${teacher?.full_name ?? 'this teacher'} from ${schoolClass.name}`}
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}

        {available.length > 0 ? (
          <Card className="p-4">
            <AssignTeacherForm classId={id} teachers={available} />
          </Card>
        ) : (
          assigned.length === 0 && (
            <EmptyState
              title="No teachers available"
              description="Create a teacher account first, then assign them here."
            />
          )
        )}
      </section>

      <section aria-labelledby="students-heading">
        <h2 id="students-heading" className="mb-3 text-lg font-semibold text-ink-900">
          Students ({students.length})
        </h2>
        <StudentList
          students={students}
          hrefBase="/admin/students"
          emptyTitle="No students in this class"
          emptyDescription="Assign a student to this class from their own record."
        />
      </section>
    </>
  )
}
