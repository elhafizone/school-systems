import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/ui'
import { StudentList } from '@/components/student-list'
import { requireRole } from '@/lib/auth/session'
import { getClass, listStudentsInClass } from '@/lib/data/queries'
import { isUuid } from '@/lib/permissions'

export default async function TeacherClassPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole('teacher')
  const { id } = await params

  if (!isUuid(id)) notFound()

  // RLS returns nothing for a class this teacher is not assigned to, so an
  // unassigned class id is indistinguishable from one that does not exist.
  const schoolClass = await getClass(id)
  if (!schoolClass) notFound()

  const students = await listStudentsInClass(id)

  return (
    <>
      <Link href="/teacher" className="mb-4 inline-block text-sm text-brand-700 hover:underline">
        ← All my classes
      </Link>

      <PageHeader
        title={schoolClass.name}
        description={`${schoolClass.grade} · ${schoolClass.academic_year}`}
      />

      <StudentList
        students={students}
        hrefBase="/teacher/students"
        emptyTitle="No students in this class"
        emptyDescription="The school office adds students to classes."
      />
    </>
  )
}
