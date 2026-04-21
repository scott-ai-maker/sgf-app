import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestAuthz, requireRole, requireCoachAssignedClient, AuthzError } from '@/lib/authz'
import { buildStoredProgramPlan, type CoachProgramDraft, type EquipmentLibraryRecord, type ExerciseLibraryRecord, type CoachProgramPayload, type CoachProgramWorkoutInput, type CoachProgramExerciseInput, type WorkoutProgramTemplateRecord } from '@/lib/coach-programs'
import {
  selectOptWorkoutBlueprint,
  OPT_SECTION_PRESCRIPTIONS,
  type ClientProfile,
  type ExerciseRecord,
} from '@/lib/nasm-opt-exercise-selection'
import { generateIntelligentProgramming } from '@/lib/openai-program-generation'

const EXERCISE_LIBRARY_SOURCE = 'nasm_exercise_library'

function deriveMovementPattern(name: string, description?: string | null): string | undefined {
  const text = `${name} ${description ?? ''}`.toLowerCase()

  if (/squat|leg press|wall sit/.test(text)) return 'squat'
  if (/lunge|split squat|step up|step-up|step down/.test(text)) return 'lunge'
  if (/row|pull up|pull-up|chin up|chin-up|lat pulldown/.test(text)) return 'pull'
  if (/push up|push-up|bench|chest press|shoulder press|overhead press|dip/.test(text)) return 'push'
  if (/rotation|chop|woodchop|pallof/.test(text)) return 'rotation'
  if (/carry|farmer|walk|march/.test(text)) return 'gait'

  return undefined
}

function deriveComplexity(name: string, description?: string | null): 'beginner' | 'intermediate' | 'advanced' {
  const text = `${name} ${description ?? ''}`.toLowerCase()

  if (/depth jump|tuck jump|hurdle jump|snatch|clean and press|olympic|pistol squat|turkish|get up/.test(text)) {
    return 'advanced'
  }

  if (/single leg|single-arm|single arm|box jump|jump|renegade row|bulgarian|trx|stability ball|bosu|kettlebell swing|rotation/.test(text)) {
    return 'intermediate'
  }

  return 'beginner'
}

function normalizeEquipmentAccess(items: string[]) {
  return [...new Set(items.map(item => String(item ?? '').trim().toLowerCase()).filter(Boolean))]
}

function normalizeEquipmentAlias(item: string) {
  const normalized = String(item ?? '').trim().toLowerCase()

  if (!normalized) return null
  if (normalized === 'cable-machine') return 'cable machine'
  if (normalized === 'medicine-ball') return 'medicine ball'
  if (normalized === 'dumbbells') return 'dumbbell'
  if (normalized === 'kettlebells') return 'kettlebell'
  if (normalized === 'bands') return 'band'
  if (normalized === 'machines') return 'machine'
  if (normalized === 'trx') return 'suspension'

  return normalized
}

function exerciseMatchesEquipment(exercise: ExerciseLibraryRecord, equipmentAccess: string[]) {
  if (equipmentAccess.length === 0) return true

  const normalizedAvailable = equipmentAccess
    .map(item => normalizeEquipmentAlias(item))
    .filter((item): item is string => Boolean(item))

  const normalizedEquipment = (Array.isArray(exercise.primary_equipment) ? exercise.primary_equipment : [])
    .map(item => String(item ?? '').trim().toLowerCase())
    .filter(Boolean)

  if (normalizedEquipment.length === 0) {
    return normalizedAvailable.includes('bodyweight')
  }

  return normalizedEquipment.some(item => {
    if (item.includes('bodyweight') || item === 'none') return normalizedAvailable.includes('bodyweight')

    const canonicalItem = normalizeEquipmentAlias(item)
    if (!canonicalItem) return false

    return normalizedAvailable.some(available => {
      if (available === canonicalItem) return true
      if (available.includes(canonicalItem) || canonicalItem.includes(available)) return true

      if (canonicalItem.includes('trx') || canonicalItem.includes('suspension')) {
        return available.includes('trx') || available.includes('suspension')
      }

      if (canonicalItem.includes('band')) {
        return available.includes('band') || available.includes('resistance')
      }

      if (canonicalItem.includes('dumbbell')) {
        return available.includes('dumbbell')
      }

      if (canonicalItem.includes('barbell')) {
        return available.includes('barbell')
      }

      if (canonicalItem.includes('kettlebell')) {
        return available.includes('kettlebell')
      }

      if (canonicalItem.includes('machine') || canonicalItem.includes('smith')) {
        return available.includes('machine') || available.includes('smith')
      }

      if (canonicalItem.includes('cable')) {
        return available.includes('cable')
      }

      if (canonicalItem.includes('medicine ball') || canonicalItem.includes('stability ball')) {
        return available.includes('medicine ball') || available.includes('stability ball')
      }

      return false
    })
  })
}

function convertExerciseLibraryToInternalFormat(
  libraryExercise: ExerciseLibraryRecord
): ExerciseRecord {
  const movementPattern = deriveMovementPattern(libraryExercise.name, libraryExercise.description)
  const complexity = deriveComplexity(libraryExercise.name, libraryExercise.description)

  return {
    id: libraryExercise.id,
    name: libraryExercise.name,
    description: libraryExercise.description ?? undefined,
    primaryEquipment: Array.isArray(libraryExercise.primary_equipment)
      ? libraryExercise.primary_equipment.map(e => String(e).toLowerCase().trim())
      : [],
    coachingCues: Array.isArray(libraryExercise.coaching_cues)
      ? libraryExercise.coaching_cues.map(c => String(c).trim()).filter(Boolean)
      : [],
    metadata: {
      movementPattern,
      muscleGroups: Array.isArray(libraryExercise.muscle_groups)
        ? libraryExercise.muscle_groups.map(m => String(m).trim()).filter(Boolean)
        : [],
      complexity,
      nasmPhases: [1, 2, 3, 4, 5],
    },
  }
}

async function buildIntelligentTemplateWorkouts({
  template,
  exercises,
  sessionsPerWeek,
  equipmentAccess,
  profile,
  nasmOptPhase,
}: {
  template: WorkoutProgramTemplateRecord
  exercises: ExerciseLibraryRecord[]
  sessionsPerWeek: number
  equipmentAccess: string[]
  profile: Partial<ClientProfile> & {
    training_days_per_week?: number | null
    equipment_access?: string[] | null
  }
  nasmOptPhase: number
}) {
  const normalizedEquipmentAccess = normalizeEquipmentAccess(equipmentAccess)
  const filteredExercises = exercises.filter(exercise => exerciseMatchesEquipment(exercise, normalizedEquipmentAccess))
  const availableExercises = filteredExercises.length > 0 ? filteredExercises : exercises

  // Convert to internal format for intelligent selection
  const exercisesForSelection = availableExercises.map(convertExerciseLibraryToInternalFormat)

  const templateWorkouts: CoachProgramWorkoutInput[] = Array.isArray(template.template_json?.workouts)
    && template.template_json.workouts.length > 0
    ? template.template_json.workouts.slice(0, Math.max(1, sessionsPerWeek))
    : Array.from({ length: Math.max(1, sessionsPerWeek) }, (_, index) => ({
        day: index + 1,
        focus: `Training Day ${index + 1}`,
        scheduledDate: null,
        notes: null,
        exercises: [],
      }))

  // Build client profile for intelligent selection
  const clientProfile: ClientProfile = {
    age: Number(profile.age) || 30,
    sexe: profile.sex,
    experienceLevel: profile.experience_level,
    activityLevel: profile.activity_level,
    fitnessGoal: profile.fitness_goal,
    injuries_limitations: profile.injuries_limitations,
    equipmentAccess: normalizedEquipmentAccess,
  }

  // Build workouts using the 6-section NASM OPT template blueprint
  const usedExerciseIds = new Set<string>()
  const workouts: CoachProgramWorkoutInput[] = templateWorkouts.map((workout, workoutIndex) => {
    const dayFocus = String(workout.focus ?? `Training Day ${workoutIndex + 1}`).trim() || `Training Day ${workoutIndex + 1}`

    const blueprint = selectOptWorkoutBlueprint(
      nasmOptPhase,
      dayFocus,
      exercisesForSelection,
      clientProfile,
      usedExerciseIds,
    )

    type OptSectionKey = 'warm-up' | 'activation' | 'skill-development' | 'resistance' | 'clients-choice' | 'cool-down'

    const sectionOrder: OptSectionKey[] = [
      'warm-up',
      'activation',
      'skill-development',
      'resistance',
      'clients-choice',
      'cool-down',
    ]

    const dayExercises: CoachProgramExerciseInput[] = []

    for (const section of sectionOrder) {
      const sectionExercises = blueprint[section]
      if (sectionExercises.length === 0) continue

      const rx = OPT_SECTION_PRESCRIPTIONS[section](nasmOptPhase)

      for (const ex of sectionExercises) {
        const libraryMatch = availableExercises.find(lib => lib.name === ex.name)
        dayExercises.push({
          libraryExerciseId: libraryMatch?.id ?? ex.id,
          name: ex.name,
          block: section,
          sets: rx.sets,
          reps: rx.reps,
          tempo: rx.tempo,
          rest: rx.rest,
          notes: null,
        })
      }
    }

    return {
      day: Number(workout.day) || workoutIndex + 1,
      focus: dayFocus,
      scheduledDate: String(workout.scheduledDate ?? '').trim() || null,
      notes: String(workout.notes ?? '').trim() || null,
      exercises: dayExercises,
    }
  })

  return workouts
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
  const experienceLevelOverride = String(body.experienceLevel ?? '').trim().toLowerCase() || null

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

  // Apply experience level override if provided
  if (experienceLevelOverride && ['beginner', 'intermediate', 'advanced'].includes(experienceLevelOverride)) {
    profile.experience_level = experienceLevelOverride
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
      .select('id, name, slug, description, coaching_cues, primary_equipment, muscle_groups, media_image_url, media_video_url, metadata_json')
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

  // Use INTELLIGENT exercise selection instead of randomized
  const intelligentWorkouts = await buildIntelligentTemplateWorkouts({
    template: selectedTemplate,
    exercises: (exercisesResult.data ?? []) as ExerciseLibraryRecord[],
    sessionsPerWeek: resolvedSessionsPerWeek,
    equipmentAccess: effectiveEquipmentAccess,
    profile,
    nasmOptPhase: selectedPhase ?? 1,
  })

  if (intelligentWorkouts.length === 0) {
    return NextResponse.json({ error: 'Unable to build a workout from the selected template.' }, { status: 400 })
  }

  const payload: CoachProgramPayload = {
    clientId,
    name: `${selectedTemplate.title} - AI Personalized`,
    goal: selectedTemplate.goal ?? profile.fitness_goal ?? null,
    nasmOptPhase: Number(selectedTemplate.nasm_opt_phase ?? 1),
    phaseName: String(selectedTemplate.phase_name ?? 'Custom Phase'),
    sessionsPerWeek: Math.max(1, Math.min(7, resolvedSessionsPerWeek)),
    estimatedDurationMins: Number(selectedTemplate.estimated_duration_mins ?? 60),
    startDate: null,
    templateId: selectedTemplate.id,
    workouts: intelligentWorkouts,
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

  // Enhance workouts with AI-powered programming notes and coaching cues
  try {
    for (const workout of storedPlan.workouts) {
      const plannedExercises = workout.exercises.map(ex => ({
        name: ex.name,
        muscleGroups: ex.primaryEquipment,
      }))

      const prescription = getPhasePrescription(payload.nasmOptPhase)

      // Generate intelligent programming guidance
      const programmeGuidance = await generateIntelligentProgramming({
        clientProfile: {
          age: Number(profile.age) || 30,
          sexe: profile.sex,
          experienceLevel: profile.experience_level,
          activityLevel: profile.activity_level,
          fitnessGoal: profile.fitness_goal,
          injuries_limitations: profile.injuries_limitations,
          equipmentAccess: effectiveEquipmentAccess,
        },
        phase: payload.nasmOptPhase,
        prescription,
        plannedExercises,
        sessionFocus: workout.focus,
        selectedEquipment: effectiveEquipmentAccess,
      })

      // Add programming guidance to workout notes
      if (programmeGuidance.safetyConsiderations) {
        const safetyNote = `IMPORTANT SAFETY TIPS FOR ${workout.focus.toUpperCase()}:\n${programmeGuidance.safetyConsiderations}`
        workout.notes = `${workout.notes ? workout.notes + '\n\n' : ''}${safetyNote}`
      }

      // Enhance exercise notes with AI coaching cues
      for (const exercise of workout.exercises) {
        const aiCues = programmeGuidance.exerciseSpecificCues[exercise.name]
        
        if (aiCues && aiCues.length > 0) {
          // Combine AI cues with existing coaching cues
          const existingCues = exercise.coachingCues || []
          const combinedCues = [...aiCues, ...existingCues]
          
          // Remove duplicates (case-insensitive) and limit to 6
          const seen = new Set<string>()
          exercise.coachingCues = combinedCues
            .filter(cue => {
              const normalized = cue.toLowerCase()
              if (seen.has(normalized)) return false
              seen.add(normalized)
              return true
            })
            .slice(0, 6)
        } else if (!exercise.coachingCues || exercise.coachingCues.length === 0) {
          // Generate fallback cues if none available
          const fallbackCues = generateFallbackCoachingCues(exercise.name, payload.nasmOptPhase)
          exercise.coachingCues = fallbackCues
        }

        // Add progression note to exercise
        if (programmeGuidance.progressionStrategy) {
          exercise.notes = `${exercise.notes ? exercise.notes + ' | ' : ''}Progress: ${programmeGuidance.progressionStrategy.substring(0, 100)}`
        }
      }
    }
  } catch (aiError) {
    // If AI generation fails, add fallback coaching cues to all exercises
    console.error('AI programming generation error:', aiError instanceof Error ? aiError.message : 'Unknown error')
    
    for (const workout of storedPlan.workouts) {
      for (const exercise of workout.exercises) {
        if (!exercise.coachingCues || exercise.coachingCues.length === 0) {
          exercise.coachingCues = generateFallbackCoachingCues(exercise.name, payload.nasmOptPhase)
        }
      }
    }
  }

  function generateFallbackCoachingCues(exerciseName: string, phase: number): string[] {
    const cues: Record<number, string[]> = {
      1: [
        'Focus on slow, controlled movement to build stability',
        'Maintain perfect form above all else',
        'Breathe rhythmically throughout the movement',
        'Feel the working muscles with every rep',
      ],
      2: [
        'Build strength in stabilizer muscles',
        'Increase work capacity gradually',
        'Maintain excellent form under moderate loads',
        'Control the negative (eccentric) portion',
      ],
      3: [
        'Focus on the muscle contraction at the top',
        'Control the weight, do not rely on momentum',
        'Maintain consistent tempo throughout sets',
        'Feel the stretch in the bottom position',
      ],
      4: [
        'Maximize force production with intent',
        'Use proper form with heavier loads',
        'Full recovery between sets is essential',
        'Progress load week-to-week systematically',
      ],
      5: [
        'Move with explosive intent and control',
        'Quality over quantity in power training',
        'Full recovery between sets for power',
        'Focus on bar speed and movement quality',
      ],
    }

    const phaseCues = cues[phase] || cues[3]
    return phaseCues
  }

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
