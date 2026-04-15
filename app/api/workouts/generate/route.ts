import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateNasmOptPlan } from '@/lib/fitness'
import { getRequestAuthz, requireRole, AuthzError } from '@/lib/authz'

export async function POST(req: NextRequest) {
  let userId = ''
  try {
    const authz = await getRequestAuthz()
    requireRole(authz.client.role, ['client'])
    userId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('fitness_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Complete onboarding first.' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const sessionsOverride = Number(body.sessionsPerWeek || profile.training_days_per_week || 3)

  const plan = generateNasmOptPlan({
    experienceLevel: profile.experience_level,
    trainingDaysPerWeek: Number.isFinite(sessionsOverride) ? sessionsOverride : 3,
    fitnessGoal: profile.fitness_goal,
    workoutLocation: profile.workout_location,
    equipmentAccess: Array.isArray(profile.equipment_access) ? profile.equipment_access : [],
  })

  const row = {
    user_id: userId,
    name: `${plan.phaseName} Plan`,
    goal: profile.fitness_goal,
    nasm_opt_phase: plan.phase,
    phase_name: plan.phaseName,
    sessions_per_week: plan.sessionsPerWeek,
    estimated_duration_mins: plan.estimatedDurationMins,
    plan_json: plan,
  }

  const { data, error } = await supabaseAdmin()
    .from('workout_plans')
    .insert(row)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ plan: data })
}
