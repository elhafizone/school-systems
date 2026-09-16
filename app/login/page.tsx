import type { Metadata } from 'next'
import { LoginForm } from '@/components/login-form'
import { Card } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to the school student tracking portal.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">School Tracking</h1>
          <p className="mt-1 text-sm text-ink-500">
            Sign in to continue. Accounts are issued by the school office.
          </p>
        </div>

        <Card className="p-6">
          <LoginForm next={next} />
        </Card>

        <p className="mt-6 text-center text-sm text-ink-500">
          Trouble signing in? Contact the school office.
        </p>
      </div>
    </main>
  )
}
