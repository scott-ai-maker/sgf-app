import { requireSurfaceRole } from '@/lib/authz'

interface CoachLayoutProps {
  children: React.ReactNode
}

export default async function CoachLayout({ children }: CoachLayoutProps) {
  await requireSurfaceRole('coach')
  return children
}
