import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import LogoutButton from '@/components/auth/LogoutButton'
import SuccessBanner from '@/components/dashboard/SuccessBanner'

export const dynamic = 'force-dynamic'

interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const [{ data: packages }, { data: sessions }] = await Promise.all([
    supabase
      .from('client_packages')
      .select('*')
      .eq('client_id', user.id)
      .order('purchased_at', { ascending: false }),
    supabase
      .from('sessions')
      .select('*')
      .eq('client_id', user.id)
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true }),
  ])

  const { data: profile } = await supabase
    .from('fitness_profiles')
    .select('onboarding_completed_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile?.onboarding_completed_at) {
    redirect('/dashboard/onboarding')
  }

  const totalRemaining = (packages ?? []).reduce(
    (sum, p) => sum + (p.sessions_remaining ?? 0),
    0
  )

  const params = await searchParams
  const showSuccess = params.success === 'true'

  return (
    <main style={{ minHeight: '100vh', background: 'var(--navy)' }}>
      {/* Nav */}
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
          SGF
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a
            href="/dashboard/fitness"
            style={{
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--gray)',
              textDecoration: 'none',
            }}
          >
            Fitness Lab
          </a>
          <a
            href="/packages"
            style={{
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--gray)',
              textDecoration: 'none',
            }}
          >
            Buy Sessions
          </a>
          <a
            href="/dashboard/messages"
            style={{
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--gray)',
              textDecoration: 'none',
            }}
          >
            Message Trainer
          </a>
          <LogoutButton />
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        {showSuccess && <SuccessBanner />}

        <h1
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 42,
            color: 'var(--white)',
            letterSpacing: '0.04em',
            marginBottom: 8,
          }}
        >
          DASHBOARD
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
          {user.email}
        </p>

        {/* Stats grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
            background: 'rgba(255,255,255,0.06)',
            marginBottom: 40,
          }}
        >
          {[
            { label: 'Packages', value: (packages ?? []).length },
            { label: 'Sessions Remaining', value: totalRemaining },
            { label: 'Upcoming', value: (sessions ?? []).length },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--navy)', padding: '28px 24px' }}>
              <div
                style={{
                  fontFamily: 'Bebas Neue, sans-serif',
                  fontSize: 48,
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

        {/* Packages */}
        <h2
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 24,
            color: 'var(--white)',
            letterSpacing: '0.06em',
            marginBottom: 16,
          }}
        >
          MY PACKAGES
        </h2>

        {!packages || packages.length === 0 ? (
          <div
            style={{
              background: 'var(--navy-mid)',
              border: '1px solid var(--navy-lt)',
              padding: '32px',
              textAlign: 'center',
              marginBottom: 40,
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
              No packages yet. Get started with a coaching package.
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
                  padding: '20px 24px',
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
                      fontSize: 15,
                      color: 'var(--white)',
                    }}
                  >
                    {pkg.package_name}
                  </div>
                  <div
                    style={{
                      fontFamily: 'Raleway, sans-serif',
                      fontSize: 13,
                      color: 'var(--gray)',
                      marginTop: 2,
                    }}
                  >
                    Purchased {new Date(pkg.purchased_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: 'Bebas Neue, sans-serif',
                      fontSize: 32,
                      color: 'var(--gold)',
                      lineHeight: 1,
                    }}
                  >
                    {pkg.sessions_remaining}
                  </div>
                  <div
                    style={{
                      fontFamily: 'Raleway, sans-serif',
                      fontSize: 11,
                      color: 'var(--gray)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      marginTop: 2,
                    }}
                  >
                    of {pkg.sessions_total} remaining
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming Sessions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 24,
              color: 'var(--white)',
              letterSpacing: '0.06em',
              margin: 0,
            }}
          >
            UPCOMING SESSIONS
          </h2>
          {totalRemaining > 0 && (
            <a
              href="/dashboard/book"
              style={{
                padding: '10px 20px',
                background: 'var(--gold)',
                color: '#0D1B2A',
                fontFamily: 'Bebas Neue, sans-serif',
                fontSize: 16,
                letterSpacing: '0.06em',
                textDecoration: 'none',
                borderRadius: 2,
              }}
            >
              Book a Session
            </a>
          )}
        </div>

        {!sessions || sessions.length === 0 ? (
          <div
            style={{
              background: 'var(--navy-mid)',
              border: '1px solid var(--navy-lt)',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 300,
                fontSize: 15,
                color: 'var(--gray)',
                margin: 0,
              }}
            >
              No upcoming sessions scheduled.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(255,255,255,0.06)' }}>
            {sessions.map(session => (
              <div
                key={session.id}
                style={{
                  background: 'var(--navy-mid)',
                  padding: '16px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    fontFamily: 'Raleway, sans-serif',
                    fontWeight: 600,
                    fontSize: 15,
                    color: 'var(--white)',
                  }}
                >
                  {new Date(session.scheduled_at).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
                <div
                  style={{
                    fontFamily: 'Raleway, sans-serif',
                    fontSize: 14,
                    color: 'var(--gray)',
                  }}
                >
                  {new Date(session.scheduled_at).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZoneName: 'short',
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
