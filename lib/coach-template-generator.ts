import type { CoachProgramExerciseInput, CoachProgramWorkoutInput, ExerciseLibraryRecord, WorkoutProgramTemplateRecord } from '@/lib/coach-programs'

interface TemplateWorkoutInput {
  day?: number
  focus?: string
  notes?: string | null
}

interface TemplateExerciseLibraryRecord extends ExerciseLibraryRecord {
  metadata_json?: {
    bodyParts?: string[]
    targetMuscles?: string[]
    secondaryMuscles?: string[]
    keywords?: string[]
    [key: string]: unknown
  } | null
}

interface BuildTemplateWorkoutsInput {
  template: WorkoutProgramTemplateRecord
  exercises: TemplateExerciseLibraryRecord[]
  sessionsPerWeek: number
  equipmentAccess: string[]
}

type MovementBucket =
  | 'lower_compound'
  | 'lower_unilateral'
  | 'hinge_posterior'
  | 'upper_push'
  | 'upper_pull'
  | 'core_stability'
  | 'core_rotation'
  | 'power_explosive'
  | 'conditioning'

interface FocusProfile {
  tags: string[]
  keywordHints: string[]
  buckets: MovementBucket[]
}

const LOWER_TAGS = ['legs', 'upper legs', 'lower legs', 'glutes', 'quadriceps', 'hamstrings', 'calves']
const UPPER_PUSH_TAGS = ['chest', 'shoulders', 'triceps']
const UPPER_PULL_TAGS = ['back', 'lats', 'biceps', 'traps', 'rhomboids']
const CORE_TAGS = ['waist', 'abs', 'obliques', 'core']

const BUCKET_HINTS: Record<MovementBucket, string[]> = {
  lower_compound: ['squat', 'leg press', 'front squat', 'back squat'],
  lower_unilateral: ['lunge', 'split squat', 'step-up', 'single-leg'],
  hinge_posterior: ['deadlift', 'romanian', 'hinge', 'good morning', 'hip thrust'],
  upper_push: ['press', 'push-up', 'dip', 'fly'],
  upper_pull: ['row', 'pull-up', 'pulldown', 'chin-up', 'face pull'],
  core_stability: ['plank', 'carry', 'stability', 'anti-extension'],
  core_rotation: ['pallof', 'rotation', 'twist', 'woodchop'],
  power_explosive: ['jump', 'slam', 'clean', 'snatch', 'push press', 'power'],
  conditioning: ['burpee', 'mountain climber', 'bike', 'sled', 'interval'],
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeLower(value: unknown) {
  return normalizeText(value).toLowerCase()
}

function normalizeArray(values: unknown): string[] {
  if (!Array.isArray(values)) return []

  const seen = new Set<string>()

  return values
    .map(item => normalizeLower(item))
    .filter(item => {
      if (!item) return false
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }

  return copy
}

function isCompatibleWithEquipment(primaryEquipment: string[] | null | undefined, equipmentAccess: Set<string>) {
  if (equipmentAccess.size === 0) return true

  const normalized = normalizeArray(primaryEquipment)
  if (normalized.length === 0) return true

  const map = [
    ['bodyweight', ['body weight', 'bodyweight']],
    ['dumbbells', ['dumbbell']],
    ['barbell', ['barbell']],
    ['bench', ['bench']],
    ['cable-machine', ['cable']],
    ['machines', ['machine', 'lever', 'smith', 'press', 'squat machine']],
    ['kettlebells', ['kettlebell']],
    ['bands', ['band']],
    ['trx', ['trx', 'suspension']],
    ['medicine-ball', ['medicine ball']],
  ] as const

  return normalized.some(item => {
    return map.some(([profileKey, tokens]) => {
      if (!equipmentAccess.has(profileKey)) return false
      return tokens.some(token => item.includes(token))
    })
  })
}

function buildFocusProfile(focus: string): FocusProfile {
  const value = normalizeLower(focus)

  if (value.includes('lower') || value.includes('legs') || value.includes('glute')) {
    return {
      tags: LOWER_TAGS,
      keywordHints: ['squat', 'lunge', 'deadlift', 'hip'],
      buckets: ['lower_compound', 'hinge_posterior', 'lower_unilateral', 'core_stability', 'conditioning'],
    }
  }

  if (value.includes('push') || value.includes('chest') || value.includes('shoulder')) {
    return {
      tags: UPPER_PUSH_TAGS,
      keywordHints: ['press', 'push', 'fly', 'dip'],
      buckets: ['upper_push', 'upper_push', 'core_stability', 'conditioning'],
    }
  }

  if (value.includes('pull') || value.includes('back')) {
    return {
      tags: UPPER_PULL_TAGS,
      keywordHints: ['row', 'pull', 'pulldown', 'chin'],
      buckets: ['upper_pull', 'upper_pull', 'core_stability', 'conditioning'],
    }
  }

  if (value.includes('core') || value.includes('stability') || value.includes('balance')) {
    return {
      tags: CORE_TAGS,
      keywordHints: ['plank', 'carry', 'rotation', 'anti'],
      buckets: ['core_stability', 'core_rotation', 'core_stability', 'conditioning'],
    }
  }

  if (value.includes('power') || value.includes('plyo')) {
    return {
      tags: [...LOWER_TAGS, ...UPPER_PUSH_TAGS, ...UPPER_PULL_TAGS],
      keywordHints: ['jump', 'slam', 'clean', 'snatch', 'power'],
      buckets: ['power_explosive', 'lower_compound', 'upper_push', 'upper_pull'],
    }
  }

  return {
    tags: [...LOWER_TAGS, ...UPPER_PUSH_TAGS, ...UPPER_PULL_TAGS, ...CORE_TAGS],
    keywordHints: ['squat', 'press', 'row', 'plank', 'carry'],
    buckets: ['lower_compound', 'upper_push', 'upper_pull', 'hinge_posterior', 'core_stability'],
  }
}

function phaseAdjustedBuckets(phase: number, buckets: MovementBucket[]) {
  if (phase <= 1) {
    return buckets.map(bucket => (bucket === 'power_explosive' ? 'core_stability' : bucket))
  }

  if (phase >= 5) {
    const withPower = [...buckets]
    if (!withPower.includes('power_explosive')) {
      withPower[0] = 'power_explosive'
    }
    return withPower
  }

  return buckets
}

function buildPrescription(phase: number, focus: string, index: number) {
  const lowerFocus = normalizeLower(focus)
  const isCore = lowerFocus.includes('core') || lowerFocus.includes('stability')

  if (phase <= 1) {
    return {
      sets: '2-3',
      reps: isCore ? '30-45s' : index % 2 === 0 ? '12-15' : '10-15',
      tempo: '4/2/1',
      rest: '30-60s',
    }
  }

  if (phase === 2) {
    return {
      sets: '3-4',
      reps: isCore ? '30-60s' : '8-12',
      tempo: '2/0/2',
      rest: '45-90s',
    }
  }

  if (phase === 3) {
    return {
      sets: '3-5',
      reps: isCore ? '30-60s' : '6-12',
      tempo: '2/0/2',
      rest: '45-75s',
    }
  }

  if (phase === 4) {
    return {
      sets: '4-6',
      reps: isCore ? '20-40s' : '1-5',
      tempo: 'X/X/X',
      rest: '180-300s',
    }
  }

  return {
    sets: '3-5',
    reps: isCore ? '20-40s' : '3-6',
    tempo: 'X/0/X',
    rest: '120-240s',
  }
}

function classifyExerciseBuckets(exercise: TemplateExerciseLibraryRecord): Set<MovementBucket> {
  const bodyParts = normalizeArray(exercise.metadata_json?.bodyParts)
  const target = normalizeArray(exercise.metadata_json?.targetMuscles)
  const secondary = normalizeArray(exercise.metadata_json?.secondaryMuscles)
  const keywords = normalizeArray(exercise.metadata_json?.keywords)
  const haystack = [normalizeLower(exercise.name), ...keywords, ...bodyParts, ...target, ...secondary].join(' ')

  const buckets = new Set<MovementBucket>()

  if (LOWER_TAGS.some(tag => haystack.includes(tag)) || BUCKET_HINTS.lower_compound.some(token => haystack.includes(token))) {
    buckets.add('lower_compound')
  }
  if (BUCKET_HINTS.lower_unilateral.some(token => haystack.includes(token))) {
    buckets.add('lower_unilateral')
  }
  if (BUCKET_HINTS.hinge_posterior.some(token => haystack.includes(token))) {
    buckets.add('hinge_posterior')
  }
  if (UPPER_PUSH_TAGS.some(tag => haystack.includes(tag)) || BUCKET_HINTS.upper_push.some(token => haystack.includes(token))) {
    buckets.add('upper_push')
  }
  if (UPPER_PULL_TAGS.some(tag => haystack.includes(tag)) || BUCKET_HINTS.upper_pull.some(token => haystack.includes(token))) {
    buckets.add('upper_pull')
  }
  if (CORE_TAGS.some(tag => haystack.includes(tag)) || BUCKET_HINTS.core_stability.some(token => haystack.includes(token))) {
    buckets.add('core_stability')
  }
  if (BUCKET_HINTS.core_rotation.some(token => haystack.includes(token))) {
    buckets.add('core_rotation')
  }
  if (BUCKET_HINTS.power_explosive.some(token => haystack.includes(token))) {
    buckets.add('power_explosive')
  }
  if (BUCKET_HINTS.conditioning.some(token => haystack.includes(token))) {
    buckets.add('conditioning')
  }

  if (buckets.size === 0) {
    buckets.add('conditioning')
  }

  return buckets
}

function scoredCandidates(
  exercises: TemplateExerciseLibraryRecord[],
  profile: FocusProfile,
  bucket: MovementBucket,
  focus: string,
  equipmentAccess: Set<string>,
  usedExerciseIds: Set<string>
) {
  const focusText = normalizeLower(focus)
  const bucketHints = BUCKET_HINTS[bucket]

  return exercises
    .filter(exercise => isCompatibleWithEquipment(exercise.primary_equipment, equipmentAccess))
    .map(exercise => {
      const bodyParts = normalizeArray(exercise.metadata_json?.bodyParts)
      const target = normalizeArray(exercise.metadata_json?.targetMuscles)
      const secondary = normalizeArray(exercise.metadata_json?.secondaryMuscles)
      const keywords = normalizeArray(exercise.metadata_json?.keywords)
      const haystack = [
        normalizeLower(exercise.name),
        ...keywords,
        ...bodyParts,
        ...target,
        ...secondary,
      ].join(' ')

      const buckets = classifyExerciseBuckets(exercise)

      let score = 0

      if (profile.tags.some(tag => bodyParts.some(item => item.includes(tag)))) score += 5
      if (profile.tags.some(tag => target.some(item => item.includes(tag)))) score += 4
      if (profile.tags.some(tag => secondary.some(item => item.includes(tag)))) score += 2
      if (profile.keywordHints.some(hint => haystack.includes(hint))) score += 3
      if (focusText && haystack.includes(focusText)) score += 2
      if (bucketHints.some(hint => haystack.includes(hint))) score += 6
      if (buckets.has(bucket)) score += 7
      if (usedExerciseIds.has(exercise.id)) score -= 8

      return { exercise, score }
    })
    .sort((a, b) => b.score - a.score)
}

function toTemplateWorkouts(template: WorkoutProgramTemplateRecord, sessionsPerWeek: number): TemplateWorkoutInput[] {
  const templateWorkouts = Array.isArray(template.template_json?.workouts)
    ? template.template_json.workouts
    : []

  if (templateWorkouts.length > 0) {
    return templateWorkouts.slice(0, Math.max(1, sessionsPerWeek))
  }

  return Array.from({ length: Math.max(1, sessionsPerWeek) }, (_, index) => ({
    day: index + 1,
    focus: index % 2 === 0 ? 'Total Body Strength' : 'Core + Conditioning',
  }))
}

export function buildRandomizedTemplateWorkouts(input: BuildTemplateWorkoutsInput): CoachProgramWorkoutInput[] {
  const sessionsPerWeek = Math.max(1, Math.min(7, Number(input.sessionsPerWeek) || 3))
  const phase = Number(input.template.nasm_opt_phase ?? 1)
  const equipmentAccess = new Set(normalizeArray(input.equipmentAccess))

  const templateWorkouts = toTemplateWorkouts(input.template, sessionsPerWeek)
  const usedExerciseIds = new Set<string>()

  return templateWorkouts.map((workout, dayIndex) => {
    const focus = normalizeText(workout.focus || `Day ${dayIndex + 1}`)
    const profile = buildFocusProfile(focus)
    const buckets = phaseAdjustedBuckets(phase, profile.buckets)

    const selectedByBucket = buckets
      .map(bucket => {
        const candidates = scoredCandidates(input.exercises, profile, bucket, focus, equipmentAccess, usedExerciseIds)
        const viable = candidates.filter(item => item.score > 0)
        const pool = viable.length > 0 ? viable : candidates
        const picked = shuffle(pool.slice(0, 20))[0]
        if (!picked) return null

        usedExerciseIds.add(picked.exercise.id)
        return picked
      })
      .filter(Boolean)

    const deduped = new Map<string, NonNullable<(typeof selectedByBucket)[number]>>()
    for (const item of selectedByBucket) {
      if (!item) continue
      if (!deduped.has(item.exercise.id)) {
        deduped.set(item.exercise.id, item)
      }
    }

    const selected = [...deduped.values()]

    const exercises = selected.map((item, index) => {
      const prescription = buildPrescription(phase, focus, index)

      return {
        libraryExerciseId: item.exercise.id,
        name: item.exercise.name,
        sets: prescription.sets,
        reps: prescription.reps,
        tempo: prescription.tempo,
        rest: prescription.rest,
        notes: null,
      } satisfies CoachProgramExerciseInput
    })

    return {
      day: Number(workout.day) || dayIndex + 1,
      focus,
      notes: normalizeText(workout.notes) || null,
      exercises,
    } satisfies CoachProgramWorkoutInput
  }).filter(workout => workout.exercises.length > 0)
}