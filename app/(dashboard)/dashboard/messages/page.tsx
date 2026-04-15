import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import LogoutButton from '@/components/auth/LogoutButton'
import MessageThreadClient from '@/components/messages/MessageThreadClient'

export const dynamic = 'force-dynamic'

export default async function ClientMessagesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: client } = await supabase
    .from('clients')
    .select('designated_coach_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!client) redirect('/auth/login')

  return (
    <main className="dashboard-messages-page" style={{ minHeight: '100vh', background: 'var(--navy)' }}>
      <nav
        className="dashboard-messages-nav"
        style={{
          borderBottom: '1px solid var(--navy-lt)',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <a
          href="/dashboard"
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 22,
            color: 'var(--gold)',
            letterSpacing: '0.06em',
            textDecoration: 'none',
          }}
        >
          SGF
        </a>
        <LogoutButton />
      </nav>

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

        {!client.designated_coach_id ? (
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
