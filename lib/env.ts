/**
 * Environment access.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only when the
 * property is written out literally, so these are spelled in full rather than
 * looked up through a variable.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    )
  }
  return value
}

/** Safe in the browser: URL and publishable key only. */
export const publicEnv = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
}

/**
 * Canonical origin of this deployment, e.g. https://school.example.com.
 * Read from the environment so moving from the staging subdomain to the
 * school's official domain is a config change, never a code change.
 */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

/**
 * Service role key. Server-only: this must never be imported into a module
 * that reaches the browser bundle.
 */
export function serviceRoleKey(): string {
  if (typeof window !== 'undefined') {
    throw new Error('serviceRoleKey() was called in the browser. This is a bug.')
  }
  return required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)
}
