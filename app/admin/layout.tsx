import { AppShell } from '@/components/app-shell'
import { requireRole } from '@/lib/auth/session'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('admin')

  return (
    <AppShell
      session={session}
      nav={[
        { href: '/admin', label: 'Dashboard' },
        { href: '/admin/students', label: 'Students' },
        { href: '/admin/classes', label: 'Classes' },
        { href: '/admin/teachers', label: 'Teachers' },
        { href: '/admin/parents', label: 'Parents' },
        { href: '/admin/content', label: 'Content' },
      ]}
    >
      {children}
    </AppShell>
  )
}
