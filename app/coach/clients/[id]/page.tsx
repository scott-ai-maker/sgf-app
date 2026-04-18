import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import LogoutButton from '@/components/auth/LogoutButton'
import ClientDetailClient from '@/components/coach/ClientDetailClient'
import CoachClientAssignmentButton from '@/components/coach/CoachClientAssignmentButton'
import CoachCommerceTools from '@/components/coach/CoachCommerceTools'
import CoachProgramWorkspace from '@/components/coach/CoachProgramWorkspace'
import SiteHeader from '@/components/ui/SiteHeader'

export const dynamic = 'force-dynamic'

const EXERCISE_LIBRARY_SOURCE = 'nasm_exercise_library'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string | string[] | undefined }>
}

type CoachClientTab = 'overview' | 'program' | 'commerce' | 'sessions'

function normalizeClientTab(value: string | string[] | undefined): CoachClientTab {
  const rawValue = Array.isArray(value) ? value[0] : value

  switch (rawValue) {
    case 'program':
    case 'commerce':
    case 'sessions':
      return rawValue
    default:
      return 'overview'
  }
}

export default async function CoachClientPage({ params, searchParams }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { id } = await params
  const activeTab = normalizeClientTab((await searchParams).tab)
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
    .select('id, scheduled_at, status, notes, duration_mins')
    .eq('client_id', id)
    .order('scheduled_at', { ascending: false })

  const [latestPlansResult, templatesResult, exercisesResult, equipmentResult, fitnessProfileResult] = await Promise.all([
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
      .select('equipment_access')
      .eq('user_id', id)
      .maybeSingle(),
  ])

  const totalRemaining = (packages ?? []).reduce(
    (sum, p) => sum + (p.sessions_remaining ?? 0),
    0
  )

  const tabs: Array<{ key: CoachClientTab; label: string; href: string }> = [
    { key: 'overview', label: 'Overview', href: `/coach/clients/${id}` },
    { key: 'program', label: 'Program', href: `/coach/clients/${id}?tab=program` },
    { key: 'commerce', label: 'Commerce', href: `/coach/clients/${id}?tab=commerce` },
    { key: 'sessions', label: 'Sessions', href: `/coach/clients/${id}?tab=sessions` },
  ]

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
          {tabs.map(tab => {
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
            exercises={exercisesResult.data ?? []}
            equipment={equipmentResult.data ?? []}
            initialEquipmentAccess={Array.isArray(fitnessProfileResult.data?.equipment_access)
              ? fitnessProfileResult.data.equipment_access
              : []}
            libraryEquipmentNames={(equipmentResult.data ?? []).map(item => String(item.name ?? '').trim()).filter(Boolean)}
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
