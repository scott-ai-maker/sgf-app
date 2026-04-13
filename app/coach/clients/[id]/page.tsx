import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import LogoutButton from '@/components/auth/LogoutButton'
import ClientDetailClient from '@/components/coach/ClientDetailClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CoachClientPage({ params }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { id } = await params
  const admin = supabaseAdmin()

  // Fetch client info
  const { data: client, error: clientError } = await admin
    .from('clients')
    .select('id, email, full_name, phone, created_at')
    .eq('id', id)
    .single()

  if (clientError || !client) notFound()

  // Fetch packages
  const { data: packages } = await admin
    .from('client_packages')
    .select('*')
    .eq('client_id', id)
    .order('purchased_at', { ascending: false })

  // Fetch all sessions (past + upcoming)
  const { data: sessions } = await admin
    .from('sessions')
    .select('id, scheduled_at, status, notes, duration_mins')
    .eq('client_id', id)
    .order('scheduled_at', { ascending: false })

  const totalRemaining = (packages ?? []).reduce(
    (sum, p) => sum + (p.sessions_remaining ?? 0),
    0
  )

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
          href="/coach"
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 22,
            color: 'var(--gold)',
            letterSpacing: '0.06em',
            textDecoration: 'none',
          }}
        >
          SGF COACH
        </a>
        <LogoutButton />
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        <a
          href="/coach"
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
          ← Back to Clients
        </a>

        {/* Client info */}
        <div
          style={{
            background: 'var(--navy-mid)',
            border: '1px solid var(--navy-lt)',
            padding: '28px 32px',
            marginBottom: 40,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 600,
                fontSize: 11,
                color: 'var(--gray)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 4,
              }}
            >
              Name
            </div>
            <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, color: 'var(--white)' }}>
              {client.full_name ?? '—'}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 600,
                fontSize: 11,
                color: 'var(--gray)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 4,
              }}
            >
              Email
            </div>
            <div style={{ fontFamily: 'Raleway, sans-serif', fontSize: 14, color: 'var(--white)' }}>
              {client.email}
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 600,
                fontSize: 11,
                color: 'var(--gray)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 4,
              }}
            >
              Phone
            </div>
            <div style={{ fontFamily: 'Raleway, sans-serif', fontSize: 14, color: 'var(--white)' }}>
              {client.phone ?? '—'}
            </div>
          </div>
        </div>

        {/* Packages */}
        <h2
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 22,
            color: 'var(--white)',
            letterSpacing: '0.06em',
            marginBottom: 14,
          }}
        >
          PACKAGES ({totalRemaining} sessions remaining)
        </h2>

        {!packages || packages.length === 0 ? (
          <p
            style={{
              fontFamily: 'Raleway, sans-serif',
              fontSize: 14,
              color: 'var(--gray)',
              marginBottom: 40,
            }}
          >
            No packages purchased.
          </p>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              background: 'rgba(255,255,255,0.06)',
              marginBottom: 40,
            }}
          >
            {packages.map(pkg => (
              <div
                key={pkg.id}
                style={{
                  background: 'var(--navy-mid)',
                  padding: '16px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: 'Raleway, sans-serif',
                      fontWeight: 600,
                      fontSize: 14,
                      color: 'var(--white)',
                    }}
                  >
                    {pkg.package_name}
                  </div>
                  <div style={{ fontFamily: 'Raleway, sans-serif', fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>
                    Purchased {new Date(pkg.purchased_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontFamily: 'Bebas Neue, sans-serif',
                      fontSize: 28,
                      color: 'var(--gold)',
                    }}
                  >
                    {pkg.sessions_remaining}
                  </span>
                  <span
                    style={{
                      fontFamily: 'Raleway, sans-serif',
                      fontSize: 12,
                      color: 'var(--gray)',
                      marginLeft: 4,
                    }}
                  >
                    / {pkg.sessions_total}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sessions */}
        <h2
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 22,
            color: 'var(--white)',
            letterSpacing: '0.06em',
            marginBottom: 14,
          }}
        >
          SESSIONS ({(sessions ?? []).length})
        </h2>

        <ClientDetailClient sessions={sessions ?? []} />
      </div>
    </main>
  )
}
