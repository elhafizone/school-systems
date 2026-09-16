import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

/**
 * Browser client. Carries the publishable key only.
 *
 * Used for interactive work that benefits from going straight to Supabase,
 * chiefly resumable media uploads. Authorization still comes from RLS, never
 * from anything this client asserts about itself.
 */
export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey)
}
