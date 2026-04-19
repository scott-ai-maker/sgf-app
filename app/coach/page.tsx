import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import LogoutButton from '@/components/auth/LogoutButton'
import CoachClientAssignmentButton from '@/components/coach/CoachClientAssignmentButton'
import SiteHeader from '@/components/ui/SiteHeader'

export const dynamic = 'force-dynamic'

type CoachPageSearchParams = Promise<{ focus?: string | string[] | undefined; tab?: string | string[] | undefined }>

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

type CoachDashboardTab = 'overview' | 'roster' | 'intake'

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

function normalizeCoachDashboardTab(value: string | string[] | undefined): CoachDashboardTab {
  const rawValue = Array.isArray(value) ? value[0] : value

  switch (rawValue) {
    case 'roster':
    case 'intake':
      return rawValue
    default:
      return 'overview'
  }
}

function buildCoachTabHref(tab: CoachDashboardTab, focus: FocusFilter) {
  const params = new URLSearchParams()
  if (tab !== 'overview') params.set('tab', tab)
  if (focus !== 'all') params.set('focus', focus)
  const query = params.toString()
  return query ? `/coach?${query}` : '/coach'
}

function formatRelativeDaysLabel(value: string | null | undefined, now: Date) {
  if (!value) return 'No check-in'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'No check-in'

  const diffMs = now.getTime() - parsed.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return '1 day ago'
  return `${diffDays} days ago`
}

function formatBodyfat(value: number | null | undefined) {
  if (value === null || value === undefined) return 'N/A'
  return `${Math.round(value * 10) / 10}%`
}

export default async function CoachPage({ searchParams }: { searchParams: CoachPageSearchParams }) {
  const resolvedSearchParams = await searchParams
  const selectedFocus = normalizeFocusFilter(resolvedSearchParams.focus)
  const activeTab = normalizeCoachDashboardTab(resolvedSearchParams.tab)
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
    { data: recentSetLogs },
    { data: bodyAnalyses },
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
        admin
          .from('workout_set_logs')
          .select('id, user_id, session_date, reps, weight_kg, rpe')
          .in('user_id', assignedClientIds)
          .gte('session_date', checkInWindowStart.toISOString().slice(0, 10)),
        admin
          .from('body_composition_analyses')
          .select('id, user_id, estimated_bodyfat_percent, created_at')
          .in('user_id', assignedClientIds)
          .order('created_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }]

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

  const lastWorkoutLogAtByClient: Record<string, string | null> = {}
  for (const row of recentWorkoutLogs ?? []) {
    const current = lastWorkoutLogAtByClient[row.user_id]
    if (!current || row.created_at > current) {
      lastWorkoutLogAtByClient[row.user_id] = row.created_at
    }
  }

  const recentSetStatsByClient: Record<string, { sets: number; reps: number; volumeKg: number; rpeSum: number; rpeCount: number }> = {}
  for (const row of recentSetLogs ?? []) {
    const current = recentSetStatsByClient[row.user_id] ?? { sets: 0, reps: 0, volumeKg: 0, rpeSum: 0, rpeCount: 0 }
    current.sets += 1
    current.reps += Number(row.reps ?? 0)
    current.volumeKg += Number(row.reps ?? 0) * Number(row.weight_kg ?? 0)

    const rpe = Number(row.rpe ?? 0)
    if (Number.isFinite(rpe) && rpe > 0) {
      current.rpeSum += rpe
      current.rpeCount += 1
    }

    recentSetStatsByClient[row.user_id] = current
  }

  const latestBodyfatByClient: Record<string, number | null> = {}
  for (const row of bodyAnalyses ?? []) {
    if (latestBodyfatByClient[row.user_id] === undefined) {
      latestBodyfatByClient[row.user_id] = row.estimated_bodyfat_percent
    }
  }

  const clientMetricsRows = (assignedClients ?? []).map(client => {
    const statsForClient = recentSetStatsByClient[client.id] ?? { sets: 0, reps: 0, volumeKg: 0, rpeSum: 0, rpeCount: 0 }
    const avgRpe = statsForClient.rpeCount > 0 ? Math.round((statsForClient.rpeSum / statsForClient.rpeCount) * 10) / 10 : null

    return {
      id: client.id,
      name: client.full_name ?? 'Unnamed client',
      lastWorkoutLogAt: lastWorkoutLogAtByClient[client.id] ?? null,
      sets14d: statsForClient.sets,
      reps14d: statsForClient.reps,
      volume14dLb: Math.round(statsForClient.volumeKg * 2.20462),
      avgRpe14d: avgRpe,
      bodyfat: latestBodyfatByClient[client.id] ?? null,
      active14d: recentCheckInsByClient.has(client.id),
    }
  })
    .sort((a, b) => {
      const aTs = a.lastWorkoutLogAt ? new Date(a.lastWorkoutLogAt).getTime() : 0
      const bTs = b.lastWorkoutLogAt ? new Date(b.lastWorkoutLogAt).getTime() : 0
      return bTs - aTs
    })

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

  const clientMetricsSnapshotSection = (
    <>
      <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, color: 'var(--white)', letterSpacing: '0.06em', marginBottom: 12 }}>
        CLIENT METRICS SNAPSHOT
      </h2>
      <p style={{ fontFamily: 'Raleway, sans-serif', color: 'var(--gray)', fontSize: 13, marginTop: 0, marginBottom: 14 }}>
        Last 14 days of workout activity for fast coaching triage.
      </p>

      {clientMetricsRows.length === 0 ? (
        <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-lt)', padding: '20px 24px' }}>
          <p style={{ fontFamily: 'Raleway, sans-serif', color: 'var(--gray)', margin: 0 }}>No assigned clients yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 16 }}>
          <div className="coach-table-header" style={{ background: 'var(--navy)', padding: '12px 24px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr auto', gap: 14 }}>
            {['Client', 'Last log', 'Sets 14d', 'Reps 14d', 'Volume 14d (lb)', 'Avg RPE', 'Body fat', ''].map(h => (
              <span key={h} style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 600, fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {h}
              </span>
            ))}
          </div>

          {clientMetricsRows.map(row => (
            <div key={row.id} className="coach-table-row" style={{ background: 'var(--navy-mid)', padding: '14px 24px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr auto', gap: 14, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--white)' }}>{row.name}</span>
                <span style={{ fontFamily: 'Raleway, sans-serif', fontSize: 11, color: row.active14d ? 'var(--success)' : 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {row.active14d ? 'Active in 14d' : 'Needs follow-up'}
                </span>
              </div>
              <span style={{ fontFamily: 'Raleway, sans-serif', fontSize: 13, color: 'var(--gray)' }}>
                {formatRelativeDaysLabel(row.lastWorkoutLogAt, now)}
              </span>
              <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 26, color: 'var(--gold)' }}>{row.sets14d}</span>
              <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 26, color: 'var(--gold)' }}>{row.reps14d}</span>
              <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 26, color: 'var(--gold)' }}>{row.volume14dLb}</span>
              <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 26, color: 'var(--white)' }}>{row.avgRpe14d ? row.avgRpe14d : '-'}</span>
              <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 26, color: 'var(--white)' }}>{formatBodyfat(row.bodyfat)}</span>
              <a href={`/coach/clients/${row.id}`} style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--gold)', textDecoration: 'none' }}>
                Open →
              </a>
            </div>
          ))}
        </div>
      )}
    </>
  )

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

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          {[
            { key: 'overview' as const, label: 'Overview' },
            { key: 'roster' as const, label: 'Assigned Roster' },
            { key: 'intake' as const, label: 'Unassigned Intake' },
          ].map(tab => {
            const active = activeTab === tab.key
            return (
              <a
                key={tab.key}
                href={buildCoachTabHref(tab.key, selectedFocus)}
                style={{
                  padding: '10px 14px',
                  border: active ? '1px solid rgba(212,160,23,0.45)' : '1px solid rgba(255,255,255,0.12)',
                  background: active ? 'rgba(212,160,23,0.12)' : 'var(--navy-mid)',
                  color: active ? 'var(--gold-lt)' : 'var(--white)',
                  textDecoration: 'none',
                  fontFamily: 'Raleway, sans-serif',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {tab.label}
              </a>
            )
          })}
        </div>

        {activeTab === 'overview' && (
          <>
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
                  href={stat.key === 'all' ? '/coach?tab=roster#assigned-clients' : `/coach?tab=roster&focus=${stat.key}#assigned-clients`}
                  style={{
                    background: selectedFocus === stat.key ? 'rgba(212,160,23,0.1)' : 'var(--navy)',
                    padding: '28px 24px',
                    textDecoration: 'none',
                    border: selectedFocus === stat.key ? '1px solid rgba(212,160,23,0.4)' : '1px solid transparent',
                  }}
                >
                  <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 56, color: 'var(--gold)', lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 600, fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 6 }}>{stat.label}</div>
                  <div style={{ fontFamily: 'Raleway, sans-serif', fontSize: 12, color: 'var(--gray)', marginTop: 4 }}>{stat.hint}</div>
                  <div style={{ fontFamily: 'Raleway, sans-serif', fontSize: 12, color: 'var(--gray)', marginTop: 10 }}>{stat.cta}</div>
                </a>
              ))}
            </div>

            <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, color: 'var(--white)', letterSpacing: '0.06em', marginBottom: 16 }}>
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
                  href={`/coach?tab=roster&focus=${item.key}#assigned-clients`}
                  style={{
                    background: selectedFocus === item.key ? 'rgba(212,160,23,0.1)' : 'var(--navy-mid)',
                    padding: '20px 24px',
                    textDecoration: 'none',
                    border: selectedFocus === item.key ? '1px solid rgba(212,160,23,0.4)' : '1px solid transparent',
                  }}
                >
                  <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 40, lineHeight: 1, color: item.value > 0 ? 'var(--gold)' : 'var(--gray)' }}>{item.value}</div>
                  <div style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 600, fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 6 }}>{item.label}</div>
                  <div style={{ fontFamily: 'Raleway, sans-serif', fontSize: 12, color: 'var(--gray)', marginTop: 10 }}>Review clients</div>
                </a>
              ))}
            </div>

            {clientMetricsSnapshotSection}
          </>
        )}

        {activeTab === 'roster' && (
          <>
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

            {clientMetricsSnapshotSection}

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <span style={{ fontFamily: 'Raleway, sans-serif', fontSize: 13, color: 'var(--gray)' }}>
                Showing: {focusLabelByKey[selectedFocus]}
              </span>
              {selectedFocus !== 'all' ? (
                <a
                  href="/coach?tab=roster#assigned-clients"
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
              <span style={{ fontFamily: 'Raleway, sans-serif', fontSize: 13, color: 'var(--gray)' }}>
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
          </>
        )}

        {activeTab === 'intake' && (
          <>
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
          </>
        )}
      </div>
    </main>
  )
}
