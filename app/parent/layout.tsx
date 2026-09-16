import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth/session'

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('parent')

  return (
    <AppShell session={session} nav={[{ href: '/parent', label: 'My children' }]}>
      {children}
    </AppShell>
  )
}
