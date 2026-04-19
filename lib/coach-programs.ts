export interface ExerciseLibraryRecord {
  id: string
  name: string
  slug?: string | null
  description?: string | null
  coaching_cues?: string[] | null
  primary_equipment?: string[] | null
  muscle_groups?: string[] | null
  media_image_url?: string | null
  media_video_url?: string | null
}

export interface EquipmentLibraryRecord {
  id: string
  name: string
  slug?: string | null
  description?: string | null
  media_image_url?: string | null
}

export interface WorkoutProgramTemplateRecord {
  id: string
  title: string
  slug?: string | null
  goal?: string | null
  nasm_opt_phase?: number | null
  phase_name?: string | null
  sessions_per_week?: number | null
  estimated_duration_mins?: number | null
  template_json?: {
    workouts?: CoachProgramWorkoutInput[]
  } | null
}

export interface CoachProgramExerciseInput {
  libraryExerciseId?: string | null
  name: string
  sets: string
  reps: string
  tempo?: string | null
  rest?: string | null
  notes?: string | null
}

export interface CoachProgramWorkoutInput {
  day: number
  focus: string
  scheduledDate?: string | null
  notes?: string | null
  exercises: CoachProgramExerciseInput[]
}

export interface CoachProgramPayload {
  clientId: string
  name: string
  goal?: string | null
  nasmOptPhase: number
  phaseName: string
  sessionsPerWeek: number
  estimatedDurationMins: number
  startDate?: string | null
  templateId?: string | null
  workouts: CoachProgramWorkoutInput[]
}

export interface CoachProgramDraft {
  clientId: string
  name: string
  goal?: string | null
  nasmOptPhase: number
  phaseName: string
  sessionsPerWeek: number
  estimatedDurationMins: number
  startDate?: string | null
  templateId?: string | null
  templateTitle?: string | null
  generatedAt: string
  generatedWithEquipmentAccess?: string[]
  workouts: ProgramWorkoutSnapshot[]
}

export interface ProgramExerciseSnapshot {
  libraryExerciseId: string | null
  name: string
  sets: string
  reps: string
  tempo: string | null
  rest: string | null
  notes: string | null
  description: string | null
  coachingCues: string[]
  primaryEquipment: string[]
  imageUrl: string | null
  videoUrl: string | null
}

export interface ProgramWorkoutSnapshot {
  day: number
  focus: string
  scheduledDate: string | null
  notes: string | null
  exercises: ProgramExerciseSnapshot[]
}

export interface ProgramCalendarEntry {
  day: number
  focus: string
  scheduledDate: string | null
  durationMins: number
  exerciseCount: number
}

export interface StoredProgramPlan {
  source: 'coach_builder'
  createdAt: string
  templateId: string | null
  workouts: ProgramWorkoutSnapshot[]
  calendar: ProgramCalendarEntry[]
  librarySummary: {
    exerciseCount: number
    equipmentCount: number
  }
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim()
}

function normalizeOptionalText(value: unknown) {
  const normalized = normalizeText(value)
  return normalized.length > 0 ? normalized : null
}

function normalizeTextArray(values: unknown): string[] {
  if (!Array.isArray(values)) return []

  const seen = new Set<string>()

  return values
    .map(item => normalizeText(item))
    .filter(item => {
      if (!item) return false
      const key = item.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const [, year, month, day] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addUtcDays(date: Date, days: number) {
  const copy = new Date(date.getTime())
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

function buildGeneratedDates(startDate: string | null | undefined, count: number, sessionsPerWeek: number) {
  const parsedStart = parseDateOnly(startDate)
  if (!parsedStart || count <= 0) return []

  const spacing = Math.max(1, Math.ceil(7 / Math.max(1, sessionsPerWeek)))
  return Array.from({ length: count }, (_, index) => formatDateOnly(addUtcDays(parsedStart, index * spacing)))
}

function findExerciseMatch(
  exercise: CoachProgramExerciseInput,
  byId: Map<string, ExerciseLibraryRecord>,
  byName: Map<string, ExerciseLibraryRecord>
) {
  const id = normalizeOptionalText(exercise.libraryExerciseId)
  const exactName = normalizeText(exercise.name).toLowerCase()

  if (id && byId.has(id)) {
    return byId.get(id) ?? null
  }

  if (exactName && byName.has(exactName)) {
    return byName.get(exactName) ?? null
  }

  return null
}

export function buildStoredProgramPlan(
  payload: CoachProgramPayload,
  exercises: ExerciseLibraryRecord[],
  equipmentLibrary: EquipmentLibraryRecord[]
): StoredProgramPlan {
  const exerciseById = new Map(exercises.map(exercise => [exercise.id, exercise]))
  const exerciseByName = new Map(exercises.map(exercise => [exercise.name.trim().toLowerCase(), exercise]))
  const generatedDates = buildGeneratedDates(payload.startDate, payload.workouts.length, payload.sessionsPerWeek)

  let generatedDateIndex = 0

  const workouts = payload.workouts
    .map<ProgramWorkoutSnapshot | null>((workout, index) => {
      const focus = normalizeText(workout.focus)
      const explicitScheduledDate = normalizeOptionalText(workout.scheduledDate)
      const scheduledDate = explicitScheduledDate ?? generatedDates[generatedDateIndex++] ?? null
      const notes = normalizeOptionalText(workout.notes)

      const sanitizedExercises = (Array.isArray(workout.exercises) ? workout.exercises : [])
        .map(exercise => {
          const name = normalizeText(exercise.name)
          if (!name) return null

          const match = findExerciseMatch(exercise, exerciseById, exerciseByName)

          return {
            libraryExerciseId: match?.id ?? normalizeOptionalText(exercise.libraryExerciseId),
            name,
            sets: normalizeText(exercise.sets),
            reps: normalizeText(exercise.reps),
            tempo: normalizeOptionalText(exercise.tempo),
            rest: normalizeOptionalText(exercise.rest),
            notes: normalizeOptionalText(exercise.notes),
            description: normalizeOptionalText(match?.description),
            coachingCues: normalizeTextArray(match?.coaching_cues),
            primaryEquipment: normalizeTextArray(match?.primary_equipment),
            imageUrl: normalizeOptionalText(match?.media_image_url),
            videoUrl: normalizeOptionalText(match?.media_video_url),
          } satisfies ProgramExerciseSnapshot
        })
        .filter((exercise): exercise is ProgramExerciseSnapshot => Boolean(exercise))

      if (!focus || sanitizedExercises.length === 0) return null

      return {
        day: Number(workout.day) || index + 1,
        focus,
        scheduledDate,
        notes,
        exercises: sanitizedExercises,
      } satisfies ProgramWorkoutSnapshot
    })
    .filter(Boolean) as ProgramWorkoutSnapshot[]

  const equipmentNames = new Set(
    workouts.flatMap(workout => workout.exercises.flatMap(exercise => exercise.primaryEquipment.map(item => item.toLowerCase())))
  )

  return {
    source: 'coach_builder',
    createdAt: new Date().toISOString(),
    templateId: normalizeOptionalText(payload.templateId),
    workouts,
    calendar: workouts.map(workout => ({
      day: workout.day,
      focus: workout.focus,
      scheduledDate: workout.scheduledDate,
      durationMins: payload.estimatedDurationMins,
      exerciseCount: workout.exercises.length,
    })),
    librarySummary: {
      exerciseCount: exercises.length,
      equipmentCount: equipmentLibrary.filter(item => equipmentNames.has(item.name.trim().toLowerCase())).length,
    },
  }
}

export function buildPlanName(payload: Pick<CoachProgramPayload, 'name' | 'phaseName'>) {
  const explicitName = normalizeText(payload.name)
  if (explicitName) return explicitName
  return `${normalizeText(payload.phaseName) || 'Custom'} Program`
}