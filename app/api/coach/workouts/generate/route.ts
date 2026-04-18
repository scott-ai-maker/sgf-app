import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestAuthz, requireRole, requireCoachAssignedClient, AuthzError } from '@/lib/authz'
import { buildPlanName, buildStoredProgramPlan, type EquipmentLibraryRecord, type ExerciseLibraryRecord, type CoachProgramPayload, type WorkoutProgramTemplateRecord } from '@/lib/coach-programs'
import { buildRandomizedTemplateWorkouts } from '@/lib/coach-template-generator'

const EXERCISE_LIBRARY_SOURCE = 'nasm_exercise_library'

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

  const row = {
    user_id: clientId,
    name: buildPlanName(payload),
    goal: payload.goal,
    nasm_opt_phase: Math.max(1, Math.min(5, Number(payload.nasmOptPhase))),
    phase_name: payload.phaseName,
    sessions_per_week: payload.sessionsPerWeek,
    estimated_duration_mins: payload.estimatedDurationMins,
    plan_json: {
      ...storedPlan,
      generatedFromTemplateId: selectedTemplate.id,
      generatedFromTemplateTitle: selectedTemplate.title,
      generatedWithEquipmentAccess: [...new Set(['bodyweight', ...effectiveEquipmentAccess])],
      generatedByCoachId: coachId,
      generatedBy: 'coach_quick_generate',
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

  return NextResponse.json({
    plan: data,
    template: {
      id: selectedTemplate.id,
      title: selectedTemplate.title,
    },
  })
}
