'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { unassignTeacherAction, unlinkParentAction } from '@/app/admin/actions'

/**
 * Break a teacher-class assignment or a parent-student link.
 *
 * Removing a link revokes that person's access to the student immediately, so
 * the confirmation spells out the consequence rather than asking a bare
 * "are you sure?".
 */
export function RemoveLink({
  id,
  kind,
  description,
}: {
  id: string
  kind: 'assignment' | 'parent-link'
  description: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function onRemove() {
    const consequence =
      kind === 'assignment'
        ? 'They will lose access to that class and its students.'
        : 'They will lose access to that child.'

    if (!window.confirm(`Remove ${description}? ${consequence}`)) return

    startTransition(async () => {
      setError(null)
      const result =
        kind === 'assignment' ? await unassignTeacherAction(id) : await unlinkParentAction(id)

      if (result.ok) router.refresh()
      else setError(result.error ?? 'That could not be removed.')
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={onRemove}
        disabled={pending}
        className="min-h-11 rounded-[--radius-control] px-2 text-sm font-medium text-danger-700 hover:bg-danger-50 disabled:text-ink-500"
      >
        {pending ? 'Removing…' : 'Remove'}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger-700">
          {error}
        </p>
      )}
    </>
  )
}
