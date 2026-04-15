import { requireSurfaceRole } from '@/lib/authz'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  await requireSurfaceRole('client')
  return children
}
