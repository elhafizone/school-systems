import Link from 'next/link'
import { Badge, Card, EmptyState, Initials } from '@/components/ui'
import type { Student, StudentWithClass } from '@/lib/types/database'

/**
 * Tappable list of students, shared by the teacher, parent and admin views.
 *
 * A list of rows rather than a table: it stays readable at 320px without
 * horizontal scrolling, and each row is a single large touch target.
 */
export function StudentList({
  students,
  hrefBase,
  showClass = false,
  emptyTitle = 'No students',
  emptyDescription,
}: {
  students: Array<Student | StudentWithClass>
  hrefBase: string
  showClass?: boolean
  emptyTitle?: string
  emptyDescription?: string
}) {
  if (students.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <Card>
      <ul className="divide-y divide-ink-100">
        {students.map((student) => {
          const className =
            showClass && 'classes' in student ? (student.classes?.name ?? null) : null

          return (
            <li key={student.id}>
              <Link
                href={`${hrefBase}/${student.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50"
              >
                <Initials name={student.full_name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink-900">
                    {student.full_name}
                  </span>
                  <span className="block truncate text-sm text-ink-500">
                    {student.student_code}
                    {className && ` · ${className}`}
                  </span>
                </span>
                {!student.is_active && <Badge tone="warning">Inactive</Badge>}
                <span aria-hidden="true" className="text-ink-300">
                  ›
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
