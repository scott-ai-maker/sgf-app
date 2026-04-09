'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: '8px 16px',
        background: 'transparent',
        border: '1px solid var(--navy-lt)',
        borderRadius: 2,
        color: 'var(--gray)',
        fontFamily: 'Raleway, sans-serif',
        fontWeight: 600,
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      Sign Out
    </button>
  )
}
