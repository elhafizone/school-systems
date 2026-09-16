'use client'

import { useEffect } from 'react'
import { Button, ButtonLink } from '@/components/ui'

/**
 * Last-resort boundary. The visitor gets a plain apology and a way out; the
 * underlying message and stack stay in the server logs, never on the page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // The digest is the only handle shown, and it is safe: it correlates with
    // the server-side log entry without carrying any detail itself.
    console.error('Unhandled application error', error.digest)
  }, [error])

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold text-ink-900">Something went wrong</h1>
        <p className="mt-2 text-ink-500">
          The page could not be loaded. Please try again, and let the school office know if it
          keeps happening.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-ink-500">Reference: {error.digest}</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/" variant="secondary">
            Go to dashboard
          </ButtonLink>
        </div>
      </div>
    </main>
  )
}
