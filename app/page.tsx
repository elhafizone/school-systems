import { redirect } from 'next/navigation'
import { getSession, roleHomePath } from '@/lib/auth/session'

/**
 * The root is a signpost, not a page: send each visitor to the one area they
 * are entitled to. Kept dynamic because the answer depends on the session.
 */
export const dynamic = 'force-dynamic'

export default async function Home() {
  const session = await getSession()
  redirect(session ? roleHomePath(session.profile.role) : '/login')
}
