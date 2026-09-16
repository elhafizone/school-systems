import Link from 'next/link'
import type { ReactNode } from 'react'
import { Initials } from '@/components/ui'
import type { Session } from '@/lib/auth/session'

export interface NavItem {
  href: string
  label: string
}

/**
 * Shared chrome for all three dashboards.
 *
 * The navigation is plain links in a horizontally scrollable strip rather than
 * a drawer behind a toggle. It costs no client-side JavaScript, every
 * destination stays reachable in one tap on a phone, and there is no menu
 * state to get stuck open.
 */
export function AppShell({
  session,
  nav,
  children,
}: {
  session: Session
  nav: NavItem[]
  children: ReactNode
}) {
  const roleLabel = {
    admin: 'Administrator',
    teacher: 'Teacher',
    parent: 'Parent',
  }[session.profile.role]

  return (
    <div className="min-h-dvh">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="text-base font-semibold text-ink-900">
            School Tracking
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-ink-900">
                {session.profile.full_name}
              </p>
              <p className="text-xs leading-tight text-ink-500">{roleLabel}</p>
            </div>
            <Initials name={session.profile.full_name} size={36} />
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="min-h-11 rounded-[--radius-control] px-3 text-sm font-medium text-ink-700 hover:bg-ink-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav aria-label="Main" className="mx-auto max-w-6xl px-4">
          <ul className="-mb-px flex gap-1 overflow-x-auto">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium text-ink-700 hover:border-ink-300 hover:text-ink-900"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  )
}
