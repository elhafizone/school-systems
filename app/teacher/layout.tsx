import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth/session'

/**
 * Every route under /teacher passes through this gate. A parent or a
 * deactivated account never reaches a child page, whatever URL they type.
 */
export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('teacher')

  return (
    <AppShell session={session} nav={[{ href: '/teacher', label: 'My classes' }]}>
      {children}
    </AppShell>
  )
}
