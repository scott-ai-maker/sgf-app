import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, requireRole, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  let coachId = ''
  try {
    const authz = await getRequestAuthz(req)
    requireRole(authz.client.role, ['coach'])
    coachId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const admin = supabaseAdmin()

  const { data: assignedClients, error } = await admin
    .from('clients')
    .select('id, email, full_name, role, designated_coach_id')
    .eq('designated_coach_id', coachId)
    .eq('role', 'client')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 })
  }

  const clientIds = (assignedClients ?? []).map((c) => c.id)

  if (clientIds.length === 0) {
    return NextResponse.json({ clients: [] })
  }

  const [packagesResult, profilesResult, checkinsResult] = await Promise.all([
    admin
      .from('client_packages')
      .select('client_id, sessions_remaining')
      .in('client_id', clientIds)
      .eq('is_active', true),
    admin
      .from('fitness_profiles')
      .select('user_id, onboarding_completed_at')
      .in('user_id', clientIds),
    admin
      .from('weekly_checkins')
      .select('user_id, created_at')
      .in('user_id', clientIds)
      .order('created_at', { ascending: false }),
  ])

  const sessionsMap = new Map<string, number>()
  for (const pkg of packagesResult.data ?? []) {
    const current = sessionsMap.get(pkg.client_id) ?? 0
    sessionsMap.set(pkg.client_id, current + (pkg.sessions_remaining ?? 0))
  }

  const onboardingMap = new Map<string, string>()
  for (const fp of profilesResult.data ?? []) {
    if (fp.onboarding_completed_at && !onboardingMap.has(fp.user_id)) {
      onboardingMap.set(fp.user_id, fp.onboarding_completed_at)
    }
  }

  const checkinMap = new Map<string, string>()
  for (const ci of checkinsResult.data ?? []) {
    if (!checkinMap.has(ci.user_id)) {
      checkinMap.set(ci.user_id, ci.created_at)
    }
  }

  const clients = (assignedClients ?? []).map((c) => ({
    id: c.id,
    email: c.email,
    full_name: c.full_name,
    role: c.role,
    designated_coach_id: c.designated_coach_id,
    onboarding_completed_at: onboardingMap.get(c.id) ?? null,
    sessions_remaining: sessionsMap.get(c.id) ?? 0,
    last_checkin_date: checkinMap.get(c.id) ?? null,
  }))

  return NextResponse.json({ clients })
}
