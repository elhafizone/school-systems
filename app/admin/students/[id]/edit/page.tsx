import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui'
import { StudentForm } from '@/components/student-form'
import { listClasses } from '@/lib/data/queries'
import { findAuthorizedStudent } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Edit student' }

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [student, classes] = await Promise.all([findAuthorizedStudent(id), listClasses()])
  if (!student) notFound()

  return (
    <>
      <PageHeader title={`Edit ${student.full_name}`} />
      <StudentForm student={student} classes={classes} />
    </>
  )
}
