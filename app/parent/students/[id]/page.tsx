import Link from 'next/link'
import { StudentTimeline } from '@/components/student-timeline'
import { StudentSummary } from '@/components/student-summary'
import { Pagination } from '@/components/pagination'
import { requireRole } from '@/lib/auth/session'
import { requireAuthorizedStudent } from '@/lib/permissions'
import { listMyChildren, listStudentTimeline } from '@/lib/data/queries'

/**
 * A child as their parent sees them. Strictly read-only: no add form, and
 * `canDelete` is hard-wired to false. A parent reaching another family's
 * student id gets the ordinary 404 from requireAuthorizedStudent.
 */
export default async function ParentStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const session = await requireRole('parent')
  const { id } = await params
  const { page } = await searchParams

  const student = await requireAuthorizedStudent(id)
  const [timeline, siblings] = await Promise.all([
    listStudentTimeline(student.id, Number(page) || 1),
    listMyChildren(session.userId),
  ])

  return (
    <>
      {siblings.length > 1 && (
        <Link href="/parent" className="mb-4 inline-block text-sm text-brand-700 hover:underline">
          ← All my children
        </Link>
      )}

      <StudentSummary student={student} />

      <h2 className="mb-3 mt-8 text-lg font-semibold text-ink-900">Updates</h2>

      <StudentTimeline
        items={timeline.rows}
        canDelete={() => false}
        emptyMessage={`When staff add photos, videos or notes for ${student.full_name.split(' ')[0]}, they will appear here.`}
      />

      <Pagination
        page={timeline.page}
        pageCount={timeline.pageCount}
        basePath={`/parent/students/${student.id}`}
      />
    </>
  )
}
