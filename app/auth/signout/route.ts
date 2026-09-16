import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Sign-out is POST-only on purpose: a GET would let any third-party image tag
 * or prefetch log the user out of their own session.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  return NextResponse.redirect(new URL('/login', request.url), {
    status: 303,
  })
}
