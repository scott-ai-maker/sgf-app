import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  let authz

  try {
    authz = await getRequestAuthz(req)
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const admin = supabaseAdmin()

  if (authz.client.role === 'coach') {
    const [{ count: assignedCount }, { count: unassignedCount }] = await Promise.all([
      admin
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('designated_coach_id', authz.user.id)
        .eq('role', 'client'),
      admin
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .is('designated_coach_id', null)
        .eq('role', 'client'),
    ])

    return NextResponse.json({
      role: 'coach',
      user: {
        id: authz.user.id,
        email: authz.user.email ?? '',
      },
      metrics: {
        assignedClients: assignedCount ?? 0,
        unassignedClients: unassignedCount ?? 0,
      },
    })
  }

  const [{ data: packages }, { data: upcomingSessions }] = await Promise.all([
    admin
      .from('client_packages')
      .select('id, package_name, sessions_remaining, purchased_at')
      .eq('client_id', authz.user.id)
      .order('purchased_at', { ascending: false }),
    admin
      .from('sessions')
      .select('id, scheduled_at, status, duration_minutes')
      .eq('client_id', authz.user.id)
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10),
  ])

  const totalRemaining = (packages ?? []).reduce(
    (sum, current) => sum + Number(current.sessions_remaining ?? 0),
    0
  )

  return NextResponse.json({
    role: 'client',
    user: {
      id: authz.user.id,
      email: authz.user.email ?? '',
    },
    packages: packages ?? [],
    upcomingSessions: upcomingSessions ?? [],
    metrics: {
      packageCount: packages?.length ?? 0,
      sessionsRemaining: totalRemaining,
      upcomingSessionCount: upcomingSessions?.length ?? 0,
    },
  })
}
