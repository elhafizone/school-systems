import Link from 'next/link'
import type { Metadata } from 'next'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { LinkParentForm, StaffAccountForm } from '@/components/admin-forms'
import { RemoveLink } from '@/components/remove-link'
import { ToggleActive } from '@/components/toggle-active'
import { requireAdmin } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { listProfiles, listStudents } from '@/lib/data/queries'
import type { Student } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Parents' }

/**
 * Parent accounts and, under each, the children they can see.
 *
 * Linking is the single most security-sensitive action an administrator takes
 * here — a link is exactly what grants a person sight of a child's photos — so
 * each existing link is listed explicitly and can be removed in one step.
 */
export default async function AdminParentsPage() {
  await requireAdmin()

  const [parents, allStudents] = await Promise.all([
    listProfiles('parent'),
    listStudents({ page: 1, includeInactive: false }),
  ])

  const supabase = await createClient()
  const { data: links } = await supabase
    .from('parent_students')
    .select('id, parent_id, relationship, students(id, full_name, student_code)')

  const linksByParent = new Map<
    string,
    Array<{ id: string; relationship: string; student: Pick<Student, 'id' | 'full_name'> | null }>
  >()

  for (const row of links ?? []) {
    const r = row as unknown as {
      id: string
      parent_id: string
      relationship: string
      students: Pick<Student, 'id' | 'full_name'> | null
    }
    const list = linksByParent.get(r.parent_id) ?? []
    list.push({ id: r.id, relationship: r.relationship, student: r.students })
    linksByParent.set(r.parent_id, list)
  }

  return (
    <>
      <PageHeader title="Parents" description="Parent accounts and the children linked to them." />

      <div className="mb-6">
        <StaffAccountForm role="parent" />
      </div>

      {parents.length === 0 ? (
        <EmptyState title="No parents yet" description="Create the first parent account above." />
      ) : (
        <ul className="space-y-3">
          {parents.map((parent) => {
            const childLinks = linksByParent.get(parent.id) ?? []
            const linkedIds = new Set(childLinks.map((l) => l.student?.id).filter(Boolean))
            const available = allStudents.rows.filter((s) => !linkedIds.has(s.id))

            return (
              <li key={parent.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink-900">{parent.full_name}</span>
                        {!parent.is_active && <Badge tone="warning">Deactivated</Badge>}
                      </div>
                      {parent.phone && <p className="text-sm text-ink-500">{parent.phone}</p>}
                    </div>

                    <ToggleActive
                      id={parent.id}
                      kind="profile"
                      isActive={parent.is_active}
                      name={parent.full_name}
                    />
                  </div>

                  <div className="mt-3 border-t border-ink-100 pt-3">
                    {childLinks.length === 0 ? (
                      <p className="text-sm text-ink-500">
                        No children linked. This account can see nothing until a child is linked.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {childLinks.map((link) => (
                          <li key={link.id} className="flex items-center gap-2 text-sm">
                            {link.student ? (
                              <Link
                                href={`/admin/students/${link.student.id}`}
                                className="font-medium text-ink-900 hover:underline"
                              >
                                {link.student.full_name}
                              </Link>
                            ) : (
                              <span className="text-ink-500">Unknown student</span>
                            )}
                            <span className="text-ink-500">({link.relationship})</span>
                            <span className="ml-auto">
                              <RemoveLink
                                id={link.id}
                                kind="parent-link"
                                description={`the link to ${link.student?.full_name ?? 'this student'}`}
                              />
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {available.length > 0 && (
                      <div className="mt-3">
                        <LinkParentForm parentId={parent.id} students={available} />
                      </div>
                    )}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
