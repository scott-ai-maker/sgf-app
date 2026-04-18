import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestAuthz, requireRole, requireCoachAssignedClient, AuthzError } from '@/lib/authz'
import { buildStoredProgramPlan, type CoachProgramDraft, type EquipmentLibraryRecord, type ExerciseLibraryRecord, type CoachProgramPayload, type CoachProgramWorkoutInput, type WorkoutProgramTemplateRecord } from '@/lib/coach-programs'

const EXERCISE_LIBRARY_SOURCE = 'nasm_exercise_library'

function normalizeEquipmentAccess(items: string[]) {
  return [...new Set(items.map(item => String(item ?? '').trim().toLowerCase()).filter(Boolean))]
}

function exerciseMatchesEquipment(exercise: ExerciseLibraryRecord, equipmentAccess: string[]) {
  if (equipmentAccess.length === 0) return true

  const normalizedEquipment = (Array.isArray(exercise.primary_equipment) ? exercise.primary_equipment : [])
    .map(item => String(item ?? '').trim().toLowerCase())
    .filter(Boolean)

  if (normalizedEquipment.length === 0) {
    return equipmentAccess.includes('bodyweight')
  }

  return normalizedEquipment.some(item => {
    if (item.includes('bodyweight') || item === 'none') return equipmentAccess.includes('bodyweight')
    if (item.includes('dumbbell')) return equipmentAccess.includes('dumbbells')
    if (item.includes('barbell')) return equipmentAccess.includes('barbell')
    if (item.includes('bench')) return equipmentAccess.includes('bench')
    if (item.includes('cable')) return equipmentAccess.includes('cable-machine')
    if (item.includes('machine') || item.includes('smith') || item.includes('lever') || item.includes('press')) return equipmentAccess.includes('machines')
    if (item.includes('kettlebell')) return equipmentAccess.includes('kettlebells')
    if (item.includes('band') || item.includes('tube') || item.includes('strap')) return equipmentAccess.includes('bands')
    if (item.includes('trx') || item.includes('suspension')) return equipmentAccess.includes('trx')
    if (item.includes('medicine ball') || item.includes('stability ball')) return equipmentAccess.includes('medicine-ball')
    return true
  })
}

function phasePrescription(nasmOptPhase: number) {
  switch (nasmOptPhase) {
    case 1:
      return { sets: '2-3', reps: '12-20', tempo: '4/2/1', rest: '0-90s' }
    case 2:
      return { sets: '2-4', reps: '8-12', tempo: '2/0/2', rest: '0-60s' }
    case 3:
      return { sets: '3-5', reps: '6-12', tempo: '2/0/2', rest: '30-60s' }
    case 4:
      return { sets: '4-6', reps: '1-5', tempo: 'x/x/x', rest: '3-5m' }
    case 5:
      return { sets: '3-5', reps: '1-10', tempo: 'x/x/x', rest: '1-2m' }
    default:
      return { sets: '3', reps: '8-12', tempo: '2/0/2', rest: '60s' }
  }
}

function buildRandomizedTemplateWorkouts({
  template,
  exercises,
  sessionsPerWeek,
  equipmentAccess,
}: {
  template: WorkoutProgramTemplateRecord
  exercises: ExerciseLibraryRecord[]
  sessionsPerWeek: number
  equipmentAccess: string[]
}) {
  const normalizedEquipmentAccess = normalizeEquipmentAccess(equipmentAccess)
  const filteredExercises = exercises.filter(exercise => exerciseMatchesEquipment(exercise, normalizedEquipmentAccess))
  const pool = filteredExercises.length > 0 ? filteredExercises : exercises
  const prescription = phasePrescription(Number(template.nasm_opt_phase ?? 1))
  const templateWorkouts: CoachProgramWorkoutInput[] = Array.isArray(template.template_json?.workouts) && template.template_json.workouts.length > 0
    ? template.template_json.workouts.slice(0, Math.max(1, sessionsPerWeek))
    : Array.from({ length: Math.max(1, sessionsPerWeek) }, (_, index) => ({ day: index + 1, focus: `Training Day ${index + 1}`, scheduledDate: null, notes: null, exercises: [] }))

  return templateWorkouts.map((workout, workoutIndex) => {
    const dayFocus = String(workout.focus ?? `Training Day ${workoutIndex + 1}`).trim() || `Training Day ${workoutIndex + 1}`
    const dayExerciseCount = Math.min(6, Math.max(4, pool.length > 0 ? 5 : 0))
    const dayExercises = Array.from({ length: dayExerciseCount }, (_, exerciseIndex) => {
      const selected = pool[(workoutIndex * dayExerciseCount + exerciseIndex) % pool.length]

      return {
        libraryExerciseId: selected?.id ?? null,
        name: selected?.name ?? `Exercise ${exerciseIndex + 1}`,
        sets: prescription.sets,
        reps: prescription.reps,
        tempo: prescription.tempo,
        rest: prescription.rest,
        notes: null,
      }
    })

    return {
      day: Number(workout.day) || workoutIndex + 1,
      focus: dayFocus,
      scheduledDate: String(workout.scheduledDate ?? '').trim() || null,
      notes: String(workout.notes ?? '').trim() || null,
      exercises: dayExercises,
    }
  })
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
  const clientId = String(body.clientId ?? '').trim()
  const sessionsPerWeek = Number(body.sessionsPerWeek)
  const nasmOptPhase = Number(body.nasmOptPhase)
  const requestedEquipmentAccess = Array.isArray(body.equipmentAccess)
    ? body.equipmentAccess.map((item: unknown) => String(item ?? '').trim().toLowerCase()).filter(Boolean)
    : []

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

  const selectedPhase = Number.isFinite(nasmOptPhase)
    ? Math.max(1, Math.min(5, Math.round(nasmOptPhase)))
    : null

  const [templatesResult, exercisesResult, equipmentResult] = await Promise.all([
    admin
      .from('workout_program_templates')
      .select('id, title, slug, goal, nasm_opt_phase, phase_name, sessions_per_week, estimated_duration_mins, template_json')
      .eq('is_active', true)
      .eq('nasm_opt_phase', selectedPhase ?? 1)
      .order('created_at', { ascending: false }),
    admin
      .from('exercise_library_entries')
      .select('id, name, slug, description, coaching_cues, primary_equipment, media_image_url, media_video_url, metadata_json')
      .eq('is_active', true)
      .eq('source', EXERCISE_LIBRARY_SOURCE)
      .limit(3000),
    admin
      .from('equipment_library_entries')
      .select('id, name, slug, description, media_image_url')
      .eq('is_active', true)
      .eq('source', EXERCISE_LIBRARY_SOURCE),
  ])

  const templates = (templatesResult.data ?? []) as WorkoutProgramTemplateRecord[]

  if (templates.length === 0) {
    return NextResponse.json({ error: `No active workout templates found for Phase ${selectedPhase ?? 1}.` }, { status: 400 })
  }

  const selectedTemplate = templates[Math.floor(Math.random() * templates.length)]

  if (!selectedTemplate) {
    return NextResponse.json({ error: 'Could not select a workout template.' }, { status: 400 })
  }

  const resolvedSessionsPerWeek = Number.isFinite(sessionsPerWeek)
    ? sessionsPerWeek
    : Number(selectedTemplate.sessions_per_week ?? profile.training_days_per_week ?? 3)

  const effectiveEquipmentAccess = requestedEquipmentAccess.length > 0
    ? requestedEquipmentAccess
    : Array.isArray(profile.equipment_access)
      ? profile.equipment_access
      : []

  const randomizedWorkouts = buildRandomizedTemplateWorkouts({
    template: selectedTemplate,
    exercises: (exercisesResult.data ?? []) as ExerciseLibraryRecord[],
    sessionsPerWeek: resolvedSessionsPerWeek,
    equipmentAccess: effectiveEquipmentAccess,
  })

  if (randomizedWorkouts.length === 0) {
    return NextResponse.json({ error: 'Unable to build a randomized workout from the selected template.' }, { status: 400 })
  }

  const payload: CoachProgramPayload = {
    clientId,
    name: `${selectedTemplate.title} Quick Plan`,
    goal: selectedTemplate.goal ?? profile.fitness_goal ?? null,
    nasmOptPhase: Number(selectedTemplate.nasm_opt_phase ?? 1),
    phaseName: String(selectedTemplate.phase_name ?? 'Custom Phase'),
    sessionsPerWeek: Math.max(1, Math.min(7, resolvedSessionsPerWeek)),
    estimatedDurationMins: Number(selectedTemplate.estimated_duration_mins ?? 60),
    startDate: null,
    templateId: selectedTemplate.id,
    workouts: randomizedWorkouts,
  }

  const storedPlan = buildStoredProgramPlan(
    payload,
    (exercisesResult.data ?? []) as ExerciseLibraryRecord[],
    (equipmentResult.data ?? []) as EquipmentLibraryRecord[]
  )

  if (storedPlan.workouts.length === 0) {
    return NextResponse.json({ error: 'No valid workouts were generated from template rules.' }, { status: 400 })
  }

  const generatedWithEquipmentAccess = [...new Set(['bodyweight', ...effectiveEquipmentAccess])]

  const draft: CoachProgramDraft = {
    clientId,
    name: payload.name,
    goal: payload.goal,
    nasmOptPhase: Math.max(1, Math.min(5, Number(payload.nasmOptPhase))),
    phaseName: payload.phaseName,
    sessionsPerWeek: payload.sessionsPerWeek,
    estimatedDurationMins: payload.estimatedDurationMins,
    startDate: payload.startDate,
    templateId: selectedTemplate.id,
    templateTitle: selectedTemplate.title,
    generatedAt: storedPlan.createdAt,
    generatedWithEquipmentAccess,
    workouts: storedPlan.workouts,
  }

  return NextResponse.json({
    draft,
    template: {
      id: selectedTemplate.id,
      title: selectedTemplate.title,
    },
  })
}
