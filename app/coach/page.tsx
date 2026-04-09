import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import LogoutButton from '@/components/auth/LogoutButton'

export const dynamic = 'force-dynamic'

export default async function CoachPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const admin = supabaseAdmin()

  // Fetch all clients
  const { data: clients } = await admin
    .from('clients')
    .select('id, email, full_name, role')
    .order('created_at', { ascending: false })

  // Fetch all packages for session remaining counts
  const { data: packages } = await admin
    .from('client_packages')
    .select('client_id, sessions_remaining')

  // Fetch sessions this week
  const weekStart = new Date()
  weekStart.setHours(0, 0, 0, 0)
  // Move back to Monday
  const day = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1))
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const { data: weekSessions } = await admin
    .from('sessions')
    .select('id, client_id, scheduled_at, status')
    .gte('scheduled_at', weekStart.toISOString())
    .lt('scheduled_at', weekEnd.toISOString())

  // Build per-client remaining count
  const remainingByClient: Record<string, number> = {}
  for (const pkg of packages ?? []) {
    remainingByClient[pkg.client_id] =
      (remainingByClient[pkg.client_id] ?? 0) + pkg.sessions_remaining
  }

  const totalClients = (clients ?? []).filter(c => c.role !== 'coach').length
  const weekCount = (weekSessions ?? []).length

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
        <span
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 22,
            color: 'var(--gold)',
            letterSpacing: '0.06em',
          }}
        >
          SGF COACH
        </span>
        <LogoutButton />
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
        <h1
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 42,
            color: 'var(--white)',
            letterSpacing: '0.04em',
            marginBottom: 40,
          }}
        >
          COACH DASHBOARD
        </h1>

        {/* Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1,
            background: 'rgba(255,255,255,0.06)',
            marginBottom: 48,
          }}
        >
          {[
            { label: 'Active Clients', value: totalClients },
            { label: 'Sessions This Week', value: weekCount },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--navy)', padding: '28px 24px' }}>
              <div
                style={{
                  fontFamily: 'Bebas Neue, sans-serif',
                  fontSize: 56,
                  color: 'var(--gold)',
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 600,
                  fontSize: 11,
                  color: 'var(--gray)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginTop: 6,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Client list */}
        <h2
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 24,
            color: 'var(--white)',
            letterSpacing: '0.06em',
            marginBottom: 16,
          }}
        >
          CLIENTS
        </h2>

        {!clients || clients.filter(c => c.role !== 'coach').length === 0 ? (
          <div
            style={{
              background: 'var(--navy-mid)',
              border: '1px solid var(--navy-lt)',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 15, color: 'var(--gray)', margin: 0 }}>
              No clients yet.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              background: 'rgba(255,255,255,0.06)',
            }}
          >
            {/* Header row */}
            <div
              style={{
                background: 'var(--navy)',
                padding: '12px 24px',
                display: 'grid',
                gridTemplateColumns: '2fr 2fr 1fr 1fr',
                gap: 16,
              }}
            >
              {['Name', 'Email', 'Sessions Left', ''].map(h => (
                <span
                  key={h}
                  style={{
                    fontFamily: 'Raleway, sans-serif',
                    fontWeight: 600,
                    fontSize: 11,
                    color: 'var(--gray)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {h}
                </span>
              ))}
            </div>

            {clients
              .filter(c => c.role !== 'coach')
              .map(client => (
                <div
                  key={client.id}
                  style={{
                    background: 'var(--navy-mid)',
                    padding: '16px 24px',
                    display: 'grid',
                    gridTemplateColumns: '2fr 2fr 1fr 1fr',
                    gap: 16,
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Raleway, sans-serif',
                      fontWeight: 600,
                      fontSize: 14,
                      color: 'var(--white)',
                    }}
                  >
                    {client.full_name ?? '—'}
                  </span>
                  <span
                    style={{
                      fontFamily: 'Raleway, sans-serif',
                      fontSize: 14,
                      color: 'var(--gray)',
                    }}
                  >
                    {client.email}
                  </span>
                  <span
                    style={{
                      fontFamily: 'Bebas Neue, sans-serif',
                      fontSize: 24,
                      color: 'var(--gold)',
                    }}
                  >
                    {remainingByClient[client.id] ?? 0}
                  </span>
                  <a
                    href={`/coach/clients/${client.id}`}
                    style={{
                      fontFamily: 'Raleway, sans-serif',
                      fontWeight: 600,
                      fontSize: 13,
                      color: 'var(--gold)',
                      textDecoration: 'none',
                    }}
                  >
                    View →
                  </a>
                </div>
              ))}
          </div>
        )}
      </div>
    </main>
  )
}
