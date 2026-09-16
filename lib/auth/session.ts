import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile, UserRole } from '@/lib/types/database'

export interface Session {
  userId: string
  email: string | null
  profile: Profile
}

/** Where each role lands after signing in. */
export function roleHomePath(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'teacher':
      return '/teacher'
    case 'parent':
      return '/parent'
  }
}

/**
 * Resolve the current session and its profile, or null.
 *
 * `getUser()` is used rather than `getSession()` because it revalidates the
 * JWT with the auth server instead of trusting the cookie as presented.
 *
 * Wrapped in React `cache` so the several components that need the session
 * during one render share a single round trip.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<Profile>()

  // Authenticated but unprovisioned, or deactivated by an admin. Either way
  // the account has no access; treat it as signed out.
  if (!profile || !profile.is_active) return null

  return { userId: user.id, email: user.email ?? null, profile }
})

/** Session or bounce to login. */
export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

/**
 * Session with one of `roles`, or bounce.
 *
 * A signed-in user who holds the wrong role is sent to their own dashboard
 * rather than to login, which is both more useful and avoids implying the
 * resource exists.
 */
export async function requireRole(...roles: UserRole[]): Promise<Session> {
  const session = await requireSession()
  if (!roles.includes(session.profile.role)) {
    redirect(roleHomePath(session.profile.role))
  }
  return session
}

export function requireAdmin() {
  return requireRole('admin')
}
