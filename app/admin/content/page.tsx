import Link from 'next/link'
import type { Metadata } from 'next'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { FilterBar } from '@/components/filter-bar'
import { Pagination } from '@/components/pagination'
import { requireAdmin } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { listAllContent, listProfiles, listStudents } from '@/lib/data/queries'
import { contentFilterSchema } from '@/lib/validation/schemas'
import type { Student } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Content' }

const TYPE_LABEL = { image: 'Photo', video: 'Video', note: 'Note' } as const

/**
 * Everything added across the school, filterable by student, teacher, type and
 * date. Rows link through to the student rather than rendering media inline:
 * the point of this screen is oversight, not browsing, and signing a URL for
 * every row of every page would be wasteful.
 */
export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()
  const raw = await searchParams

  const parsed = contentFilterSchema.safeParse(raw)
  const filter = parsed.success ? parsed.data : { page: 1 }

  const [content, teachers, students] = await Promise.all([
    listAllContent(filter),
    listProfiles('teacher'),
    listStudents({ page: 1, includeInactive: true }),
  ])

  // Resolve student names for the rows on this page in one query.
  const supabase = await createClient()
  const studentIds = [...new Set(content.rows.map((row) => row.student_id))]
  const { data: studentRows } = studentIds.length
    ? await supabase.from('students').select('id, full_name').in('id', studentIds)
    : { data: [] }

  const studentById = new Map(
    (studentRows ?? []).map((s: Pick<Student, 'id' | 'full_name'>) => [s.id, s]),
  )

  const hasFilters = Boolean(
    filter.student_id || filter.teacher_id || filter.type || filter.from || filter.to,
  )

  return (
    <>
      <PageHeader
        title="Content"
        description={`${content.total} ${content.total === 1 ? 'entry' : 'entries'}`}
      />

      <FilterBar
        action="/admin/content"
        hasFilters={hasFilters}
        fields={[
          {
            name: 'student_id',
            label: 'Student',
            type: 'select',
            value: filter.student_id,
            options: students.rows.map((s) => ({ value: s.id, label: s.full_name })),
          },
          {
            name: 'teacher_id',
            label: 'Added by',
            type: 'select',
            value: filter.teacher_id,
            options: teachers.map((t) => ({ value: t.id, label: t.full_name })),
          },
          {
            name: 'type',
            label: 'Type',
            type: 'select',
            value: filter.type,
            options: [
              { value: 'image', label: 'Photo' },
              { value: 'video', label: 'Video' },
              { value: 'note', label: 'Note' },
            ],
          },
          { name: 'from', label: 'From', type: 'date', value: filter.from },
          { name: 'to', label: 'To', type: 'date', value: filter.to },
        ]}
      />

      {content.rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No entries match those filters' : 'No content yet'}
          description={
            hasFilters ? 'Try widening the date range or clearing the filters.' : undefined
          }
        />
      ) : (
        <Card>
          <ul className="divide-y divide-ink-100">
            {content.rows.map((item) => {
              const student = studentById.get(item.student_id)

              return (
                <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <Badge tone={item.content_type === 'note' ? 'neutral' : 'brand'}>
                    {TYPE_LABEL[item.content_type]}
                  </Badge>

                  <Link
                    href={`/admin/students/${item.student_id}`}
                    className="font-medium text-ink-900 hover:underline"
                  >
                    {student?.full_name ?? 'Unknown student'}
                  </Link>

                  {item.title && <span className="truncate text-ink-700">{item.title}</span>}

                  <span className="text-sm text-ink-500">
                    by {item.author?.full_name ?? 'staff'}
                  </span>

                  <time
                    dateTime={item.created_at}
                    className="ml-auto text-sm tabular-nums text-ink-500"
                  >
                    {new Date(item.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </time>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <Pagination
        page={content.page}
        pageCount={content.pageCount}
        basePath="/admin/content"
        query={{
          student_id: filter.student_id,
          teacher_id: filter.teacher_id,
          type: filter.type,
          from: filter.from,
          to: filter.to,
        }}
      />
    </>
  )
}
