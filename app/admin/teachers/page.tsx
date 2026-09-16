import Link from 'next/link'
import type { Metadata } from 'next'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { StaffAccountForm } from '@/components/admin-forms'
import { ToggleActive } from '@/components/toggle-active'
import { requireAdmin } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { listProfiles } from '@/lib/data/queries'
import type { SchoolClass } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Teachers' }

export default async function AdminTeachersPage() {
  await requireAdmin()

  const teachers = await listProfiles('teacher')
  const supabase = await createClient()

  // One query for every assignment, grouped in memory, rather than one query
  // per teacher.
  const { data: assignments } = await supabase
    .from('teacher_classes')
    .select('teacher_id, classes(id, name)')

  const classesByTeacher = new Map<string, Array<Pick<SchoolClass, 'id' | 'name'>>>()
  for (const row of assignments ?? []) {
    const r = row as unknown as { teacher_id: string; classes: Pick<SchoolClass, 'id' | 'name'> | null }
    if (!r.classes) continue
    const list = classesByTeacher.get(r.teacher_id) ?? []
    list.push(r.classes)
    classesByTeacher.set(r.teacher_id, list)
  }

  return (
    <>
      <PageHeader
        title="Teachers"
        description="Teacher accounts, and the classes each one can see."
      />

      <div className="mb-6">
        <StaffAccountForm role="teacher" />
      </div>

      {teachers.length === 0 ? (
        <EmptyState title="No teachers yet" description="Create the first teacher account above." />
      ) : (
        <Card>
          <ul className="divide-y divide-ink-100">
            {teachers.map((teacher) => {
              const classes = classesByTeacher.get(teacher.id) ?? []

              return (
                <li key={teacher.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink-900">{teacher.full_name}</span>
                      {!teacher.is_active && <Badge tone="warning">Deactivated</Badge>}
                    </div>

                    <p className="mt-0.5 text-sm text-ink-500">
                      {classes.length === 0 ? (
                        'No classes assigned'
                      ) : (
                        <>
                          {classes.map((schoolClass, index) => (
                            <span key={schoolClass.id}>
                              {index > 0 && ', '}
                              <Link
                                href={`/admin/classes/${schoolClass.id}`}
                                className="hover:underline"
                              >
                                {schoolClass.name}
                              </Link>
                            </span>
                          ))}
                        </>
                      )}
                    </p>
                  </div>

                  <ToggleActive
                    id={teacher.id}
                    kind="profile"
                    isActive={teacher.is_active}
                    name={teacher.full_name}
                  />
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </>
  )
}
