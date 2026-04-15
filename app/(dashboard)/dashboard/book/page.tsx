import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import LogoutButton from '@/components/auth/LogoutButton'
import SlotPicker from '@/components/booking/SlotPicker'
import SiteHeader from '@/components/ui/SiteHeader'

export const dynamic = 'force-dynamic'

export default async function BookPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: packages } = await supabase
    .from('client_packages')
    .select('id, package_name, sessions_remaining')
    .eq('client_id', user.id)
    .gt('sessions_remaining', 0)
    .order('purchased_at', { ascending: false })

  return (
    <main className="dashboard-book-page" style={{ minHeight: '100vh', background: 'var(--navy)' }}>
      <SiteHeader
        links={[
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/dashboard/messages', label: 'Messages' },
        ]}
        actions={<LogoutButton />}
      />

      <div className="dashboard-book-content" style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <a
          href="/dashboard"
          className="sgf-shell-back"
        >
          ← Back to Dashboard
        </a>

        <h1
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 42,
            color: 'var(--white)',
            letterSpacing: '0.04em',
            marginBottom: 8,
          }}
        >
          BOOK A SESSION
        </h1>
        <p
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontWeight: 300,
            fontSize: 15,
            color: 'var(--gray)',
            marginBottom: 40,
          }}
        >
          Select an available slot and confirm your booking.
        </p>

        {!packages || packages.length === 0 ? (
          <div
            style={{
              background: 'var(--navy-mid)',
              border: '1px solid var(--navy-lt)',
              padding: '32px',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 300,
                fontSize: 15,
                color: 'var(--gray)',
                marginBottom: 20,
              }}
            >
              You have no sessions remaining. Purchase a package to continue.
            </p>
            <a
              href="/packages"
              className="sgf-button sgf-button-primary"
            >
              View Packages
            </a>
          </div>
        ) : (
          <SlotPicker packages={packages} />
        )}
      </div>
    </main>
  )
}
