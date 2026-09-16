import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/ui'
import { StudentList } from '@/components/student-list'
import { requireRole } from '@/lib/auth/session'
import { listMyChildren } from '@/lib/data/queries'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'My children' }

export default async function ParentHome() {
  const session = await requireRole('parent')
  const children = await listMyChildren(session.userId)

  // A parent with one child has no list to choose from — send them straight in.
  if (children.length === 1 && children[0]) {
    redirect(`/parent/students/${children[0].id}`)
  }

  return (
    <>
      <PageHeader title="My children" description="Choose a child to see their updates." />

      {children.length === 0 ? (
        <EmptyState
          title="No children linked yet"
          description="The school office links each parent account to their children. Please contact the office if you expected to see someone here."
        />
      ) : (
        <StudentList students={children} hrefBase="/parent/students" showClass />
      )}
    </>
  )
}
