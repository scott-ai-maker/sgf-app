import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateNasmOptPlan } from '@/lib/fitness'
import { getRequestAuthz, requireRole, requireCoachAssignedClient, AuthzError } from '@/lib/authz'

export async function POST(req: NextRequest) {
  let coachId = ''
  try {
    const authz = await getRequestAuthz()
    requireRole(authz.client.role, ['coach'])
    coachId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const body = await req.json().catch(() => ({}))
  const clientId = String(body.clientId ?? '').trim()
  const sessionsPerWeek = Number(body.sessionsPerWeek)

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  try {
    await requireCoachAssignedClient(coachId, clientId)
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Forbidden'
    return NextResponse.json({ error: message }, { status })
  }

  const admin = supabaseAdmin()

  const { data: profile } = await admin
    .from('fitness_profiles')
    .select('*')
    .eq('user_id', clientId)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Client onboarding profile not found.' }, { status: 404 })
  }

  const plan = generateNasmOptPlan({
    experienceLevel: profile.experience_level,
    trainingDaysPerWeek: Number.isFinite(sessionsPerWeek)
      ? sessionsPerWeek
      : Number(profile.training_days_per_week ?? 3),
    fitnessGoal: profile.fitness_goal,
    workoutLocation: profile.workout_location,
    equipmentAccess: Array.isArray(profile.equipment_access) ? profile.equipment_access : [],
  })

  const row = {
    user_id: clientId,
    name: `${plan.phaseName} Plan`,
    goal: profile.fitness_goal,
    nasm_opt_phase: plan.phase,
    phase_name: plan.phaseName,
    sessions_per_week: plan.sessionsPerWeek,
    estimated_duration_mins: plan.estimatedDurationMins,
    plan_json: {
      ...plan,
      generatedByCoachId: coachId,
      generatedBy: 'coach',
    },
  }

  const { data, error } = await admin
    .from('workout_plans')
    .insert(row)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ plan: data })
}
