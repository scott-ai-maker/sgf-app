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

type FitnessWorkspace = 'train' | 'analyze' | 'checkin'

function normalizeFitnessWorkspace(value: string | string[] | undefined): FitnessWorkspace {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === 'analyze') return 'analyze'
  if (raw === 'checkin') return 'checkin'
  return 'train'
}

interface FitnessTrackerPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function FitnessTrackerPage({ searchParams }: FitnessTrackerPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const [{ data: profile }, { data: plans }, { data: logs }, { data: setLogs }, { data: analyses }, { data: cardioLogs }, { data: progressPhotos }] = await Promise.all([
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
    supabase
      .from('progress_photos')
      .select('id, photo_url, taken_at, notes, created_at')
      .eq('user_id', user.id)
      .order('taken_at', { ascending: false })
      .limit(24),
  ])

  if (!profile?.onboarding_completed_at) {
    redirect('/dashboard/onboarding')
  }

  const params = await searchParams
  const workspace = normalizeFitnessWorkspace(params.workspace)

  const beforePhotoPath = normalizePhotoPath(
    profile.before_photo_path ?? extractPhotoPathFromLegacyUrl(profile.before_photo_url)
  )
  const signedBeforePhotoUrl = await createSignedFitnessPhotoUrl(supabase, beforePhotoPath)
  const profileWithSignedPhoto = {
    ...profile,
    before_photo_path: beforePhotoPath || null,
    before_photo_url: signedBeforePhotoUrl ?? null,
  }

  const signedProgressPhotos = await Promise.all((progressPhotos ?? []).map(async photo => {
    const storedPath = /^https?:\/\//i.test(String(photo.photo_url ?? '').trim())
      ? extractPhotoPathFromLegacyUrl(photo.photo_url)
      : normalizePhotoPath(photo.photo_url)
    const signedUrl = storedPath ? await createSignedFitnessPhotoUrl(supabase, storedPath) : null

    return {
      ...photo,
      photo_url: signedUrl ?? photo.photo_url,
    }
  }))

  return (
    <main className="dashboard-fitness-page" style={{ minHeight: '100vh', background: 'var(--navy)', padding: '26px 24px 40px' }}>
      <SiteHeader
        links={[
          { href: '/dashboard', label: 'Dashboard' },
          { href: '/dashboard/fitness?workspace=train', label: 'Train' },
          { href: '/dashboard/fitness?workspace=analyze', label: 'Analyze' },
          { href: '/dashboard/fitness?workspace=checkin', label: 'Check-In' },
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
          progressPhotos={signedProgressPhotos}
          initialWorkspace={workspace}
        />
      </div>
    </main>
  )
}
