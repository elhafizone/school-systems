import Link from 'next/link'
import { AddContent } from '@/components/add-content'
import { StudentTimeline } from '@/components/student-timeline'
import { StudentSummary } from '@/components/student-summary'
import { Pagination } from '@/components/pagination'
import { requireRole } from '@/lib/auth/session'
import { requireAuthorizedStudent } from '@/lib/permissions'
import { listStudentTimeline } from '@/lib/data/queries'

/**
 * A student as their teacher sees them: identity at the top, the add-content
 * form immediately under it, then the timeline. The form sits above the
 * timeline deliberately — documenting is the reason a teacher opens this page,
 * so it should never be below a scroll of history.
 */
export default async function TeacherStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const session = await requireRole('teacher')
  const { id } = await params
  const { page } = await searchParams

  const student = await requireAuthorizedStudent(id)
  const timeline = await listStudentTimeline(student.id, Number(page) || 1)

  return (
    <>
      {student.class_id && (
        <Link
          href={`/teacher/classes/${student.class_id}`}
          className="mb-4 inline-block text-sm text-brand-700 hover:underline"
        >
          ← Back to {student.classes?.name ?? 'class'}
        </Link>
      )}

      <StudentSummary student={student} />

      <div className="mt-6">
        <AddContent studentId={student.id} studentName={student.full_name.split(' ')[0]} />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-ink-900">Timeline</h2>

      <StudentTimeline
        items={timeline.rows}
        canDelete={(item) => item.created_by === session.userId}
        emptyMessage="Add a photo, a video or a note to start this student's timeline."
      />

      <Pagination
        page={timeline.page}
        pageCount={timeline.pageCount}
        basePath={`/teacher/students/${student.id}`}
      />
    </>
  )
}
