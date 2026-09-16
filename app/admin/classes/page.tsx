import Link from 'next/link'
import type { Metadata } from 'next'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { ClassForm } from '@/components/admin-forms'
import { listClasses } from '@/lib/data/queries'

export const metadata: Metadata = { title: 'Classes' }

export default async function AdminClassesPage() {
  const classes = await listClasses(true)

  return (
    <>
      <PageHeader title="Classes" description="Classes, and the teachers assigned to them." />

      <div className="mb-6">
        <ClassForm />
      </div>

      {classes.length === 0 ? (
        <EmptyState
          title="No classes yet"
          description="Add a class above, then assign teachers and students to it."
        />
      ) : (
        <Card>
          <ul className="divide-y divide-ink-100">
            {classes.map((schoolClass) => (
              <li key={schoolClass.id}>
                <Link
                  href={`/admin/classes/${schoolClass.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink-900">{schoolClass.name}</span>
                    <span className="block text-sm text-ink-500">
                      {schoolClass.grade} · {schoolClass.academic_year}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-ink-300">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  )
}
