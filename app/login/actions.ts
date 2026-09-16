'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { roleHomePath } from '@/lib/auth/session'
import { loginSchema } from '@/lib/validation/schemas'
import type { UserRole } from '@/lib/types/database'

export interface LoginState {
  error?: string
}

/**
 * One deliberately vague failure message covers a bad address, a bad password
 * and a deactivated account alike. Distinguishing them would let anyone test
 * whether a given parent has an account at this school.
 */
const GENERIC_FAILURE = 'That email and password combination was not recognised.'

/** Only a same-site absolute path may be resumed, never an off-site URL. */
function safeNext(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: 'Enter both your email address and your password.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error || !data.user) {
    return { error: GENERIC_FAILURE }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .maybeSingle<{ role: UserRole; is_active: boolean }>()

  // A credential that authenticates but has no active profile grants nothing.
  // Drop the session immediately so no half-signed-in state can linger.
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    return { error: GENERIC_FAILURE }
  }

  const requested = safeNext(formData.get('next'))
  const destination = requested ?? roleHomePath(profile.role)

  // redirect() signals by throwing, so it must sit outside any try/catch.
  redirect(destination)
}
