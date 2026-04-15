import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
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

  const body = await req.json()

  if (!body.sessionDate || !body.exerciseName || !body.reps) {
    return NextResponse.json({ error: 'sessionDate, exerciseName, and reps are required' }, { status: 400 })
  }

  const payload = {
    user_id: userId,
    workout_log_id: body.workoutLogId ?? null,
    workout_plan_id: body.workoutPlanId ?? null,
    session_date: body.sessionDate,
    exercise_name: body.exerciseName,
    set_number: body.setNumber ? Number(body.setNumber) : null,
    reps: Number(body.reps),
    weight_kg: body.weightKg ? Number(body.weightKg) : null,
    rest_seconds: body.restSeconds ? Number(body.restSeconds) : null,
    rpe: body.rpe ? Number(body.rpe) : null,
    rir: body.rir ? Number(body.rir) : null,
    tempo: body.tempo ?? null,
    is_warmup: Boolean(body.isWarmup),
    notes: body.notes ?? null,
  }

  const { data, error } = await supabaseAdmin()
    .from('workout_set_logs')
    .insert(payload)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ setLog: data })
}
