'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import { setProfileActiveAction, setStudentActiveAction } from '@/app/admin/actions'

/**
 * Activate / deactivate.
 *
 * Deactivation is the system's stand-in for deletion: access stops at once,
 * but the record and its history survive. The confirmation text says so
 * plainly, because "deactivate" reads as destructive to most people.
 */
export function ToggleActive({
  id,
  kind,
  isActive,
  name,
}: {
  id: string
  kind: 'student' | 'profile'
  isActive: boolean
  name: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function onToggle() {
    if (isActive) {
      const message =
        kind === 'student'
          ? `Deactivate ${name}? They will be hidden from teachers and parents. Their timeline is kept and can be restored.`
          : `Deactivate ${name}? They will be signed out and unable to sign in again until reactivated.`
      if (!window.confirm(message)) return
    }

    startTransition(async () => {
      setError(null)
      const result =
        kind === 'student'
          ? await setStudentActiveAction(id, !isActive)
          : await setProfileActiveAction(id, !isActive)

      if (result.ok) router.refresh()
      else setError(result.error ?? 'That change could not be saved.')
    })
  }

  return (
    <div>
      <Button
        type="button"
        variant={isActive ? 'secondary' : 'primary'}
        size="sm"
        onClick={onToggle}
        disabled={pending}
      >
        {pending ? 'Working…' : isActive ? 'Deactivate' : 'Reactivate'}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-danger-700">
          {error}
        </p>
      )}
    </div>
  )
}
