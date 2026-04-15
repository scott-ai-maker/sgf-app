import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import FitnessTrackerClient from '@/components/fitness/FitnessTrackerClient'

export const dynamic = 'force-dynamic'

export default async function FitnessTrackerPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const [{ data: profile }, { data: plans }, { data: logs }, { data: setLogs }, { data: analyses }] = await Promise.all([
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
  ])

  if (!profile?.onboarding_completed_at) {
    redirect('/dashboard/onboarding')
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--navy)', padding: '26px 24px 40px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 46, letterSpacing: '0.05em', margin: 0 }}>Fitness Lab</h1>
            <p style={{ color: 'var(--gray)', margin: '6px 0 0' }}>Build your NASM OPT plan, track sessions, and visualize your goal outcome.</p>
          </div>
          <a href="/dashboard" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>Back to Dashboard</a>
        </div>

        <FitnessTrackerClient
          profile={profile}
          latestPlan={plans?.[0] ?? null}
          logs={logs ?? []}
          setLogs={setLogs ?? []}
          latestAnalysis={analyses?.[0] ?? null}
        />
      </div>
    </main>
  )
}
