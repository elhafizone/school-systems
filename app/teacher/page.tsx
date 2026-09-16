import Link from 'next/link'
import type { Metadata } from 'next'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { requireRole } from '@/lib/auth/session'
import { listTeacherClasses } from '@/lib/data/queries'

export const metadata: Metadata = { title: 'My classes' }

export default async function TeacherHome() {
  const session = await requireRole('teacher')
  const classes = await listTeacherClasses(session.userId)

  return (
    <>
      <PageHeader
        title={`Hello, ${session.profile.full_name.split(' ')[0]}`}
        description="Choose a class to see its students."
      />

      {classes.length === 0 ? (
        <EmptyState
          title="No classes assigned yet"
          description="The school office assigns classes to teachers. Once a class is assigned it will appear here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((schoolClass) => (
            <li key={schoolClass.id}>
              <Card className="transition-colors hover:border-brand-600">
                <Link
                  href={`/teacher/classes/${schoolClass.id}`}
                  className="block p-4 focus-visible:outline-none"
                >
                  <p className="text-lg font-semibold text-ink-900">{schoolClass.name}</p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {schoolClass.grade} · {schoolClass.academic_year}
                  </p>
                  <p className="mt-3 text-sm font-medium text-brand-700">
                    {schoolClass.student_count}{' '}
                    {schoolClass.student_count === 1 ? 'student' : 'students'}
                  </p>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
