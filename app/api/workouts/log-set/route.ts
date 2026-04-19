import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestAuthz, requireRole, AuthzError } from '@/lib/authz'

function normalizeExerciseName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function extractPlanExerciseNames(planJson: unknown) {
  if (!planJson || typeof planJson !== 'object') return [] as string[]

  const workouts = (planJson as { workouts?: unknown }).workouts
  if (!Array.isArray(workouts)) return [] as string[]

  const names: string[] = []

  for (const workout of workouts) {
    const exercises =
      workout && typeof workout === 'object'
        ? (workout as { exercises?: unknown }).exercises
        : null

    if (!Array.isArray(exercises)) continue

    for (const exercise of exercises) {
      const name =
        exercise && typeof exercise === 'object'
          ? (exercise as { name?: unknown }).name
          : null

      if (typeof name === 'string' && name.trim()) {
        names.push(normalizeExerciseName(name))
      }
    }
  }

  return names
}

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

  if (!body.workoutPlanId || !body.sessionDate || !body.exerciseName || !body.reps) {
    return NextResponse.json({ error: 'workoutPlanId, sessionDate, exerciseName, and reps are required' }, { status: 400 })
  }

  const reps = Number(body.reps)
  if (!Number.isFinite(reps) || reps <= 0) {
    return NextResponse.json({ error: 'reps must be a positive number' }, { status: 400 })
  }

  const normalizedExercise = normalizeExerciseName(String(body.exerciseName))
  if (!normalizedExercise) {
    return NextResponse.json({ error: 'exerciseName is required' }, { status: 400 })
  }

  const { data: plan, error: planError } = await supabaseAdmin()
    .from('workout_plans')
    .select('id, user_id, plan_json')
    .eq('id', body.workoutPlanId)
    .eq('user_id', userId)
    .maybeSingle()

  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 })

  if (!plan) {
    return NextResponse.json({ error: 'Workout plan not found for this client' }, { status: 403 })
  }

  const allowedExerciseNames = new Set(extractPlanExerciseNames(plan.plan_json))
  if (!allowedExerciseNames.has(normalizedExercise)) {
    return NextResponse.json({ error: 'Exercise is not part of your assigned workout plan' }, { status: 403 })
  }

  const payload = {
    user_id: userId,
    workout_log_id: body.workoutLogId ?? null,
    workout_plan_id: plan.id,
    session_date: body.sessionDate,
    exercise_name: body.exerciseName,
    set_number: body.setNumber ? Number(body.setNumber) : null,
    reps,
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
