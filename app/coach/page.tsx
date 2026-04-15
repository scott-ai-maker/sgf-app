import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import LogoutButton from '@/components/auth/LogoutButton'
import CoachClientAssignmentButton from '@/components/coach/CoachClientAssignmentButton'
import SiteHeader from '@/components/ui/SiteHeader'

export const dynamic = 'force-dynamic'

type CoachPageSearchParams = Promise<{ focus?: string | string[] | undefined }>

type FocusFilter =
  | 'all'
  | 'sessions-this-week'
  | 'attendance-30d'
  | 'no-show-30d'
  | 'onboarding-complete'
  | 'unread-messages'
  | 'low-credits'
  | 'inactive'
  | 'no-upcoming'

function normalizeFocusFilter(value: string | string[] | undefined): FocusFilter {
  const rawValue = Array.isArray(value) ? value[0] : value

  switch (rawValue) {
    case 'sessions-this-week':
    case 'attendance-30d':
    case 'no-show-30d':
    case 'onboarding-complete':
    case 'unread-messages':
    case 'low-credits':
    case 'inactive':
    case 'no-upcoming':
      return rawValue
    default:
      return 'all'
  }
}

function formatPercent(value: number | null) {
  if (value === null) return 'N/A'
  return `${value}%`
}

function dedupeChips(chips: Array<{ label: string; tone: 'gold' | 'green' | 'gray' | 'red' }>) {
  const seen = new Set<string>()

  return chips.filter(chip => {
    if (seen.has(chip.label)) return false
    seen.add(chip.label)
    return true
  })
}

export default async function CoachPage({ searchParams }: { searchParams: CoachPageSearchParams }) {
  const selectedFocus = normalizeFocusFilter((await searchParams).focus)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const admin = supabaseAdmin()

  const { data: assignedClients } = await admin
    .from('clients')
    .select('id, email, full_name, role, designated_coach_id')
    .eq('designated_coach_id', user.id)
    .eq('role', 'client')
    .order('created_at', { ascending: false })

  const { data: unassignedClients } = await admin
    .from('clients')
    .select('id, email, full_name, role, designated_coach_id')
    .is('designated_coach_id', null)
    .eq('role', 'client')
    .order('created_at', { ascending: false })

  const assignedClientIds = (assignedClients ?? []).map(client => client.id)

  const { data: packages } = assignedClientIds.length
    ? await admin
        .from('client_packages')
        .select('client_id, sessions_remaining')
        .in('client_id', assignedClientIds)
    : { data: [] }

  // Time windows for operational metrics.
  const now = new Date()

  const weekStart = new Date()
  weekStart.setHours(0, 0, 0, 0)

  // Move back to Monday.
  const day = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1))
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const rolling30Start = new Date(now)
  rolling30Start.setDate(rolling30Start.getDate() - 30)

  const checkInWindowStart = new Date(now)
  checkInWindowStart.setDate(checkInWindowStart.getDate() - 14)

  const { data: weekSessions } = assignedClientIds.length
    ? await admin
        .from('sessions')
        .select('id, client_id, scheduled_at, status')
        .in('client_id', assignedClientIds)
        .gte('scheduled_at', weekStart.toISOString())
        .lt('scheduled_at', weekEnd.toISOString())
    : { data: [] }

  const [
    { data: rollingSessions },
    { data: upcomingSessions },
    { data: fitnessProfiles },
    { data: recentWorkoutLogs },
    { data: unreadMessages },
  ] = assignedClientIds.length
    ? await Promise.all([
        admin
          .from('sessions')
          .select('id, client_id, scheduled_at, status')
          .in('client_id', assignedClientIds)
          .gte('scheduled_at', rolling30Start.toISOString())
          .lt('scheduled_at', now.toISOString()),
        admin
          .from('sessions')
          .select('id, client_id, scheduled_at, status')
          .in('client_id', assignedClientIds)
          .eq('status', 'scheduled')
          .gte('scheduled_at', now.toISOString()),
        admin
          .from('fitness_profiles')
          .select('user_id, onboarding_completed_at')
          .in('user_id', assignedClientIds),
        admin
          .from('workout_logs')
          .select('id, user_id, created_at')
          .in('user_id', assignedClientIds)
          .gte('created_at', checkInWindowStart.toISOString()),
        admin
          .from('coach_client_messages')
          .select('id, client_id, sender_id, read_at')
          .eq('coach_id', user.id)
          .in('client_id', assignedClientIds)
          .is('read_at', null),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }]

  // Build per-client remaining count
  const remainingByClient: Record<string, number> = {}
  for (const pkg of packages ?? []) {
    remainingByClient[pkg.client_id] =
      (remainingByClient[pkg.client_id] ?? 0) + pkg.sessions_remaining
  }

  const recentCheckInsByClient = new Set((recentWorkoutLogs ?? []).map(log => log.user_id))
  const upcomingSessionsByClient = new Set((upcomingSessions ?? []).map(session => session.client_id))
  const weekSessionClientIds = new Set((weekSessions ?? []).map(session => session.client_id))
  const completedRolling30ClientIds = new Set(
    (rollingSessions ?? []).filter(session => session.status === 'completed').map(session => session.client_id)
  )
  const noShowRolling30ClientIds = new Set(
    (rollingSessions ?? []).filter(session => session.status === 'no_show').map(session => session.client_id)
  )
  const onboardingCompleteClientIds = new Set(
    (fitnessProfiles ?? []).filter(profile => profile.onboarding_completed_at).map(profile => profile.user_id)
  )
  const unreadMessageClientIds = new Set(
    (unreadMessages ?? []).filter(message => message.sender_id === message.client_id).map(message => message.client_id)
  )

  const totalClients = (assignedClients ?? []).length
  const weekCount = (weekSessions ?? []).length
  const weekCompletedCount = (weekSessions ?? []).filter(session => session.status === 'completed').length

  const attendanceBase = (rollingSessions ?? []).filter(
    session => session.status === 'completed' || session.status === 'no_show'
  ).length
  const completedRolling30 = (rollingSessions ?? []).filter(session => session.status === 'completed').length
  const noShowRolling30 = (rollingSessions ?? []).filter(session => session.status === 'no_show').length

  const attendanceRate = attendanceBase ? Math.round((completedRolling30 / attendanceBase) * 100) : null
  const noShowRate = attendanceBase ? Math.round((noShowRolling30 / attendanceBase) * 100) : null

  const onboardingCompleteCount = (fitnessProfiles ?? []).filter(profile => profile.onboarding_completed_at).length
  const onboardingCompletionRate = totalClients ? Math.round((onboardingCompleteCount / totalClients) * 100) : 0

  const lowCreditClientsCount = assignedClientIds.filter(clientId => (remainingByClient[clientId] ?? 0) <= 2).length
  const inactiveClientsCount = assignedClientIds.filter(clientId => !recentCheckInsByClient.has(clientId)).length
  const clientsWithoutUpcomingSessions = assignedClientIds.filter(clientId => !upcomingSessionsByClient.has(clientId)).length

  const lowCreditClientIds = new Set(assignedClientIds.filter(clientId => (remainingByClient[clientId] ?? 0) <= 2))
  const inactiveClientIds = new Set(assignedClientIds.filter(clientId => !recentCheckInsByClient.has(clientId)))
  const noUpcomingClientIds = new Set(assignedClientIds.filter(clientId => !upcomingSessionsByClient.has(clientId)))

  const unreadClientMessages = (unreadMessages ?? []).filter(message => message.sender_id === message.client_id).length

  const stats = [
    { key: 'all', label: 'Active Clients', value: totalClients, hint: 'Current assigned roster', cta: 'View roster' },
    {
      key: 'sessions-this-week',
      label: 'Sessions This Week',
      value: weekCount,
      hint: `${weekCompletedCount} completed`,
      cta: 'View scheduled clients',
    },
    {
      key: 'attendance-30d',
      label: 'Attendance (30d)',
      value: formatPercent(attendanceRate),
      hint: 'Completed vs no-show',
      cta: 'View attended clients',
    },
    {
      key: 'no-show-30d',
      label: 'No-Show Rate (30d)',
      value: formatPercent(noShowRate),
      hint: 'Lower is better',
      cta: 'View no-show clients',
    },
    {
      key: 'onboarding-complete',
      label: 'Onboarding Complete',
      value: `${onboardingCompletionRate}%`,
      hint: `${onboardingCompleteCount}/${totalClients}`,
      cta: 'View onboarded clients',
    },
    {
      key: 'unread-messages',
      label: 'Unread Client Messages',
      value: unreadClientMessages,
      hint: 'Needs coach reply',
      cta: 'View waiting clients',
    },
  ]

  const attentionItems = [
    { key: 'low-credits', label: 'Low Session Credits (<=2)', value: lowCreditClientsCount },
    { key: 'inactive', label: 'No Workout Check-In (14d)', value: inactiveClientsCount },
    { key: 'no-upcoming', label: 'No Upcoming Session', value: clientsWithoutUpcomingSessions },
  ]

  const focusLabelByKey: Record<FocusFilter, string> = {
    all: 'All assigned clients',
    'sessions-this-week': 'Clients with sessions this week',
    'attendance-30d': 'Clients with completed sessions in the last 30 days',
    'no-show-30d': 'Clients with no-shows in the last 30 days',
    'onboarding-complete': 'Clients with completed onboarding',
    'unread-messages': 'Clients waiting on a coach reply',
    'low-credits': 'Clients with low session credits',
    inactive: 'Clients missing workout check-ins',
    'no-upcoming': 'Clients without upcoming sessions',
  }

  const filteredAssignedClients = (assignedClients ?? []).filter(client => {
    if (selectedFocus === 'sessions-this-week') return weekSessionClientIds.has(client.id)
    if (selectedFocus === 'attendance-30d') return completedRolling30ClientIds.has(client.id)
    if (selectedFocus === 'no-show-30d') return noShowRolling30ClientIds.has(client.id)
    if (selectedFocus === 'onboarding-complete') return onboardingCompleteClientIds.has(client.id)
    if (selectedFocus === 'unread-messages') return unreadMessageClientIds.has(client.id)
    if (selectedFocus === 'low-credits') return lowCreditClientIds.has(client.id)
    if (selectedFocus === 'inactive') return inactiveClientIds.has(client.id)
    if (selectedFocus === 'no-upcoming') return noUpcomingClientIds.has(client.id)
    return true
  })

  const chipStyles = {
    gold: { background: 'rgba(212,160,23,0.15)', color: 'var(--gold)' },
    green: { background: 'rgba(72,187,120,0.15)', color: 'var(--success)' },
    gray: { background: 'rgba(138,153,170,0.15)', color: 'var(--gray)' },
    red: { background: 'rgba(255,61,87,0.15)', color: 'var(--error)' },
  } as const

  const statusChipsByClient = Object.fromEntries(
    (assignedClients ?? []).map(client => {
      const baseChips: Array<{ label: string; tone: keyof typeof chipStyles }> = []

      if (weekSessionClientIds.has(client.id)) baseChips.push({ label: 'This week', tone: 'gold' })
      if (completedRolling30ClientIds.has(client.id)) baseChips.push({ label: 'Attended 30d', tone: 'green' })
      if (noShowRolling30ClientIds.has(client.id)) baseChips.push({ label: 'No-show 30d', tone: 'red' })
      if (onboardingCompleteClientIds.has(client.id)) baseChips.push({ label: 'Onboarded', tone: 'green' })
      if (unreadMessageClientIds.has(client.id)) baseChips.push({ label: 'Unread message', tone: 'gold' })
      if (lowCreditClientIds.has(client.id)) baseChips.push({ label: 'Low credits', tone: 'gold' })
      if (inactiveClientIds.has(client.id)) baseChips.push({ label: 'No check-in 14d', tone: 'gray' })
      if (noUpcomingClientIds.has(client.id)) baseChips.push({ label: 'No upcoming', tone: 'gray' })

      let priorityChip: { label: string; tone: keyof typeof chipStyles } | null = null

      if (selectedFocus === 'sessions-this-week' && weekSessionClientIds.has(client.id)) {
        priorityChip = { label: 'Matches: This week', tone: 'gold' }
      } else if (selectedFocus === 'attendance-30d' && completedRolling30ClientIds.has(client.id)) {
        priorityChip = { label: 'Matches: Attended 30d', tone: 'green' }
      } else if (selectedFocus === 'no-show-30d' && noShowRolling30ClientIds.has(client.id)) {
        priorityChip = { label: 'Matches: No-show 30d', tone: 'red' }
      } else if (selectedFocus === 'onboarding-complete' && onboardingCompleteClientIds.has(client.id)) {
        priorityChip = { label: 'Matches: Onboarded', tone: 'green' }
      } else if (selectedFocus === 'unread-messages' && unreadMessageClientIds.has(client.id)) {
        priorityChip = { label: 'Matches: Unread message', tone: 'gold' }
      } else if (selectedFocus === 'low-credits' && lowCreditClientIds.has(client.id)) {
        priorityChip = { label: 'Matches: Low credits', tone: 'gold' }
      } else if (selectedFocus === 'inactive' && inactiveClientIds.has(client.id)) {
        priorityChip = { label: 'Matches: No check-in', tone: 'gray' }
      } else if (selectedFocus === 'no-upcoming' && noUpcomingClientIds.has(client.id)) {
        priorityChip = { label: 'Matches: No upcoming', tone: 'gray' }
      }

      const chips = dedupeChips(priorityChip ? [priorityChip, ...baseChips] : baseChips).slice(0, 4)

      return [client.id, chips]
    })
  ) as Record<string, Array<{ label: string; tone: keyof typeof chipStyles }>>

  return (
    <main className="coach-page" style={{ minHeight: '100vh', background: 'var(--navy)' }}>
      <SiteHeader
        badgeText="Coach Console"
        links={[
          { href: '/coach#assigned-clients', label: 'Assigned Clients' },
          { href: '/coach?focus=unread-messages#assigned-clients', label: 'Unread' },
        ]}
        actions={<LogoutButton />}
      />

      <div className="coach-content" style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
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
          className="coach-stats-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
            background: 'rgba(255,255,255,0.06)',
            marginBottom: 48,
          }}
        >
          {stats.map(stat => (
            <a
              key={stat.label}
              href={stat.key === 'all' ? '/coach#assigned-clients' : `/coach?focus=${stat.key}#assigned-clients`}
              style={{
                background: selectedFocus === stat.key ? 'rgba(212,160,23,0.1)' : 'var(--navy)',
                padding: '28px 24px',
                textDecoration: 'none',
                border: selectedFocus === stat.key ? '1px solid rgba(212,160,23,0.4)' : '1px solid transparent',
              }}
            >
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
              <div
                style={{
                  fontFamily: 'Raleway, sans-serif',
                  fontSize: 12,
                  color: 'var(--gray)',
                  marginTop: 4,
                }}
              >
                {stat.hint}
              </div>
              <div
                style={{
                  fontFamily: 'Raleway, sans-serif',
                  fontSize: 12,
                  color: 'var(--gray)',
                  marginTop: 10,
                }}
              >
                {stat.cta}
              </div>
            </a>
          ))}
        </div>

        <h2
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 24,
            color: 'var(--white)',
            letterSpacing: '0.06em',
            marginBottom: 16,
          }}
        >
          ATTENTION NEEDED
        </h2>

        <div
          className="coach-attention-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
            background: 'rgba(255,255,255,0.06)',
            marginBottom: 40,
          }}
        >
          {attentionItems.map(item => (
            <a
              key={item.label}
              href={`/coach?focus=${item.key}#assigned-clients`}
              style={{
                background: selectedFocus === item.key ? 'rgba(212,160,23,0.1)' : 'var(--navy-mid)',
                padding: '20px 24px',
                textDecoration: 'none',
                border: selectedFocus === item.key ? '1px solid rgba(212,160,23,0.4)' : '1px solid transparent',
              }}
            >
              <div
                style={{
                  fontFamily: 'Bebas Neue, sans-serif',
                  fontSize: 40,
                  lineHeight: 1,
                  color: item.value > 0 ? 'var(--gold)' : 'var(--gray)',
                }}
              >
                {item.value}
              </div>
              <div
                style={{
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 600,
                  fontSize: 11,
                  color: 'var(--gray)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginTop: 6,
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  fontFamily: 'Raleway, sans-serif',
                  fontSize: 12,
                  color: 'var(--gray)',
                  marginTop: 10,
                }}
              >
                Review clients
              </div>
            </a>
          ))}
        </div>

        {/* Assigned clients */}
        <h2
          id="assigned-clients"
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 24,
            color: 'var(--white)',
            letterSpacing: '0.06em',
            marginBottom: 16,
          }}
        >
          ASSIGNED CLIENTS
        </h2>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontFamily: 'Raleway, sans-serif',
              fontSize: 13,
              color: 'var(--gray)',
            }}
          >
            Showing: {focusLabelByKey[selectedFocus]}
          </span>
          {selectedFocus !== 'all' ? (
            <a
              href="/coach#assigned-clients"
              style={{
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 600,
                fontSize: 13,
                color: 'var(--gold)',
                textDecoration: 'none',
              }}
            >
              Clear filter
            </a>
          ) : null}
          <span
            style={{
              fontFamily: 'Raleway, sans-serif',
              fontSize: 13,
              color: 'var(--gray)',
            }}
          >
            {filteredAssignedClients.length} client{filteredAssignedClients.length === 1 ? '' : 's'}
          </span>
        </div>

        {!assignedClients || assignedClients.length === 0 ? (
          <div
            style={{
              background: 'var(--navy-mid)',
              border: '1px solid var(--navy-lt)',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 15, color: 'var(--gray)', margin: 0 }}>
              No clients assigned to you yet.
            </p>
          </div>
        ) : filteredAssignedClients.length === 0 ? (
          <div
            style={{
              background: 'var(--navy-mid)',
              border: '1px solid var(--navy-lt)',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 15, color: 'var(--gray)', margin: 0 }}>
              No assigned clients match this filter.
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
              className="coach-table-header"
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

            {filteredAssignedClients.map(client => (
                <div
                  key={client.id}
                  className="coach-table-row"
                  style={{
                    background: 'var(--navy-mid)',
                    padding: '16px 24px',
                    display: 'grid',
                    gridTemplateColumns: '2fr 2fr 1fr auto auto',
                    gap: 16,
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
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
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      {(statusChipsByClient[client.id] ?? []).map(chip => {
                        const chipStyle = chipStyles[chip.tone]

                        return (
                          <span
                            key={chip.label}
                            style={{
                              fontFamily: 'Raleway, sans-serif',
                              fontWeight: 700,
                              fontSize: 10,
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              padding: '4px 8px',
                              borderRadius: 999,
                              background: chipStyle.background,
                              color: chipStyle.color,
                              lineHeight: 1,
                            }}
                          >
                            {chip.label}
                          </span>
                        )
                      })}
                    </div>
                  </div>
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
                  <CoachClientAssignmentButton clientId={client.id} mode="release" />
                </div>
              ))}
          </div>
        )}

        <h2
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 24,
            color: 'var(--white)',
            letterSpacing: '0.06em',
            marginTop: 40,
            marginBottom: 16,
          }}
        >
          UNASSIGNED CLIENTS
        </h2>

        {!unassignedClients || unassignedClients.length === 0 ? (
          <div
            style={{
              background: 'var(--navy-mid)',
              border: '1px solid var(--navy-lt)',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 15, color: 'var(--gray)', margin: 0 }}>
              No unassigned clients available.
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
            <div
              className="coach-table-header"
              style={{
                background: 'var(--navy)',
                padding: '12px 24px',
                display: 'grid',
                gridTemplateColumns: '2fr 2fr auto',
                gap: 16,
              }}
            >
              {['Name', 'Email', ''].map(h => (
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

            {unassignedClients.map(client => (
              <div
                key={client.id}
                className="coach-table-row"
                style={{
                  background: 'var(--navy-mid)',
                  padding: '16px 24px',
                  display: 'grid',
                  gridTemplateColumns: '2fr 2fr auto',
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
                <CoachClientAssignmentButton clientId={client.id} mode="assign" />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
