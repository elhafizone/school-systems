import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui'
import { StudentForm } from '@/components/student-form'
import { listClasses } from '@/lib/data/queries'

export const metadata: Metadata = { title: 'Add student' }

export default async function NewStudentPage() {
  const classes = await listClasses()

  return (
    <>
      <PageHeader title="Add student" description="Create a new student record." />
      <StudentForm classes={classes} />
    </>
  )
}
