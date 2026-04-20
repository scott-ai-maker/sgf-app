import { redirect } from 'next/navigation'
import LogoutButton from '@/components/auth/LogoutButton'
import MessageThreadClient from '@/components/messages/MessageThreadClient'
import SiteHeader from '@/components/ui/SiteHeader'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function ClientMessagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    console.warn('Messages page: no authenticated user found')
    redirect('/auth/login')
  }

  const { data: clientRow } = await supabase
    .from('clients')
    .select('id, role, designated_coach_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!clientRow) {
    console.warn(`Messages page: no client record found for user ${user.id}`)
    redirect('/auth/login')
  }

  if (clientRow.role !== 'client') {
    console.warn(`Messages page: user ${user.id} has role '${clientRow.role}', not 'client'`)
    redirect('/coach')
  }

  return (
    <main className="dashboard-messages-page" style={{ minHeight: '100vh', background: 'var(--navy)' }}>
      <SiteHeader
        links={[
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/dashboard/book', label: 'Book' },
        ]}
        actions={<LogoutButton />}
      />

      <div className="dashboard-messages-content" style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px' }}>
        <h1
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 38,
            color: 'var(--white)',
            letterSpacing: '0.04em',
            margin: '0 0 8px 0',
          }}
        >
          MESSAGE YOUR TRAINER
        </h1>
        <p style={{ fontFamily: 'Raleway, sans-serif', color: 'var(--gray)', margin: '0 0 20px 0' }}>
          Secure in-app messaging for coaching communication.
        </p>

        {!clientRow.designated_coach_id ? (
          <p style={{ color: 'var(--gray)', fontFamily: 'Raleway, sans-serif' }}>
            You do not have a designated trainer yet. Please contact support.
          </p>
        ) : (
          <MessageThreadClient currentUserId={user.id} role="client" />
        )}
      </div>
    </main>
  )
}
