import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { publicEnv, serviceRoleKey } from '@/lib/env'

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * Reserved for the two jobs that genuinely cannot be done as the signed-in
 * user: provisioning auth users when an admin creates a teacher or parent
 * account, and deleting the auth user behind a profile. Callers must have
 * already proven the caller is an admin — see requireAdmin() in lib/auth.
 *
 * The `server-only` import above turns any accidental client-side import into
 * a build error rather than a leaked key.
 */
export function createAdminClient() {
  return createSupabaseClient(publicEnv.supabaseUrl, serviceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
