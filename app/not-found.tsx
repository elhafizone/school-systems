import { ButtonLink } from '@/components/ui'

/**
 * Also what an unauthorized request looks like. Nothing here distinguishes
 * "does not exist" from "not yours", which is the point.
 */
export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold text-ink-900">Page not found</h1>
        <p className="mt-2 text-ink-500">
          This page does not exist, or it is not available to your account.
        </p>
        <div className="mt-6 flex justify-center">
          <ButtonLink href="/">Back to my dashboard</ButtonLink>
        </div>
      </div>
    </main>
  )
}
