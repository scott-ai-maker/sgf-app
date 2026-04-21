import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { normalizeDashboardWorkspace } from '@/lib/validation'
import LogoutButton from '@/components/auth/LogoutButton'
import SuccessBanner from '@/components/dashboard/SuccessBanner'
import SiteHeader from '@/components/ui/SiteHeader'

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
  const workspace = normalizeDashboardWorkspace(params.workspace)

  return (
    <main className="dashboard-page" style={{ minHeight: '100vh', background: 'var(--navy)' }}>
      <SiteHeader
        links={[
          { href: '/dashboard/fitness', label: 'Fitness Lab' },
          { href: '/packages', label: 'Buy Sessions' },
          { href: '/dashboard/messages', label: 'Messages' },
        ]}
        actions={<LogoutButton />}
      />

      <div className="dashboard-content" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
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
            marginBottom: 24,
          }}
        >
          {user.email}
        </p>

        <section style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 12, marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px', color: 'var(--gray)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Focus Workspace
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { key: 'overview' as const, label: 'Overview', hint: 'Quick actions and status' },
              { key: 'packages' as const, label: 'Packages', hint: 'Purchases and remaining sessions' },
              { key: 'sessions' as const, label: 'Sessions', hint: 'Upcoming bookings and scheduling' },
            ].map(tab => {
              const active = workspace === tab.key
              return (
                <a
                  key={tab.key}
                  href={`/dashboard?workspace=${tab.key}`}
                  style={{
                    border: active ? '1px solid rgba(212,160,23,0.55)' : '1px solid rgba(255,255,255,0.14)',
                    background: active ? 'rgba(212,160,23,0.14)' : 'var(--navy)',
                    color: active ? 'var(--gold-lt)' : 'var(--white)',
                    textDecoration: 'none',
                    padding: '8px 12px',
                  }}
                >
                  <div style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 18 }}>{tab.label}</div>
                  <div style={{ color: 'var(--gray)', fontSize: 11 }}>{tab.hint}</div>
                </a>
              )
            })}
          </div>
        </section>

        {/* Stats grid */}
        <div
          className="dashboard-stats-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
            background: 'rgba(255,255,255,0.06)',
            marginBottom: 24,
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

        {workspace === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
            <a href="/dashboard/fitness" style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 16, textDecoration: 'none' }}>
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, letterSpacing: '0.05em', color: 'var(--white)' }}>Fitness Lab</div>
              <p style={{ margin: '6px 0 0', color: 'var(--gray)', fontSize: 13 }}>Train, log sets, and track progress metrics.</p>
            </a>
            <a href="/dashboard/messages" style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 16, textDecoration: 'none' }}>
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, letterSpacing: '0.05em', color: 'var(--white)' }}>Messages</div>
              <p style={{ margin: '6px 0 0', color: 'var(--gray)', fontSize: 13 }}>Stay aligned with your coach on adjustments and support.</p>
            </a>
            <a href="/dashboard/book" style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 16, textDecoration: 'none' }}>
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, letterSpacing: '0.05em', color: 'var(--white)' }}>Book Session</div>
              <p style={{ margin: '6px 0 0', color: 'var(--gray)', fontSize: 13 }}>Schedule your next live coaching session quickly.</p>
            </a>
          </div>
        )}

        {/* Packages */}
        {workspace === 'packages' && (
        <>
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
              className="sgf-button sgf-button-primary"
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
                className="dashboard-package-row"
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
        </>
        )}

        {/* Upcoming Sessions */}
        {workspace === 'sessions' && (
        <>
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
              className="sgf-button sgf-button-primary"
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
        </>
        )}
      </div>
    </main>
  )
}
