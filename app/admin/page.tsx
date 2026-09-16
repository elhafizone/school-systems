import Link from 'next/link'
import type { Metadata } from 'next'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { getAdminStats, listRecentContent } from '@/lib/data/queries'

export const metadata: Metadata = { title: 'Dashboard' }

/**
 * Figures an administrator would act on, and nothing else.
 *
 * Each tile links to the list it counts, so a number is a starting point
 * rather than decoration.
 */
export default async function AdminDashboard() {
  const [stats, recent] = await Promise.all([getAdminStats(), listRecentContent(8)])

  const tiles = [
    { label: 'Students', value: stats.students, href: '/admin/students' },
    { label: 'Classes', value: stats.classes, href: '/admin/classes' },
    { label: 'Teachers', value: stats.teachers, href: '/admin/teachers' },
    { label: 'Parents', value: stats.parents, href: '/admin/parents' },
  ]

  return (
    <>
      <PageHeader title="Dashboard" description="An overview of the school record." />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Card className="transition-colors hover:border-brand-600">
              <Link href={tile.href} className="block p-4">
                <p className="text-sm text-ink-500">{tile.label}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-ink-900">
                  {tile.value}
                </p>
              </Link>
            </Card>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold text-ink-900">Recent activity</h2>
          <p className="text-sm text-ink-500">
            {stats.contentThisWeek} {stats.contentThisWeek === 1 ? 'entry' : 'entries'} in the last
            7 days
          </p>
        </div>

        {recent.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Entries added by teachers will appear here as they happen."
          />
        ) : (
          <Card>
            <ul className="divide-y divide-ink-100">
              {recent.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <Badge tone={item.content_type === 'note' ? 'neutral' : 'brand'}>
                    {item.content_type === 'image'
                      ? 'Photo'
                      : item.content_type === 'video'
                        ? 'Video'
                        : 'Note'}
                  </Badge>

                  {item.student ? (
                    <Link
                      href={`/admin/students/${item.student.id}`}
                      className="font-medium text-ink-900 hover:underline"
                    >
                      {item.student.full_name}
                    </Link>
                  ) : (
                    <span className="font-medium text-ink-500">Unknown student</span>
                  )}

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
                    })}
                  </time>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  )
}
