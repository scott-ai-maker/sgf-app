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

interface FocusProfile {
  tags: string[]
  keywordHints: string[]
  count: number
}

const LOWER_TAGS = ['legs', 'upper legs', 'lower legs', 'glutes', 'quadriceps', 'hamstrings', 'calves']
const UPPER_PUSH_TAGS = ['chest', 'shoulders', 'triceps']
const UPPER_PULL_TAGS = ['back', 'lats', 'biceps', 'traps', 'rhomboids']
const CORE_TAGS = ['waist', 'abs', 'obliques', 'core']

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
    return { tags: LOWER_TAGS, keywordHints: ['squat', 'lunge', 'deadlift', 'hip'], count: 5 }
  }

  if (value.includes('push') || value.includes('chest') || value.includes('shoulder')) {
    return { tags: UPPER_PUSH_TAGS, keywordHints: ['press', 'push', 'fly', 'dip'], count: 4 }
  }

  if (value.includes('pull') || value.includes('back')) {
    return { tags: UPPER_PULL_TAGS, keywordHints: ['row', 'pull', 'pulldown', 'chin'], count: 4 }
  }

  if (value.includes('core') || value.includes('stability') || value.includes('balance')) {
    return { tags: CORE_TAGS, keywordHints: ['plank', 'carry', 'rotation', 'anti'], count: 4 }
  }

  if (value.includes('power') || value.includes('plyo')) {
    return {
      tags: [...LOWER_TAGS, ...UPPER_PUSH_TAGS, ...UPPER_PULL_TAGS],
      keywordHints: ['jump', 'slam', 'clean', 'snatch', 'power'],
      count: 4,
    }
  }

  return {
    tags: [...LOWER_TAGS, ...UPPER_PUSH_TAGS, ...UPPER_PULL_TAGS, ...CORE_TAGS],
    keywordHints: ['squat', 'press', 'row', 'plank', 'carry'],
    count: 5,
  }
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

function scoredCandidates(
  exercises: TemplateExerciseLibraryRecord[],
  profile: FocusProfile,
  focus: string,
  equipmentAccess: Set<string>
) {
  const focusText = normalizeLower(focus)

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

      let score = 0

      if (profile.tags.some(tag => bodyParts.some(item => item.includes(tag)))) score += 5
      if (profile.tags.some(tag => target.some(item => item.includes(tag)))) score += 4
      if (profile.tags.some(tag => secondary.some(item => item.includes(tag)))) score += 2
      if (profile.keywordHints.some(hint => haystack.includes(hint))) score += 3
      if (focusText && haystack.includes(focusText)) score += 2

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

  return templateWorkouts.map((workout, dayIndex) => {
    const focus = normalizeText(workout.focus || `Day ${dayIndex + 1}`)
    const profile = buildFocusProfile(focus)
    const candidates = scoredCandidates(input.exercises, profile, focus, equipmentAccess)
    const topCandidates = candidates.filter(item => item.score > 0)
    const fallback = candidates
    const selected = shuffle((topCandidates.length >= profile.count ? topCandidates : fallback).slice(0, 30)).slice(0, profile.count)

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