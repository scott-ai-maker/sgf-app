import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizeCoachClientTab, type CoachClientTab } from '@/lib/validation'
import LogoutButton from '@/components/auth/LogoutButton'
import ClientDetailClient from '@/components/coach/ClientDetailClient'
import CoachClientAssignmentButton from '@/components/coach/CoachClientAssignmentButton'
import CoachCommerceTools from '@/components/coach/CoachCommerceTools'
import CoachProgramWorkspace from '@/components/coach/CoachProgramWorkspace'
import SiteHeader from '@/components/ui/SiteHeader'
import CoachCheckinReview from '@/components/coach/CoachCheckinReview'
import ProgressPhotoTimeline from '@/components/fitness/ProgressPhotoTimeline'
import {
  createSignedFitnessPhotoUrl,
  extractPhotoPathFromLegacyUrl,
  normalizePhotoPath,
} from '@/lib/fitness-photos'

export const dynamic = 'force-dynamic'

const EXERCISE_LIBRARY_SOURCE = 'nasm_exercise_library'
const EXCLUDED_EQUIPMENT_TERMS = ['chains', 'chain', 'safety collar', 'safety collars']

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string | string[] | undefined }>
}

interface ClientReadinessSummary {
  completionRate14d: number
  avgRpe14d: number | null
  completedSessions7d: number
  daysSinceLastCompleted: number | null
  readiness: 'high' | 'moderate' | 'low'
  recommendation: string
}

function isExcludedEquipmentName(name: string) {
  const normalized = String(name ?? '').trim().toLowerCase()
  return EXCLUDED_EQUIPMENT_TERMS.some(term => normalized.includes(term))
}

export default async function CoachClientPage({ params, searchParams }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { id } = await params
  const activeTab = normalizeCoachClientTab((await searchParams).tab)
  const admin = supabaseAdmin()

  // Fetch client info
  const { data: client, error: clientError } = await admin
    .from('clients')
    .select('id, email, full_name, phone, created_at, designated_coach_id')
    .eq('id', id)
    .single()

  if (clientError || !client || client.designated_coach_id !== user.id) notFound()

  // Fetch packages
  const { data: packages } = await admin
    .from('client_packages')
    .select('*')
    .eq('client_id', id)
    .order('purchased_at', { ascending: false })

  // Fetch all sessions (past + upcoming)
  const { data: sessions } = await admin
    .from('sessions')
    .select('id, scheduled_at, status, notes, duration_mins, package_id, checked_in_at, checked_out_at')
    .eq('client_id', id)
    .order('scheduled_at', { ascending: false })

  const [
    latestPlansResult,
    templatesResult,
    coachTemplatesResult,
    exercisesResult,
    equipmentResult,
    fitnessProfileResult,
    intakeFormResult,
    workoutLogsResult,
    workoutSetLogsResult,
    cardioLogsResult,
    progressPhotosResult,
  ] = await Promise.all([
    admin
      .from('workout_plans')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(1),
    admin
      .from('workout_program_templates')
      .select('id, title, slug, goal, nasm_opt_phase, phase_name, sessions_per_week, estimated_duration_mins, template_json')
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    admin
      .from('coach_program_templates')
      .select('id, coach_id, title, goal, nasm_opt_phase, phase_name, sessions_per_week, estimated_duration_mins, template_json')
      .eq('coach_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
    admin
      .from('exercise_library_entries')
      .select('id, name, slug, description, coaching_cues, primary_equipment, media_image_url, media_video_url')
      .eq('is_active', true)
      .eq('source', EXERCISE_LIBRARY_SOURCE)
      .order('name', { ascending: true })
      .limit(1000),
    admin
      .from('equipment_library_entries')
      .select('id, name, slug, description, media_image_url')
      .eq('is_active', true)
      .eq('source', EXERCISE_LIBRARY_SOURCE)
      .order('name', { ascending: true })
      .limit(250),
    admin
      .from('fitness_profiles')
      .select('equipment_access, cardio_equipment_access, injuries_limitations, preferred_units')
      .eq('user_id', id)
      .maybeSingle(),
    admin
      .from('client_intake_forms')
      .select('medical_conditions, surgeries_or_injuries')
      .eq('user_id', id)
      .maybeSingle(),
    admin
      .from('workout_logs')
      .select('session_date, completed, exertion_rpe')
      .eq('user_id', id)
      .order('session_date', { ascending: false })
      .limit(60),
    admin
      .from('workout_set_logs')
      .select('session_date, reps, weight_kg, rpe')
      .eq('user_id', id)
      .order('session_date', { ascending: false })
      .limit(240),
    admin
      .from('cardio_logs')
      .select('session_date, duration_mins, activity_type, distance_km, perceived_effort')
      .eq('user_id', id)
      .order('session_date', { ascending: false })
      .limit(40),
    admin
      .from('progress_photos')
      .select('id, photo_url, taken_at, notes, created_at')
      .eq('user_id', id)
      .order('taken_at', { ascending: false })
      .limit(24),
  ])

    const { data: weeklyCheckins } = await admin
      .from('weekly_checkins')
      .select('*')
      .eq('user_id', id)
      .order('week_start', { ascending: false })
      .limit(24)

  const contraindicationNotes = [
    String(fitnessProfileResult.data?.injuries_limitations ?? '').trim(),
    String(intakeFormResult.data?.medical_conditions ?? '').trim(),
    String(intakeFormResult.data?.surgeries_or_injuries ?? '').trim(),
  ].filter(Boolean)

  const now = new Date()
  const logs = workoutLogsResult.data ?? []
  const logsLast14d = logs.filter(log => {
    if (!log.session_date) return false
    const sessionDate = new Date(`${log.session_date}T00:00:00Z`)
    const diffDays = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays <= 14
  })
  const logsLast7d = logs.filter(log => {
    if (!log.session_date) return false
    const sessionDate = new Date(`${log.session_date}T00:00:00Z`)
    const diffDays = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays <= 7
  })

  const completed14d = logsLast14d.filter(log => Boolean(log.completed))
  const completed7d = logsLast7d.filter(log => Boolean(log.completed))
  const completionRate14d = logsLast14d.length > 0
    ? Math.round((completed14d.length / logsLast14d.length) * 100)
    : 0

  const rpeValues = completed14d
    .map(log => Number(log.exertion_rpe))
    .filter(value => Number.isFinite(value) && value > 0)
  const avgRpe14d = rpeValues.length > 0
    ? Number((rpeValues.reduce((sum, value) => sum + value, 0) / rpeValues.length).toFixed(1))
    : null

  const lastCompletedLog = logs.find(log => Boolean(log.completed) && Boolean(log.session_date))
  const daysSinceLastCompleted = lastCompletedLog?.session_date
    ? Math.max(0, Math.floor((now.getTime() - new Date(`${lastCompletedLog.session_date}T00:00:00Z`).getTime()) / (1000 * 60 * 60 * 24)))
    : null

  let readiness: ClientReadinessSummary['readiness'] = 'moderate'
  let recommendation = 'Use normal progression with standard check-ins this week.'

  if (completionRate14d >= 75 && (avgRpe14d === null || avgRpe14d <= 7.5)) {
    readiness = 'high'
    recommendation = 'Client appears ready for progressive overload and advanced sessions this week.'
  } else if (completionRate14d < 50 || (avgRpe14d !== null && avgRpe14d >= 8.5) || (daysSinceLastCompleted !== null && daysSinceLastCompleted >= 7)) {
    readiness = 'low'
    recommendation = 'Reduce complexity/intensity, prioritize adherence and recovery, and check barriers early.'
  }

  const readinessSummary: ClientReadinessSummary = {
    completionRate14d,
    avgRpe14d,
    completedSessions7d: completed7d.length,
    daysSinceLastCompleted,
    readiness,
    recommendation,
  }

  const setLogs = workoutSetLogsResult.data ?? []
  const cardioLogs = cardioLogsResult.data ?? []
  const clientUnits = fitnessProfileResult.data?.preferred_units === 'metric' ? 'metric' : 'imperial'

  const setLogsLast7d = setLogs.filter(log => {
    if (!log.session_date) return false
    const sessionDate = new Date(`${log.session_date}T00:00:00Z`)
    const diffDays = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays <= 7
  })
  const cardioLogsLast7d = cardioLogs.filter(log => {
    if (!log.session_date) return false
    const sessionDate = new Date(`${log.session_date}T00:00:00Z`)
    const diffDays = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays <= 7
  })

  const weeklySummary = {
    completedWorkouts: completed7d.length,
    totalSets: setLogsLast7d.length,
    totalReps: setLogsLast7d.reduce((sum, row) => sum + Number(row.reps ?? 0), 0),
    totalVolumeKg: Math.round(setLogsLast7d.reduce((sum, row) => sum + Number(row.reps ?? 0) * Number(row.weight_kg ?? 0), 0)),
    avgRpe: (() => {
      const rpeRows = setLogsLast7d.filter(row => Number(row.rpe ?? 0) > 0)
      if (rpeRows.length === 0) return null
      return Math.round((rpeRows.reduce((sum, row) => sum + Number(row.rpe ?? 0), 0) / rpeRows.length) * 10) / 10
    })(),
    cardioMinutes: cardioLogsLast7d.reduce((sum, row) => sum + Number(row.duration_mins ?? 0), 0),
    cardioSessions: cardioLogsLast7d.length,
  }
  const weeklyVolumeDisplay = clientUnits === 'imperial'
    ? Math.round(weeklySummary.totalVolumeKg * 2.20462)
    : weeklySummary.totalVolumeKg
  const weeklyVolumeUnitLabel = clientUnits === 'imperial' ? 'lb' : 'kg'

  const currentPhase = Number(latestPlansResult.data?.[0]?.nasm_opt_phase ?? 0)
  const phaseSuggestion = (() => {
    if (!currentPhase) {
      return {
        label: 'No active phase',
        tone: 'gray' as const,
        body: 'Generate or accept a plan before progression rules can apply.',
      }
    }

    if (completionRate14d >= 80 && (avgRpe14d === null || avgRpe14d <= 7.5) && currentPhase < 5) {
      return {
        label: `Advance to Phase ${String(currentPhase + 1)}`,
        tone: 'green' as const,
        body: 'Adherence and effort look stable enough to consider progressing this client to the next NASM phase.',
      }
    }

    if (completionRate14d < 50 || (avgRpe14d !== null && avgRpe14d >= 8.5)) {
      return {
        label: `Hold Phase ${String(currentPhase)}`,
        tone: 'red' as const,
        body: 'Keep the client in the current phase or reduce complexity until adherence and fatigue normalize.',
      }
    }

    return {
      label: `Maintain Phase ${String(currentPhase)}`,
      tone: 'gold' as const,
      body: 'Progress is steady, but the signal is not strong enough yet to auto-suggest a phase jump.',
    }
  })()

  const signedProgressPhotos = await Promise.all((progressPhotosResult.data ?? []).map(async photo => {
    const rawValue = String(photo.photo_url ?? '').trim()
    const storedPath = /^https?:\/\//i.test(rawValue)
      ? extractPhotoPathFromLegacyUrl(rawValue)
      : normalizePhotoPath(rawValue)
    const signedUrl = storedPath ? await createSignedFitnessPhotoUrl(admin, storedPath) : null

    return {
      ...photo,
      photo_url: signedUrl ?? rawValue,
    }
  }))

  const totalRemaining = (packages ?? []).reduce(
    (sum, p) => sum + (p.sessions_remaining ?? 0),
    0
  )

  const filteredEquipment = (equipmentResult.data ?? []).filter(item => !isExcludedEquipmentName(String(item.name ?? '')))

  const tabs: Array<{ key: CoachClientTab; label: string; href: string }> = [
    { key: 'overview', label: 'Overview', href: `/coach/clients/${id}` },
    { key: 'program', label: 'Program', href: `/coach/clients/${id}?tab=program` },
    { key: 'commerce', label: 'Commerce', href: `/coach/clients/${id}?tab=commerce` },
    { key: 'sessions', label: 'Sessions', href: `/coach/clients/${id}?tab=sessions` },
  ]
      const tabsWithCheckins: Array<{ key: CoachClientTab; label: string; href: string }> = [
      ...tabs,
      { key: 'checkins', label: 'Check-Ins', href: `/coach/clients/${id}?tab=checkins` },
    ]

    const liveSessionHref = `/coach/clients/${id}/live`

  return (
    <main className="coach-client-page" style={{ minHeight: '100vh', background: 'var(--navy)' }}>
      <SiteHeader
        badgeText="Coach Client View"
        links={[
          { href: '/coach', label: 'Coach Dashboard' },
          { href: `/coach/clients/${id}/messages`, label: 'Messages' },
        ]}
        actions={<LogoutButton />}
      />

      <div className="coach-client-content" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        <a
          href="/coach"
          className="sgf-shell-back"
        >
          ← Back to Clients
        </a>

        <div style={{ marginBottom: 20 }}>
          <div className="coach-client-top-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a
              href={`/coach/clients/${id}/messages`}
              className="sgf-button sgf-button-secondary"
            >
              Message Client
            </a>
            <CoachClientAssignmentButton clientId={id} mode="release" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
          {tabsWithCheckins.map(tab => {
            const active = activeTab === tab.key

            return (
              <a
                key={tab.key}
                href={tab.href}
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
          <a
            href={`/coach/clients/${id}/messages`}
            style={{
              padding: '10px 14px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'var(--navy-mid)',
              color: 'var(--white)',
              textDecoration: 'none',
              fontFamily: 'Raleway, sans-serif',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Messages
          </a>
          <a href={liveSessionHref} style={{ padding: '10px 14px', border: '1px solid rgba(72,187,120,0.35)', background: 'rgba(72,187,120,0.08)', color: 'var(--success)', textDecoration: 'none', fontFamily: 'Raleway, sans-serif', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>▶ Live Session</a>
        </div>

        {activeTab === 'overview' && (
          <>
            <div
              className="coach-client-info-grid"
              style={{
                background: 'var(--navy-mid)',
                border: '1px solid var(--navy-lt)',
                padding: '28px 32px',
                marginBottom: 24,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 24,
              }}
            >
              <div>
                <div style={infoLabelStyle}>Name</div>
                <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, color: 'var(--white)' }}>{client.full_name ?? '—'}</div>
              </div>
              <div>
                <div style={infoLabelStyle}>Email</div>
                <div style={{ fontFamily: 'Raleway, sans-serif', fontSize: 14, color: 'var(--white)', overflowWrap: 'anywhere' }}>{client.email}</div>
              </div>
              <div>
                <div style={infoLabelStyle}>Phone</div>
                <div style={{ fontFamily: 'Raleway, sans-serif', fontSize: 14, color: 'var(--white)', overflowWrap: 'anywhere' }}>{client.phone ?? '—'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
              <SummaryCard label="Sessions Remaining" value={String(totalRemaining)} hint="Across all purchased packages" />
              <SummaryCard label="Saved Program" value={latestPlansResult.data?.[0] ? 'Yes' : 'No'} hint={latestPlansResult.data?.[0]?.name ?? 'No program accepted yet'} />
              <SummaryCard label="Session History" value={String((sessions ?? []).length)} hint="Booked sessions on record" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
              <div style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 16 }}>
                <p style={{ margin: 0, color: 'var(--gray)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Auto Week Summary</p>
                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: 'var(--gray)', fontSize: 13 }}>Completed workouts</span><span style={{ color: 'var(--white)' }}>{weeklySummary.completedWorkouts}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: 'var(--gray)', fontSize: 13 }}>Logged sets</span><span style={{ color: 'var(--white)' }}>{weeklySummary.totalSets}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: 'var(--gray)', fontSize: 13 }}>Volume</span><span style={{ color: 'var(--white)' }}>{weeklyVolumeDisplay} {weeklyVolumeUnitLabel}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: 'var(--gray)', fontSize: 13 }}>Avg RPE</span><span style={{ color: 'var(--white)' }}>{weeklySummary.avgRpe ?? '-'}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span style={{ color: 'var(--gray)', fontSize: 13 }}>Cardio</span><span style={{ color: 'var(--white)' }}>{weeklySummary.cardioSessions} session{weeklySummary.cardioSessions === 1 ? '' : 's'} / {weeklySummary.cardioMinutes} min</span></div>
                </div>
              </div>

              <div style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 16 }}>
                <p style={{ margin: 0, color: 'var(--gray)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Phase Progression Suggestion</p>
                <div style={{ marginTop: 10, color: phaseSuggestion.tone === 'green' ? 'var(--success)' : phaseSuggestion.tone === 'red' ? 'var(--error)' : phaseSuggestion.tone === 'gold' ? 'var(--gold)' : 'var(--gray)', fontFamily: 'Bebas Neue, sans-serif', fontSize: 30, letterSpacing: '0.05em' }}>
                  {phaseSuggestion.label}
                </div>
                <p style={{ margin: '8px 0 0', color: 'var(--gray)', fontSize: 13, lineHeight: 1.5 }}>{phaseSuggestion.body}</p>
                <p style={{ margin: '10px 0 0', color: 'var(--gray)', fontSize: 12 }}>
                  14d completion: {completionRate14d}%{avgRpe14d !== null ? ` • Avg RPE ${avgRpe14d}` : ''}
                </p>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <ProgressPhotoTimeline
                initialPhotos={signedProgressPhotos}
                title="Progress Photo Timeline"
                subtitle="Recent physique check-ins for coach review."
              />
            </div>

            <div style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18 }}>
              <h2 style={sectionHeadingStyle}>Next Actions</h2>
              <div style={{ display: 'grid', gap: 10, color: 'var(--gray)', fontSize: 14 }}>
                <p style={{ margin: 0 }}>Use Program to generate a draft, review it, and accept only after edits are complete.</p>
                <p style={{ margin: 0 }}>Use Commerce for package and comp-session operations.</p>
                <p style={{ margin: 0 }}>Use Sessions for delivery and attendance history, or open Messages for direct communication.</p>
              </div>
            </div>
          </>
        )}

        {activeTab === 'program' && (
          <CoachProgramWorkspace
            clientId={id}
            latestPlan={latestPlansResult.data?.[0] ?? null}
            templates={templatesResult.data ?? []}
            coachTemplates={coachTemplatesResult.data ?? []}
            exercises={exercisesResult.data ?? []}
            equipment={filteredEquipment}
            contraindicationNotes={contraindicationNotes}
            readinessSummary={readinessSummary}
            initialEquipmentAccess={Array.isArray(fitnessProfileResult.data?.equipment_access)
              ? fitnessProfileResult.data.equipment_access
              : []}
            libraryEquipmentNames={filteredEquipment.map(item => String(item.name ?? '').trim()).filter(Boolean)}
            cardioEquipmentAccess={Array.isArray(fitnessProfileResult.data?.cardio_equipment_access)
              ? fitnessProfileResult.data.cardio_equipment_access
              : []}
          />
        )}

        {activeTab === 'commerce' && (
          <>
            <h2 style={sectionHeadingStyle}>Packages ({totalRemaining} sessions remaining)</h2>

            {!packages || packages.length === 0 ? (
              <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 14, color: 'var(--gray)', marginBottom: 40 }}>
                No packages purchased.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 40 }}>
                {packages.map(pkg => (
                  <div
                    key={pkg.id}
                    className="coach-client-package-row"
                    style={{
                      background: 'var(--navy-mid)',
                      padding: '16px 24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--white)' }}>
                        {pkg.package_name}
                      </div>
                      <div style={{ fontFamily: 'Raleway, sans-serif', fontSize: 12, color: 'var(--gray)', marginTop: 2 }}>
                        Purchased {new Date(pkg.purchased_at).toLocaleDateString()}
                      </div>
                      {(pkg.source === 'comp' || pkg.discount_code) && (
                        <div style={{ fontFamily: 'Raleway, sans-serif', fontSize: 12, color: 'var(--gray)', marginTop: 4 }}>
                          {pkg.source === 'comp' ? 'Comp grant' : 'Paid package'}
                          {pkg.discount_code ? ` · Discount ${pkg.discount_code}` : ''}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 28, color: 'var(--gold)' }}>{pkg.sessions_remaining}</span>
                      <span style={{ fontFamily: 'Raleway, sans-serif', fontSize: 12, color: 'var(--gray)', marginLeft: 4 }}>
                        / {pkg.sessions_total}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2 style={sectionHeadingStyle}>Commerce Tools</h2>
            <CoachCommerceTools clientId={id} />
          </>
        )}

        {activeTab === 'sessions' && (
          <>
            <h2 style={sectionHeadingStyle}>Sessions ({(sessions ?? []).length})</h2>
            <ClientDetailClient sessions={sessions ?? []} />
          </>
        )}

          {activeTab === 'checkins' && (
            <>
              <h2 style={sectionHeadingStyle}>Weekly Check-Ins</h2>
              <CoachCheckinReview clientId={id} initialCheckins={weeklyCheckins ?? []} />
            </>
          )}
      </div>
    </main>
  )
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 16 }}>
      <p style={{ margin: 0, color: 'var(--gray)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</p>
      <div style={{ marginTop: 8, color: 'var(--white)', fontFamily: 'Bebas Neue, sans-serif', fontSize: 30 }}>{value}</div>
      <p style={{ margin: '8px 0 0', color: 'var(--gray)', fontSize: 13, lineHeight: 1.5 }}>{hint}</p>
    </div>
  )
}

const infoLabelStyle: React.CSSProperties = {
  fontFamily: 'Raleway, sans-serif',
  fontWeight: 600,
  fontSize: 11,
  color: 'var(--gray)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 4,
}

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: 'Bebas Neue, sans-serif',
  fontSize: 22,
  color: 'var(--white)',
  letterSpacing: '0.06em',
  marginBottom: 14,
}
