import { Badge, Card, EmptyState } from '@/components/ui'
import { DeleteContentButton } from '@/components/content-actions'
import { createSignedUrls } from '@/lib/storage/media'
import type { ContentWithAuthor } from '@/lib/types/database'

/**
 * A student's combined timeline of photos, videos and notes.
 *
 * All media URLs for the page are signed in a single batch before rendering,
 * so a twenty-item page costs one signing request. Each URL is short-lived by
 * design; the page is server-rendered on each visit, so a fresh one is minted
 * every time the timeline is viewed.
 */
export async function StudentTimeline({
  items,
  canDelete,
  emptyMessage = 'Nothing has been added for this student yet.',
}: {
  items: ContentWithAuthor[]
  canDelete: (item: ContentWithAuthor) => boolean
  emptyMessage?: string
}) {
  if (items.length === 0) {
    return <EmptyState title="No entries yet" description={emptyMessage} />
  }

  const signed = await createSignedUrls(
    items.map((i) => i.storage_path).filter((p): p is string => Boolean(p)),
  )

  return (
    <ol className="space-y-4">
      {items.map((item) => {
        const url = item.storage_path ? signed.get(item.storage_path) : undefined

        return (
          <li key={item.id}>
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4 text-sm">
                <Badge tone={item.content_type === 'note' ? 'neutral' : 'brand'}>
                  {LABELS[item.content_type]}
                </Badge>
                <time dateTime={item.created_at} className="text-ink-500">
                  {formatDate(item.created_at)}
                </time>
                <span className="text-ink-500">
                  by {item.author?.full_name ?? 'a member of staff'}
                </span>
              </div>

              {item.title && (
                <h3 className="px-4 pt-2 font-medium text-ink-900">{item.title}</h3>
              )}

              {item.description && (
                <p className="whitespace-pre-wrap px-4 pt-2 text-ink-700">{item.description}</p>
              )}

              {item.content_type === 'image' &&
                (url ? (
                  /*
                   * A plain <img> rather than next/image: these URLs expire,
                   * so routing them through the image optimiser would cache a
                   * credential-bearing URL that outlives its own signature.
                   */
                  <img
                    src={url}
                    alt={item.title ?? `Photo added on ${formatDate(item.created_at)}`}
                    loading="lazy"
                    decoding="async"
                    className="mt-3 max-h-[28rem] w-full bg-ink-100 object-contain"
                  />
                ) : (
                  <Unavailable kind="photo" />
                ))}

              {item.content_type === 'video' &&
                (url ? (
                  <video
                    src={url}
                    controls
                    preload="metadata"
                    className="mt-3 max-h-[28rem] w-full bg-ink-900"
                  >
                    Your browser cannot play this video.
                  </video>
                ) : (
                  <Unavailable kind="video" />
                ))}

              <div className="px-4 pb-3 pt-3">
                {canDelete(item) && (
                  <DeleteContentButton contentId={item.id} label={LABELS[item.content_type].toLowerCase()} />
                )}
              </div>
            </Card>
          </li>
        )
      })}
    </ol>
  )
}

const LABELS = {
  image: 'Photo',
  video: 'Video',
  note: 'Note',
} as const

function Unavailable({ kind }: { kind: string }) {
  return (
    <p className="mx-4 mt-3 rounded-[--radius-control] bg-ink-50 px-4 py-6 text-center text-sm text-ink-500">
      This {kind} is currently unavailable.
    </p>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
