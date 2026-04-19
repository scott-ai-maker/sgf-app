import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import LogoutButton from '@/components/auth/LogoutButton'
import SiteHeader from '@/components/ui/SiteHeader'
import LiveSessionClient from '@/components/coach/LiveSessionClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CoachLiveSessionPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { id: clientId } = await params
  const admin = supabaseAdmin()

  const { data: client } = await admin
    .from('clients')
    .select('id, full_name, email, designated_coach_id')
    .eq('id', clientId)
    .single()

  if (!client || client.designated_coach_id !== user.id) notFound()

  // Get active plan
  const { data: plan } = await admin
    .from('workout_plans')
    .select('id, name, plan_json')
    .eq('user_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Get today's set logs
  const today = new Date().toISOString().slice(0, 10)
  const { data: todaySets } = await admin
    .from('workout_set_logs')
    .select('*')
    .eq('user_id', clientId)
    .eq('session_date', today)
    .order('created_at', { ascending: true })

  return (
    <main style={{ minHeight: '100vh', background: 'var(--navy)' }}>
      <SiteHeader
        badgeText="Live Session"
        links={[
          { href: '/coach', label: 'Coach Dashboard' },
          { href: `/coach/clients/${clientId}`, label: 'Back to Client' },
        ]}
        actions={<LogoutButton />}
      />

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 36, letterSpacing: '0.05em', margin: '0 0 4px', color: 'var(--white)' }}>
            Live Session
          </h1>
          <p style={{ margin: 0, color: 'var(--gray)', fontSize: 14 }}>
            {client.full_name ?? client.email} · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <LiveSessionClient
          clientId={clientId}
          plan={plan ?? null}
          initialSets={todaySets ?? []}
          today={today}
        />
      </div>
    </main>
  )
}
