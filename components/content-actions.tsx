'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteContentAction } from '@/lib/actions/content'

/**
 * Remove a timeline entry.
 *
 * Confirmation is required because the delete also removes the stored file and
 * cannot be undone. The server re-checks ownership regardless of what this
 * component renders.
 */
export function DeleteContentButton({ contentId, label }: { contentId: string; label: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function onDelete() {
    if (!window.confirm(`Remove this ${label}? This cannot be undone.`)) return

    startTransition(async () => {
      const result = await deleteContentAction(contentId)
      if (result.ok) {
        router.refresh()
      } else {
        setError(result.error ?? 'Could not remove this item.')
      }
    })
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="min-h-11 rounded-[--radius-control] px-2 text-sm font-medium text-danger-700 hover:bg-danger-50 disabled:text-ink-500"
      >
        {pending ? 'Removing…' : 'Remove'}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-danger-700">
          {error}
        </p>
      )}
    </div>
  )
}
