import LogoutButton from '@/components/auth/LogoutButton'
import MessageThreadClient from '@/components/messages/MessageThreadClient'
import SiteHeader from '@/components/ui/SiteHeader'
import { requireSurfaceRole } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function ClientMessagesPage() {
  const { user } = await requireSurfaceRole('client')

  const { data: clientRow, error: clientError } = await supabaseAdmin()
    .from('clients')
    .select('designated_coach_id')
    .eq('id', user.id)
    .maybeSingle()

  if (clientError) {
    console.error(`Messages page: failed to load client record for user ${user.id}: ${clientError.message}`)
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

        {!clientRow?.designated_coach_id ? (
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
