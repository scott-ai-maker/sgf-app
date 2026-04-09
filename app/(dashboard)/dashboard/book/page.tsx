import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import LogoutButton from '@/components/auth/LogoutButton'
import SlotPicker from '@/components/booking/SlotPicker'

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
    <main style={{ minHeight: '100vh', background: 'var(--navy)' }}>
      <nav
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

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <a
          href="/dashboard"
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontSize: 13,
            color: 'var(--gray)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 24,
          }}
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
              style={{
                display: 'inline-block',
                padding: '12px 28px',
                background: 'var(--gold)',
                color: '#0D1B2A',
                fontFamily: 'Bebas Neue, sans-serif',
                fontSize: 18,
                letterSpacing: '0.06em',
                textDecoration: 'none',
                borderRadius: 2,
              }}
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
