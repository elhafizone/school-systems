import type { Metadata } from 'next'
import { ButtonLink, PageHeader } from '@/components/ui'
import { FilterBar } from '@/components/filter-bar'
import { StudentList } from '@/components/student-list'
import { Pagination } from '@/components/pagination'
import { listClasses, listStudents } from '@/lib/data/queries'
import { contentFilterSchema } from '@/lib/validation/schemas'

export const metadata: Metadata = { title: 'Students' }

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams

  // Anything unparseable in the query string falls back to defaults rather
  // than erroring, so a hand-edited URL degrades to the unfiltered list.
  const parsed = contentFilterSchema.safeParse(raw)
  const filter = parsed.success ? parsed.data : { page: 1 }

  const [classes, students] = await Promise.all([
    listClasses(),
    listStudents({
      q: filter.q,
      class_id: filter.class_id,
      page: filter.page,
      includeInactive: true,
    }),
  ])

  const hasFilters = Boolean(filter.q || filter.class_id)

  return (
    <>
      <PageHeader
        title="Students"
        description={`${students.total} ${students.total === 1 ? 'student' : 'students'} on record`}
        action={<ButtonLink href="/admin/students/new">Add student</ButtonLink>}
      />

      <FilterBar
        action="/admin/students"
        hasFilters={hasFilters}
        fields={[
          {
            name: 'q',
            label: 'Search by name',
            type: 'search',
            value: filter.q,
            placeholder: 'Start typing a name',
          },
          {
            name: 'class_id',
            label: 'Class',
            type: 'select',
            value: filter.class_id,
            options: classes.map((c) => ({ value: c.id, label: `${c.name} · ${c.grade}` })),
          },
        ]}
      />

      <StudentList
        students={students.rows}
        hrefBase="/admin/students"
        showClass
        emptyTitle={hasFilters ? 'No students match those filters' : 'No students yet'}
        emptyDescription={
          hasFilters
            ? 'Try a different name or clear the filters.'
            : 'Add the first student to get started.'
        }
      />

      <Pagination
        page={students.page}
        pageCount={students.pageCount}
        basePath="/admin/students"
        query={{ q: filter.q, class_id: filter.class_id }}
      />
    </>
  )
}
