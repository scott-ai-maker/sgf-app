import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestAuthz, requireRole, requireCoachAssignedClient, AuthzError } from '@/lib/authz'
import { buildStoredProgramPlan, type CoachProgramDraft, type EquipmentLibraryRecord, type ExerciseLibraryRecord, type CoachProgramPayload, type CoachProgramWorkoutInput, type CoachProgramExerciseInput, type ProgramWorkoutSnapshot, type WorkoutProgramTemplateRecord } from '@/lib/coach-programs'
import {
  selectOptWorkoutBlueprint,
  OPT_SECTION_PRESCRIPTIONS,
  getPhasePrescription,
  type ClientProfile,
  type ExerciseRecord,
} from '@/lib/nasm-opt-exercise-selection'
import { generateIntelligentProgramming, generateWeeklyFrequencyRecommendation } from '@/lib/openai-program-generation'

const EXERCISE_LIBRARY_SOURCE = 'nasm_exercise_library'
const TRAINING_DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const STRICT_NASM_VOLUME_BLOCK_MODE = true

const MONTHLY_PHASE_NOTES: Record<number, string[]> = {
  1: [
    'Week 1: Establish movement quality, posture, and strict stabilization tempo.',
    'Week 2: Add a small workload increase while keeping balance and core control as the priority.',
    'Week 3: Progress density conservatively without sacrificing tempo or joint alignment.',
    'Week 4: Consolidate stabilization endurance and assess readiness before a phase change.',
  ],
  2: [
    'Week 1: Pair stability and strength work with clean transitions and controlled eccentric work.',
    'Week 2: Increase challenge through slightly higher total workload while preserving integrated movement quality.',
    'Week 3: Push strength-endurance density with tight rest discipline and technical precision.',
    'Week 4: Consolidate force production and movement efficiency before advancing intensity.',
  ],
  3: [
    'Week 1: Set the hypertrophy baseline with full range of motion and consistent time under tension.',
    'Week 2: Build total volume carefully while maintaining muscular control across every rep.',
    'Week 3: Emphasize progressive overload within the prescribed hypertrophy range.',
    'Week 4: Hold quality output, manage fatigue, and confirm recovery before the next block.',
  ],
  4: [
    'Week 1: Establish maximal strength intent with pristine setup, bracing, and full recovery.',
    'Week 2: Increase loading conservatively while maintaining bar path and joint positioning.',
    'Week 3: Peak force production without sacrificing form or recovery quality.',
    'Week 4: Consolidate strength adaptations and protect readiness for the next mesocycle.',
  ],
  5: [
    'Week 1: Build explosive intent with perfect landings, deceleration, and rapid but controlled execution.',
    'Week 2: Increase power demand through speed and quality rather than excess fatigue.',
    'Week 3: Peak neural output with crisp contrast-style execution and full recovery.',
    'Week 4: Keep power expression sharp while managing fatigue and preserving movement speed.',
  ],
}

const NASM_VOLUME_GUARDRAILS: Record<number, { maxSetsPerSession: number; maxSetsPerWeek: number }> = {
  1: { maxSetsPerSession: 24, maxSetsPerWeek: 96 },
  2: { maxSetsPerSession: 26, maxSetsPerWeek: 104 },
  3: { maxSetsPerSession: 30, maxSetsPerWeek: 120 },
  4: { maxSetsPerSession: 22, maxSetsPerWeek: 88 },
  5: { maxSetsPerSession: 20, maxSetsPerWeek: 80 },
}

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

function normalizePreferredTrainingDays(values: unknown) {
  if (!Array.isArray(values)) return []

  const seen = new Set<string>()

  return values
    .map(item => String(item ?? '').trim().toLowerCase())
    .filter((item): item is (typeof TRAINING_DAY_ORDER)[number] => {
      if (!TRAINING_DAY_ORDER.includes(item as (typeof TRAINING_DAY_ORDER)[number])) return false
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
    .sort((left, right) => TRAINING_DAY_ORDER.indexOf(left) - TRAINING_DAY_ORDER.indexOf(right))
}

function getDefaultPreferredTrainingDays(count: number) {
  const patterns: Record<number, string[]> = {
    1: ['monday'],
    2: ['monday', 'thursday'],
    3: ['monday', 'wednesday', 'friday'],
    4: ['monday', 'tuesday', 'thursday', 'friday'],
    5: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    7: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  }

  const normalizedCount = Math.max(1, Math.min(7, count))
  return (patterns[normalizedCount] ?? patterns[4]).slice(0, normalizedCount)
}

function startOfNextWeekUtc() {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const jsDay = today.getUTCDay()
  const dayOffset = jsDay === 0 ? 6 : jsDay - 1
  const startOfCurrentWeek = new Date(today.getTime())
  startOfCurrentWeek.setUTCDate(today.getUTCDate() - dayOffset)

  const startOfNextWeek = new Date(startOfCurrentWeek.getTime())
  startOfNextWeek.setUTCDate(startOfCurrentWeek.getUTCDate() + 7)
  return startOfNextWeek
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addUtcDays(date: Date, days: number) {
  const copy = new Date(date.getTime())
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

function getMonthlyPhaseWeekNote(phase: number, weekNumber: number) {
  return MONTHLY_PHASE_NOTES[phase]?.[weekNumber - 1] ?? MONTHLY_PHASE_NOTES[1][weekNumber - 1] ?? null
}

function getFallbackRecommendedDaysPerWeek(goal: string | null | undefined, experienceLevel: string | null | undefined, hasLimitations: boolean) {
  const normalizedGoal = String(goal ?? '').toLowerCase()
  const normalizedExperience = String(experienceLevel ?? '').toLowerCase()

  let base = 3
  if (normalizedGoal.includes('fat') || normalizedGoal.includes('weight')) base = 4
  if (normalizedGoal.includes('muscle') || normalizedGoal.includes('hypertrophy')) base = 4
  if (normalizedGoal.includes('performance') || normalizedGoal.includes('athletic')) base = 5

  if (normalizedExperience.includes('beginner')) base = Math.min(base, 3)
  if (normalizedExperience.includes('advanced')) base = Math.min(6, base + 1)
  if (hasLimitations) base = Math.max(2, base - 1)

  return Math.max(2, Math.min(6, base))
}

function resolveSessionDurationMins({
  templateDuration,
  phase,
  sessionsPerWeek,
  recommendedDaysPerWeek,
}: {
  templateDuration: number | null
  phase: number
  sessionsPerWeek: number
  recommendedDaysPerWeek: number
}) {
  const baseDuration = Math.min(60, Math.max(35, Number(templateDuration) || 60))
  const prescription = getPhasePrescription(phase)
  const intensityScale: Record<string, number> = {
    low: 1,
    moderate: 0.93,
    high: 0.86,
    maximum: 0.78,
  }
  const scaledDuration = baseDuration * (intensityScale[prescription.intensity] ?? 0.9)
  const overage = Math.max(0, sessionsPerWeek - recommendedDaysPerWeek)
  const overageReduction = overage * 5

  return Math.max(30, Math.min(60, Math.round(scaledDuration - overageReduction)))
}

function buildMonthlyScheduledWorkouts({
  baseWorkouts,
  preferredTrainingDays,
  nasmOptPhase,
}: {
  baseWorkouts: ProgramWorkoutSnapshot[]
  preferredTrainingDays: string[]
  nasmOptPhase: number
}) {
  const scheduleDays = preferredTrainingDays.length > 0
    ? preferredTrainingDays
    : getDefaultPreferredTrainingDays(baseWorkouts.length)
  const monthStart = startOfNextWeekUtc()
  const monthlyWorkouts: ProgramWorkoutSnapshot[] = []

  for (let weekIndex = 0; weekIndex < 4; weekIndex += 1) {
    const weekNumber = weekIndex + 1
    const weekNote = getMonthlyPhaseWeekNote(nasmOptPhase, weekNumber)

    for (let workoutIndex = 0; workoutIndex < baseWorkouts.length; workoutIndex += 1) {
      const baseWorkout = baseWorkouts[workoutIndex]
      if (!baseWorkout) continue

      const dayKey = scheduleDays[workoutIndex] ?? scheduleDays[scheduleDays.length - 1] ?? 'monday'
      const dayOffset = Math.max(0, TRAINING_DAY_ORDER.indexOf(dayKey as (typeof TRAINING_DAY_ORDER)[number]))
      const scheduledDate = formatDateOnly(addUtcDays(monthStart, weekIndex * 7 + dayOffset))
      const noteParts = [
        weekNote,
        `Scheduled for ${dayKey.charAt(0).toUpperCase()}${dayKey.slice(1)}.`,
        baseWorkout.notes,
      ].filter(Boolean)

      monthlyWorkouts.push({
        day: monthlyWorkouts.length + 1,
        focus: `Week ${weekNumber} - ${baseWorkout.focus}`,
        scheduledDate,
        notes: noteParts.join('\n\n'),
        exercises: baseWorkout.exercises.map(exercise => ({
          ...exercise,
          coachingCues: [...exercise.coachingCues],
          primaryEquipment: [...exercise.primaryEquipment],
        })),
      })
    }
  }

  return monthlyWorkouts
}

function parseSetBounds(sets: string) {
  const normalized = String(sets ?? '').trim()
  const rangeMatch = normalized.match(/(\d+)\s*[-/]\s*(\d+)/)
  if (rangeMatch) {
    const min = Math.max(1, Number(rangeMatch[1]))
    const max = Math.max(min, Number(rangeMatch[2]))
    return { min, max }
  }

  const singleMatch = normalized.match(/(\d+)/)
  if (singleMatch) {
    const value = Math.max(1, Number(singleMatch[1]))
    return { min: value, max: value }
  }

  return { min: 1, max: 1 }
}

function formatSetBounds(min: number, max: number) {
  return min === max ? String(min) : `${min}-${max}`
}

function getWorkoutSetVolume(workout: CoachProgramWorkoutInput) {
  return workout.exercises.reduce((sum, exercise) => {
    const bounds = parseSetBounds(exercise.sets)
    return sum + bounds.max
  }, 0)
}

function getWeeklySetVolume(workouts: CoachProgramWorkoutInput[]) {
  return workouts.reduce((sum, workout) => sum + getWorkoutSetVolume(workout), 0)
}

function reduceWorkoutSetVolumeToCap(workout: CoachProgramWorkoutInput, cap: number) {
  let current = getWorkoutSetVolume(workout)
  if (current <= cap) return false

  const blockPriority = ['clients-choice', 'skill-development', 'activation', 'resistance', 'warm-up', 'cool-down']
  let changed = false

  for (const block of blockPriority) {
    for (const exercise of workout.exercises) {
      if (current <= cap) break
      if (String(exercise.block ?? '').trim() !== block) continue

      const bounds = parseSetBounds(exercise.sets)
      if (bounds.max <= bounds.min) continue

      const nextMax = Math.max(bounds.min, bounds.max - 1)
      exercise.sets = formatSetBounds(bounds.min, nextMax)
      current -= 1
      changed = true
    }

    if (current <= cap) break
  }

  return changed
}

function applyNasmVolumeGuardrails(
  workouts: CoachProgramWorkoutInput[],
  nasmOptPhase: number
) {
  const guardrail = NASM_VOLUME_GUARDRAILS[nasmOptPhase] ?? NASM_VOLUME_GUARDRAILS[1]
  const notes: string[] = []
  let applied = false

  for (const workout of workouts) {
    const before = getWorkoutSetVolume(workout)
    if (before <= guardrail.maxSetsPerSession) continue

    const changed = reduceWorkoutSetVolumeToCap(workout, guardrail.maxSetsPerSession)
    if (changed) {
      const after = getWorkoutSetVolume(workout)
      notes.push(`Reduced ${workout.focus} from ${before} to ${after} working sets to stay within NASM session-volume guardrails.`)
      applied = true
    }
  }

  let weeklyVolume = workouts.reduce((sum, workout) => sum + getWorkoutSetVolume(workout), 0)
  if (weeklyVolume > guardrail.maxSetsPerWeek && workouts.length > 0) {
    const perWorkoutCap = Math.max(8, Math.floor(guardrail.maxSetsPerWeek / workouts.length))

    for (const workout of workouts) {
      if (weeklyVolume <= guardrail.maxSetsPerWeek) break
      const before = getWorkoutSetVolume(workout)
      const changed = reduceWorkoutSetVolumeToCap(workout, perWorkoutCap)
      if (!changed) continue

      const after = getWorkoutSetVolume(workout)
      weeklyVolume -= (before - after)
      notes.push(`Applied weekly volume control on ${workout.focus} (${before} -> ${after} sets) to avoid overtraining risk.`)
      applied = true
    }
  }

  return {
    applied,
    notes,
    maxSetsPerSession: guardrail.maxSetsPerSession,
    maxSetsPerWeek: guardrail.maxSetsPerWeek,
    resultingWeeklySets: workouts.reduce((sum, workout) => sum + getWorkoutSetVolume(workout), 0),
  }
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
    sexe?: string | null
    experience_level?: string | null
    activity_level?: string | null
    fitness_goal?: string | null
    injuries_limitations?: string | null
    training_days_per_week?: number | null
    preferred_training_days?: string[] | null
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
    sexe: profile.sexe ?? undefined,
    experienceLevel: profile.experience_level ?? undefined,
    activityLevel: profile.activity_level ?? undefined,
    fitnessGoal: profile.fitness_goal ?? undefined,
    injuries_limitations: profile.injuries_limitations ?? undefined,
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
  const startDateOverride = String(body.startDate ?? '').trim() || null

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

  const fallbackRecommendedDaysPerWeek = getFallbackRecommendedDaysPerWeek(
    profile.fitness_goal,
    profile.experience_level,
    Boolean(String(profile.injuries_limitations ?? '').trim())
  )

  const recommendation = await generateWeeklyFrequencyRecommendation({
    clientProfile: {
      age: Number(profile.age) || 30,
      sexe: profile.sex,
      experienceLevel: profile.experience_level,
      activityLevel: profile.activity_level,
      fitnessGoal: profile.fitness_goal,
      injuries_limitations: profile.injuries_limitations,
      equipmentAccess: Array.isArray(profile.equipment_access) ? profile.equipment_access : ['bodyweight'],
    },
    phase: selectedPhase ?? 1,
  }).catch(() => ({
    recommendedDaysPerWeek: fallbackRecommendedDaysPerWeek,
    rationale: 'Fallback recommendation used from NASM-safe profile heuristics because AI recommendation was unavailable.',
    caution: 'Use caution when prescribing more sessions than recommended; monitor recovery markers each week.',
  }))

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

  const coachRequestedSessions = Number.isFinite(sessionsPerWeek)
    ? Math.max(2, Math.min(7, Math.round(sessionsPerWeek)))
    : null

  const resolvedSessionsPerWeek = coachRequestedSessions
    ?? Number(selectedTemplate.sessions_per_week ?? profile.training_days_per_week ?? recommendation.recommendedDaysPerWeek)

  const normalizedPreferredTrainingDays = normalizePreferredTrainingDays(profile.preferred_training_days)
  if (normalizedPreferredTrainingDays.length > 0 && resolvedSessionsPerWeek > normalizedPreferredTrainingDays.length) {
    return NextResponse.json({
      error: `Client only has ${normalizedPreferredTrainingDays.length} preferred training day${normalizedPreferredTrainingDays.length === 1 ? '' : 's'} configured. Reduce sessions per week or update the client's training availability.`,
    }, { status: 400 })
  }

  const scheduledTrainingDays = normalizedPreferredTrainingDays.length > 0
    ? normalizedPreferredTrainingDays.slice(0, resolvedSessionsPerWeek)
    : getDefaultPreferredTrainingDays(resolvedSessionsPerWeek)

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

  const phaseVolumeCaps = NASM_VOLUME_GUARDRAILS[selectedPhase ?? 1] ?? NASM_VOLUME_GUARDRAILS[1]
  const projectedWeeklySets = getWeeklySetVolume(intelligentWorkouts)

  if (
    STRICT_NASM_VOLUME_BLOCK_MODE
    && coachRequestedSessions !== null
    && coachRequestedSessions > recommendation.recommendedDaysPerWeek
    && projectedWeeklySets > phaseVolumeCaps.maxSetsPerWeek
  ) {
    return NextResponse.json({
      error: `Blocked by NASM overtraining guardrail: projected weekly volume is ${projectedWeeklySets} sets for Phase ${selectedPhase ?? 1}, which exceeds the cap of ${phaseVolumeCaps.maxSetsPerWeek}. Reduce sessions/week or adjust volume before generating.`,
      recommendation: {
        recommendedDaysPerWeek: recommendation.recommendedDaysPerWeek,
        maxSetsPerWeek: phaseVolumeCaps.maxSetsPerWeek,
        projectedWeeklySets,
      },
    }, { status: 400 })
  }

  const volumeGuardrail = applyNasmVolumeGuardrails(intelligentWorkouts, selectedPhase ?? 1)

  const payload: CoachProgramPayload = {
    clientId,
    name: `${selectedTemplate.title} - Monthly AI Personalized`,
    goal: selectedTemplate.goal ?? profile.fitness_goal ?? null,
    nasmOptPhase: Number(selectedTemplate.nasm_opt_phase ?? 1),
    phaseName: String(selectedTemplate.phase_name ?? 'Custom Phase'),
    sessionsPerWeek: Math.max(1, Math.min(7, resolvedSessionsPerWeek)),
    estimatedDurationMins: resolveSessionDurationMins({
      templateDuration: Number(selectedTemplate.estimated_duration_mins ?? 60),
      phase: selectedPhase ?? 1,
      sessionsPerWeek: Math.max(1, Math.min(7, resolvedSessionsPerWeek)),
      recommendedDaysPerWeek: recommendation.recommendedDaysPerWeek,
    }),
    startDate: startDateOverride,
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

  const monthlyWorkouts = buildMonthlyScheduledWorkouts({
    baseWorkouts: storedPlan.workouts,
    preferredTrainingDays: scheduledTrainingDays,
    nasmOptPhase: payload.nasmOptPhase,
  })

  if (monthlyWorkouts.length === 0) {
    return NextResponse.json({ error: 'Unable to create a month-long workout calendar.' }, { status: 400 })
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
    workouts: monthlyWorkouts,
  }

  return NextResponse.json({
    draft,
    template: {
      id: selectedTemplate.id,
      title: selectedTemplate.title,
    },
    recommendation: {
      recommendedDaysPerWeek: recommendation.recommendedDaysPerWeek,
      rationale: recommendation.rationale,
      caution: recommendation.caution,
      coachSelectedDaysPerWeek: payload.sessionsPerWeek,
      cautionRequired: payload.sessionsPerWeek > recommendation.recommendedDaysPerWeek,
      recommendedSessionDurationMins: payload.estimatedDurationMins,
      volumeGuardrailApplied: volumeGuardrail.applied,
      volumeGuardrailNotes: volumeGuardrail.notes,
      maxSetsPerSession: volumeGuardrail.maxSetsPerSession,
      maxSetsPerWeek: volumeGuardrail.maxSetsPerWeek,
      resultingWeeklySets: volumeGuardrail.resultingWeeklySets,
      strictVolumeBlockEnabled: STRICT_NASM_VOLUME_BLOCK_MODE,
    },
  })
}
