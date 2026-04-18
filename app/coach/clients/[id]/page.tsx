import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import LogoutButton from '@/components/auth/LogoutButton'
import ClientDetailClient from '@/components/coach/ClientDetailClient'
import CoachProgramBuilder from '@/components/coach/CoachProgramBuilder'
import CoachClientAssignmentButton from '@/components/coach/CoachClientAssignmentButton'
import GenerateClientPlanButton from '@/components/coach/GenerateClientPlanButton'
import CoachCommerceTools from '@/components/coach/CoachCommerceTools'
import SiteHeader from '@/components/ui/SiteHeader'

export const dynamic = 'force-dynamic'

const EXERCISE_LIBRARY_SOURCE = 'nasm_exercise_library'

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

        {/* Client info */}
        <div
          className="coach-client-info-grid"
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
            <div style={{ fontFamily: 'Raleway, sans-serif', fontSize: 14, color: 'var(--white)', overflowWrap: 'anywhere' }}>
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
            <div style={{ fontFamily: 'Raleway, sans-serif', fontSize: 14, color: 'var(--white)', overflowWrap: 'anywhere' }}>
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
                  {(pkg.source === 'comp' || pkg.discount_code) && (
                    <div style={{ fontFamily: 'Raleway, sans-serif', fontSize: 12, color: 'var(--gray)', marginTop: 4 }}>
                      {pkg.source === 'comp' ? 'Comp grant' : 'Paid package'}
                      {pkg.discount_code ? ` · Discount ${pkg.discount_code}` : ''}
                    </div>
                  )}
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

        <h2
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 22,
            color: 'var(--white)',
            letterSpacing: '0.06em',
            marginBottom: 14,
          }}
        >
          COMMERCE TOOLS
        </h2>

        <CoachCommerceTools clientId={id} />

        {/* Sessions */}
        <div style={{ marginBottom: 14 }}>
          <GenerateClientPlanButton
            clientId={id}
            initialEquipmentAccess={Array.isArray(fitnessProfileResult.data?.equipment_access)
              ? fitnessProfileResult.data.equipment_access
              : []}
            libraryEquipmentNames={(equipmentResult.data ?? []).map(item => String(item.name ?? '').trim()).filter(Boolean)}
          />
        </div>

        <CoachProgramBuilder
          clientId={id}
          latestPlan={latestPlansResult.data?.[0] ?? null}
          templates={templatesResult.data ?? []}
          exercises={exercisesResult.data ?? []}
          equipment={equipmentResult.data ?? []}
        />

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
