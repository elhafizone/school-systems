import Link from 'next/link'
import { AddContent } from '@/components/add-content'
import { StudentSummary } from '@/components/student-summary'
import { StudentTimeline } from '@/components/student-timeline'
import { Pagination } from '@/components/pagination'
import { ToggleActive } from '@/components/toggle-active'
import { ButtonLink } from '@/components/ui'
import { requireAdmin } from '@/lib/auth/session'
import { requireAuthorizedStudent } from '@/lib/permissions'
import { listGuardians, listStudentTimeline } from '@/lib/data/queries'

/**
 * The full record. This is the only view that shows guardian details, and the
 * only one whose author can remove any entry rather than just their own.
 */
export default async function AdminStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const { page } = await searchParams

  const student = await requireAuthorizedStudent(id)
  const [guardians, timeline] = await Promise.all([
    listGuardians(student.id),
    listStudentTimeline(student.id, Number(page) || 1),
  ])

  return (
    <>
      <Link
        href="/admin/students"
        className="mb-4 inline-block text-sm text-brand-700 hover:underline"
      >
        ← All students
      </Link>

      <StudentSummary student={student} guardians={guardians} />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ButtonLink href={`/admin/students/${student.id}/edit`} variant="secondary" size="sm">
          Edit details
        </ButtonLink>
        <ToggleActive
          id={student.id}
          kind="student"
          isActive={student.is_active}
          name={student.full_name}
        />
      </div>

      <div className="mt-6">
        <AddContent studentId={student.id} studentName={student.full_name.split(' ')[0]} />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-ink-900">Timeline</h2>

      <StudentTimeline items={timeline.rows} canDelete={() => true} />

      <Pagination
        page={timeline.page}
        pageCount={timeline.pageCount}
        basePath={`/admin/students/${student.id}`}
      />
    </>
  )
}
