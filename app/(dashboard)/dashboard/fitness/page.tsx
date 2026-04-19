import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import FitnessTrackerClient from '@/components/fitness/FitnessTrackerClient'
import LogoutButton from '@/components/auth/LogoutButton'
import SiteHeader from '@/components/ui/SiteHeader'
import {
  createSignedFitnessPhotoUrl,
  extractPhotoPathFromLegacyUrl,
  normalizePhotoPath,
} from '@/lib/fitness-photos'

export const dynamic = 'force-dynamic'

export default async function FitnessTrackerPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const [{ data: profile }, { data: plans }, { data: logs }, { data: setLogs }, { data: analyses }, { data: cardioLogs }] = await Promise.all([
    supabase.from('fitness_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('workout_plans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    supabase.from('workout_logs').select('*').eq('user_id', user.id).order('session_date', { ascending: false }).limit(8),
    supabase.from('workout_set_logs').select('*').eq('user_id', user.id).order('session_date', { ascending: false }).limit(240),
    supabase
      .from('body_composition_analyses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('cardio_logs')
      .select('id, session_date, activity_type, duration_mins, distance_km, avg_heart_rate, perceived_effort')
      .eq('user_id', user.id)
      .order('session_date', { ascending: false })
      .limit(20),
  ])

  if (!profile?.onboarding_completed_at) {
    redirect('/dashboard/onboarding')
  }

  const beforePhotoPath = normalizePhotoPath(
    profile.before_photo_path ?? extractPhotoPathFromLegacyUrl(profile.before_photo_url)
  )
  const signedBeforePhotoUrl = await createSignedFitnessPhotoUrl(supabase, beforePhotoPath)
  const profileWithSignedPhoto = {
    ...profile,
    before_photo_path: beforePhotoPath || null,
    before_photo_url: signedBeforePhotoUrl ?? null,
  }

  return (
    <main className="dashboard-fitness-page" style={{ minHeight: '100vh', background: 'var(--navy)', padding: '26px 24px 40px' }}>
      <SiteHeader
        links={[
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/dashboard/book', label: 'Book Session' },
          { href: '/dashboard/messages', label: 'Messages' },
        ]}
        badgeText="Fitness Lab"
        actions={<LogoutButton />}
      />
      <div className="dashboard-fitness-content" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 46, letterSpacing: '0.05em', margin: 0 }}>Fitness Lab</h1>
            <p style={{ color: 'var(--gray)', margin: '6px 0 0' }}>Follow your training plan, track sessions, and visualize your progress.</p>
          </div>
          <a href="/dashboard" className="sgf-shell-back" style={{ marginBottom: 0 }}>← Back to Dashboard</a>
        </div>

        <FitnessTrackerClient
          profile={profileWithSignedPhoto}
          latestPlan={plans?.[0] ?? null}
          logs={logs ?? []}
          setLogs={setLogs ?? []}
          latestAnalysis={analyses?.[0] ?? null}
          cardioLogs={cardioLogs ?? []}
        />
      </div>
    </main>
  )
}
