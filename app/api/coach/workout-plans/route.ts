import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, requireCoachAssignedClient, requireRole, AuthzError } from '@/lib/authz'
import {
  buildPlanName,
  buildStoredProgramPlan,
  type CoachProgramPayload,
  type EquipmentLibraryRecord,
  type ExerciseLibraryRecord,
} from '@/lib/coach-programs'
import { supabaseAdmin } from '@/lib/supabase'

function parsePayload(body: Record<string, unknown>): CoachProgramPayload | null {
  const workouts = Array.isArray(body.workouts) ? body.workouts : []
  const name = String(body.name ?? '').trim()
  const phaseName = String(body.phaseName ?? '').trim()
  const clientId = String(body.clientId ?? '').trim()
  const nasmOptPhase = Number(body.nasmOptPhase)
  const sessionsPerWeek = Number(body.sessionsPerWeek)
  const estimatedDurationMins = Number(body.estimatedDurationMins)

  if (!clientId || !phaseName || !Number.isFinite(nasmOptPhase) || !Number.isFinite(sessionsPerWeek) || !Number.isFinite(estimatedDurationMins)) {
    return null
  }

  return {
    clientId,
    name,
    goal: String(body.goal ?? '').trim() || null,
    nasmOptPhase,
    phaseName,
    sessionsPerWeek,
    estimatedDurationMins,
    startDate: String(body.startDate ?? '').trim() || null,
    templateId: String(body.templateId ?? '').trim() || null,
    workouts,
  }
}

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
  const payload = parsePayload(body)

  if (!payload) {
    return NextResponse.json({ error: 'Invalid workout plan payload.' }, { status: 400 })
  }

  if (!Array.isArray(payload.workouts) || payload.workouts.length === 0) {
    return NextResponse.json({ error: 'Add at least one training day.' }, { status: 400 })
  }

  try {
    await requireCoachAssignedClient(coachId, payload.clientId)
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Forbidden'
    return NextResponse.json({ error: message }, { status })
  }

  const admin = supabaseAdmin()

  const exerciseIds = payload.workouts.flatMap(workout =>
    Array.isArray(workout.exercises)
      ? workout.exercises
          .map(exercise => String(exercise.libraryExerciseId ?? '').trim())
          .filter(Boolean)
      : []
  )

  const exerciseNames = payload.workouts.flatMap(workout =>
    Array.isArray(workout.exercises)
      ? workout.exercises
          .map(exercise => String(exercise.name ?? '').trim())
          .filter(Boolean)
      : []
  )

  const [{ data: exercisesById }, { data: exercisesByName }, { data: equipmentData }] = await Promise.all([
    exerciseIds.length
      ? admin
          .from('exercise_library_entries')
          .select('id, name, slug, description, coaching_cues, primary_equipment, media_image_url, media_video_url')
          .in('id', exerciseIds)
      : Promise.resolve({ data: [] as ExerciseLibraryRecord[] }),
    exerciseNames.length
      ? admin
          .from('exercise_library_entries')
          .select('id, name, slug, description, coaching_cues, primary_equipment, media_image_url, media_video_url')
          .in('name', exerciseNames)
      : Promise.resolve({ data: [] as ExerciseLibraryRecord[] }),
    admin
      .from('equipment_library_entries')
      .select('id, name, slug, description, media_image_url')
      .eq('is_active', true),
  ])

  const exerciseMap = new Map<string, ExerciseLibraryRecord>()
  for (const exercise of [...(exercisesById ?? []), ...(exercisesByName ?? [])] as ExerciseLibraryRecord[]) {
    exerciseMap.set(exercise.id, exercise)
  }

  const storedPlan = buildStoredProgramPlan(
    payload,
    [...exerciseMap.values()],
    (equipmentData ?? []) as EquipmentLibraryRecord[]
  )

  if (storedPlan.workouts.length === 0) {
    return NextResponse.json({ error: 'Add at least one exercise to a training day.' }, { status: 400 })
  }

  const row = {
    user_id: payload.clientId,
    name: buildPlanName(payload),
    goal: payload.goal,
    nasm_opt_phase: Math.max(1, Math.min(5, Number(payload.nasmOptPhase))),
    phase_name: payload.phaseName,
    sessions_per_week: Math.max(1, Math.min(7, Number(payload.sessionsPerWeek))),
    estimated_duration_mins: Math.max(15, Math.min(240, Number(payload.estimatedDurationMins))),
    plan_json: {
      ...storedPlan,
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