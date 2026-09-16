import Link from 'next/link'

/**
 * Previous / next paging.
 *
 * Plain links, so paging works without JavaScript and each page is a real,
 * shareable URL. Existing filters are carried across rather than reset, which
 * is the usual annoyance with hand-rolled pagination.
 */
export function Pagination({
  page,
  pageCount,
  basePath,
  query = {},
}: {
  page: number
  pageCount: number
  basePath: string
  query?: Record<string, string | undefined>
}) {
  if (pageCount <= 1) return null

  const href = (target: number) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value)
    }
    if (target > 1) params.set('page', String(target))
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          rel="prev"
          className="inline-flex min-h-11 items-center rounded-[--radius-control] border border-ink-300 bg-white px-4 text-sm font-medium text-ink-900 hover:bg-ink-50"
        >
          ← Previous
        </Link>
      ) : (
        <span />
      )}

      <p aria-live="polite" className="text-sm text-ink-500">
        Page {page} of {pageCount}
      </p>

      {page < pageCount ? (
        <Link
          href={href(page + 1)}
          rel="next"
          className="inline-flex min-h-11 items-center rounded-[--radius-control] border border-ink-300 bg-white px-4 text-sm font-medium text-ink-900 hover:bg-ink-50"
        >
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
