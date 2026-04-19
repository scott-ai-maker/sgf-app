'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import WorkoutCalendarView from '@/components/fitness/WorkoutCalendarView'
import type {
  CoachProgramDraft,
  CoachProgramTemplateRecord,
  ExerciseLibraryRecord,
  EquipmentLibraryRecord,
  WorkoutProgramTemplateRecord,
} from '@/lib/coach-programs'

interface LatestWorkoutPlan {
  id?: string | null
  name?: string | null
  goal?: string | null
  nasm_opt_phase?: number | null
  phase_name?: string | null
  sessions_per_week?: number | null
  estimated_duration_mins?: number | null
  plan_json?: {
    workouts?: BuilderWorkoutDay[]
  } | null
}

interface BuilderExercise {
  id: string
  libraryExerciseId: string
  name: string
  block: string
  sets: string
  reps: string
  tempo: string
  rest: string
  notes: string
  description: string
  primaryEquipment: string[]
  imageUrl: string
  videoUrl: string
}

interface BuilderWorkoutDay {
  day: number
  focus: string
  scheduledDate?: string | null
  notes?: string | null
  exercises: Array<{
    libraryExerciseId?: string | null
    name: string
    block?: string | null
    sets: string
    reps: string
    tempo?: string | null
    rest?: string | null
    notes?: string | null
    description?: string | null
    primaryEquipment?: string[] | null
    imageUrl?: string | null
    videoUrl?: string | null
  }>
}

interface CoachProgramBuilderProps {
  clientId: string
  latestPlan: LatestWorkoutPlan | null
  templates: WorkoutProgramTemplateRecord[]
  coachTemplates?: CoachProgramTemplateRecord[]
  exercises: ExerciseLibraryRecord[]
  equipment: EquipmentLibraryRecord[]
  contraindicationNotes?: string[]
  readinessSummary?: {
    completionRate14d: number
    avgRpe14d: number | null
    completedSessions7d: number
    daysSinceLastCompleted: number | null
    readiness: 'high' | 'moderate' | 'low'
    recommendation: string
  }
  initialEquipmentAccess?: string[]
  draftPlan?: CoachProgramDraft | null
  onPlanSaved?: () => void
}

interface PickerTarget {
  dayId: string
  exerciseId: string
}

interface CategorizedExercise {
  record: ExerciseLibraryRecord
  category: string
  equipmentKey: string
}

type SearchMatchResult = {
  matched: boolean
  score: number
}

const EXERCISE_SEARCH_ALIASES: Record<string, string[]> = {
  squat: ['back squat', 'front squat', 'goblet squat', 'air squat'],
  deadlift: ['rdl', 'romanian deadlift', 'hinge', 'trap bar'],
  bench: ['bench press', 'flat press', 'chest press'],
  row: ['cable row', 'seated row', 'db row', 'dumbbell row'],
  press: ['ohp', 'overhead press', 'shoulder press'],
  pullup: ['pull-up', 'chin-up', 'chin up', 'lat pull'],
  lunge: ['split squat', 'reverse lunge', 'walking lunge'],
  plank: ['core brace', 'hollow hold', 'anti-extension'],
  hamstring: ['ham curl', 'leg curl', 'rdl'],
  glute: ['hip thrust', 'bridge', 'glute bridge'],
  calf: ['calf raise', 'standing calf', 'seated calf'],
}

const DEFAULT_DAY_NOTE_SNIPPETS = [
  'Prioritize movement quality and stable tempo over load today.',
  'Keep all sets at RPE 7-8 and stop 2 reps before technical breakdown.',
  'Use regressions as needed and avoid symptom-provoking ranges.',
  'Coach breathing and bracing on every primary lift.',
]

const DEFAULT_EXERCISE_NOTE_SNIPPETS = [
  'Control eccentric for 3 seconds and pause before concentric.',
  'Leave 1-2 reps in reserve across all working sets.',
  'If pain appears, reduce ROM and switch to the listed regression.',
  'Focus on full range with clean tempo before adding load.',
]

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokenizeSearch(value: string) {
  return normalizeSearchText(value).split(' ').filter(Boolean)
}

function boundedEditDistance(a: string, b: string, maxDistance: number) {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1
  if (a === b) return 0

  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i += 1) {
    let prev = dp[0]
    dp[0] = i
    let rowMin = dp[0]

    for (let j = 1; j <= b.length; j += 1) {
      const temp = dp[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + cost,
      )
      prev = temp
      rowMin = Math.min(rowMin, dp[j])
    }

    if (rowMin > maxDistance) return maxDistance + 1
  }

  return dp[b.length]
}

function getSearchMatchScore(query: string, item: CategorizedExercise) {
  if (!query) return { matched: true, score: 0 }

  const normalizedQuery = normalizeSearchText(query)
  const name = normalizeSearchText(item.record.name)
  const equipment = normalizeSearchText(equipmentBadges(item.record.primary_equipment).join(' '))
  const aliases = Object.entries(EXERCISE_SEARCH_ALIASES)
    .filter(([key]) => name.includes(key))
    .flatMap(([, values]) => values)
  const aliasText = normalizeSearchText(aliases.join(' '))

  if (name === normalizedQuery) return { matched: true, score: 120 }
  if (name.startsWith(normalizedQuery)) return { matched: true, score: 100 }
  if (name.includes(normalizedQuery)) return { matched: true, score: 88 }
  if (aliasText.includes(normalizedQuery)) return { matched: true, score: 78 }
  if (equipment.includes(normalizedQuery)) return { matched: true, score: 68 }

  const queryTokens = tokenizeSearch(normalizedQuery)
  const nameTokens = tokenizeSearch(name)
  const aliasTokens = tokenizeSearch(aliasText)

  const tokenPrefixHit = queryTokens.some(queryToken => (
    nameTokens.some(token => token.startsWith(queryToken))
    || aliasTokens.some(token => token.startsWith(queryToken))
  ))
  if (tokenPrefixHit) return { matched: true, score: 62 }

  if (normalizedQuery.length >= 4) {
    const distanceTargetTokens = [...nameTokens, ...aliasTokens].filter(token => token.length >= 4)
    const fuzzyHit = distanceTargetTokens.some(token => boundedEditDistance(token, normalizedQuery, 2) <= 2)
    if (fuzzyHit) return { matched: true, score: 52 }
  }

  return { matched: false, score: 0 }
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
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

function formatDayList(days: number[]) {
  if (days.length === 1) {
    return `day ${days[0]}`
  }

  return `days ${days.join(', ')}`
}

function toBuilderExercise(exercise?: BuilderWorkoutDay['exercises'][number]): BuilderExercise {
  return {
    id: uid(),
    libraryExerciseId: String(exercise?.libraryExerciseId ?? '').trim(),
    name: String(exercise?.name ?? '').trim(),
    block: String(exercise?.block ?? '').trim(),
    sets: String(exercise?.sets ?? '3').trim(),
    reps: String(exercise?.reps ?? '10').trim(),
    tempo: String(exercise?.tempo ?? '').trim(),
    rest: String(exercise?.rest ?? '').trim(),
    notes: String(exercise?.notes ?? '').trim(),
    description: String(exercise?.description ?? '').trim(),
    primaryEquipment: Array.isArray(exercise?.primaryEquipment) ? exercise.primaryEquipment.filter(Boolean) : [],
    imageUrl: String(exercise?.imageUrl ?? '').trim(),
    videoUrl: String(exercise?.videoUrl ?? '').trim(),
  }
}

function createBlankExercise() {
  return toBuilderExercise()
}

function toBuilderDay(day?: BuilderWorkoutDay, fallbackDay = 1) {
  return {
    id: uid(),
    day: Number(day?.day) || fallbackDay,
    focus: String(day?.focus ?? '').trim(),
    scheduledDate: String(day?.scheduledDate ?? '').trim(),
    notes: String(day?.notes ?? '').trim(),
    exercises: Array.isArray(day?.exercises) && day.exercises.length > 0
      ? day.exercises.map(exercise => toBuilderExercise(exercise))
      : [createBlankExercise()],
  }
}

function initialDaysFromPlan(plan: LatestWorkoutPlan | null) {
  const workouts = plan?.plan_json?.workouts
  if (!Array.isArray(workouts) || workouts.length === 0) {
    return [toBuilderDay(undefined, 1)]
  }

  return workouts.map((workout, index) => toBuilderDay(workout, index + 1))
}

function formatExerciseDescriptionLines(description: string | null | undefined) {
  const text = String(description ?? '')
    .replace(/\r/g, '')
    .replace(/\n\nEquipment\s*:[\s\S]*$/i, '')
    .replace(/\nEquipment\s*:[\s\S]*$/i, '')
    .replace(/\s+Equipment\s*:[\s\S]*$/i, '')
    .trim()
  if (!text) return []

  const numberedSteps = text.match(/Step\s*\d+\s*:[\s\S]*?(?=(?:\s*Step\s*\d+\s*:)|$)/gi)
  if (numberedSteps && numberedSteps.length > 1) {
    return numberedSteps.map(step => step.replace(/\s+/g, ' ').trim()).filter(Boolean)
  }

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  return lines.length > 0 ? lines : [text]
}

function equipmentBadges(primaryEquipment: string[] | null | undefined) {
  const items = Array.isArray(primaryEquipment)
    ? primaryEquipment.map(item => String(item ?? '').trim()).filter(Boolean)
    : []

  return items.length > 0 ? items : ['Bodyweight']
}

function inferExerciseCategory(name: string) {
  const normalized = name.toLowerCase()

  if (/(jump|plyo|power|medicine ball throw|slam)/.test(normalized)) return 'Power & Plyo'
  if (/(plank|crunch|core|dead bug|hollow|rotation|woodchop|anti-rotation)/.test(normalized)) return 'Core'
  if (/(squat|lunge|split squat|hinge|deadlift|hamstring|glute|calf|leg)/.test(normalized)) return 'Lower Body'
  if (/(press|push up|push-up|dip|chest|tricep|shoulder press|incline press)/.test(normalized)) return 'Upper Push'
  if (/(row|pull|chin up|chin-up|face pull|lat|rear delt|bicep)/.test(normalized)) return 'Upper Pull'
  if (/(mobility|stretch|activation|stability|balance|corrective)/.test(normalized)) return 'Mobility & Corrective'
  return 'Full Body & Other'
}

function suggestCategoryFromDayFocus(focus: string) {
  const normalized = focus.toLowerCase()
  if (!normalized) return 'All Categories'

  if (/(push|chest|shoulder|tricep)/.test(normalized)) return 'Upper Push'
  if (/(pull|back|lat|bicep|row)/.test(normalized)) return 'Upper Pull'
  if (/(lower|leg|glute|squat|hinge|hamstring|quad)/.test(normalized)) return 'Lower Body'
  if (/(core|abs|rotation|anti-rotation|stability)/.test(normalized)) return 'Core'
  if (/(power|plyo|jump|explosive)/.test(normalized)) return 'Power & Plyo'
  if (/(mobility|corrective|recovery|warmup|warm-up)/.test(normalized)) return 'Mobility & Corrective'

  return 'All Categories'
}

function recentsStorageKey(clientId: string) {
  return `coach-program-recents:${clientId}`
}

function favoritesStorageKey(clientId: string) {
  return `coach-program-favorites:${clientId}`
}

function daySnippetsStorageKey(clientId: string) {
  return `coach-program-day-snippets:${clientId}`
}

function exerciseSnippetsStorageKey(clientId: string) {
  return `coach-program-exercise-snippets:${clientId}`
}

function appendSnippet(existingValue: string, snippet: string) {
  const current = String(existingValue ?? '').trim()
  const next = String(snippet ?? '').trim()
  if (!next) return current
  if (!current) return next
  if (current.toLowerCase().includes(next.toLowerCase())) return current
  return `${current} ${next}`.trim()
}

type ContraindicationRule = {
  profilePattern: RegExp
  exercisePattern: RegExp
  warning: string
}

type ProgressionSuggestion = {
  sets: string
  reps: string
  tempo: string
  rest: string
  rationale: string
}

const CONTRAINDICATION_RULES: ContraindicationRule[] = [
  {
    profilePattern: /(knee|acl|meniscus|patellar|patella)/i,
    exercisePattern: /(jump|plyo|lunge|split squat|squat|leg press|box jump|running|bound)/i,
    warning: 'Knee-related limitation detected. Verify loading, ROM, and impact tolerance for this movement.',
  },
  {
    profilePattern: /(shoulder|rotator cuff|labrum|impingement|overhead pain)/i,
    exercisePattern: /(overhead|press|push up|push-up|dip|snatch|jerk|lat pulldown|pull-up|pull up)/i,
    warning: 'Shoulder-related limitation detected. Consider regression, grip/angle changes, or reduced overhead demand.',
  },
  {
    profilePattern: /(low back|lumbar|disc|sciatica|back pain)/i,
    exercisePattern: /(deadlift|good morning|hinge|row|squat|clean|snatch|kettlebell swing|barbell)/i,
    warning: 'Low-back limitation detected. Confirm bracing strategy, spinal tolerance, and exercise selection.',
  },
  {
    profilePattern: /(neck|cervical)/i,
    exercisePattern: /(shrug|overhead|carry|press)/i,
    warning: 'Neck/cervical limitation detected. Review head/neck position and loading approach.',
  },
]

function normalizeEquipmentToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function equipmentMatchesAccess(equipmentLabel: string, allowedEquipment: string[]) {
  const normalizedLabel = normalizeEquipmentToken(equipmentLabel)
  if (!normalizedLabel) return true

  return allowedEquipment.some(item => {
    const normalizedItem = normalizeEquipmentToken(item)
    return normalizedItem.includes(normalizedLabel) || normalizedLabel.includes(normalizedItem)
  })
}

function firstPositiveInt(value: string, fallback: number) {
  const match = String(value ?? '').match(/\d+/)
  const parsed = match ? Number(match[0]) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function formatRestSeconds(seconds: number) {
  return `${Math.max(0, seconds)}s`
}

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function buildProgressionSuggestion(exercise: BuilderExercise, phaseNumber: number): ProgressionSuggestion {
  const baseSets = firstPositiveInt(exercise.sets, 3)
  const baseReps = firstPositiveInt(exercise.reps, 10)
  const baseRest = firstPositiveInt(exercise.rest, 60)
  const baseTempo = String(exercise.tempo ?? '').trim()

  if (phaseNumber <= 1) {
    return {
      sets: String(Math.min(baseSets + 1, 4)),
      reps: String(Math.min(baseReps + 2, 20)),
      tempo: baseTempo || '4/2/1',
      rest: formatRestSeconds(Math.max(baseRest - 15, 45)),
      rationale: 'Stabilization progression: slightly more volume and slower controlled tempo.',
    }
  }

  if (phaseNumber === 2) {
    return {
      sets: String(Math.min(baseSets + 1, 5)),
      reps: String(Math.min(Math.max(baseReps, 8) + 1, 12)),
      tempo: baseTempo || '2/0/2',
      rest: formatRestSeconds(Math.max(baseRest - 15, 45)),
      rationale: 'Strength-endurance progression: add volume while keeping rest tighter.',
    }
  }

  if (phaseNumber === 3) {
    return {
      sets: String(Math.min(baseSets + 1, 5)),
      reps: String(Math.min(Math.max(baseReps, 6) + 1, 12)),
      tempo: baseTempo || '2/0/2',
      rest: formatRestSeconds(Math.max(baseRest, 60)),
      rationale: 'Hypertrophy progression: increase total work and maintain moderate tempo/rest.',
    }
  }

  if (phaseNumber === 4) {
    return {
      sets: String(Math.min(baseSets + 1, 6)),
      reps: String(Math.max(3, Math.min(baseReps - 1, 6))),
      tempo: baseTempo || 'X/0/X',
      rest: formatRestSeconds(Math.max(baseRest, 120)),
      rationale: 'Max-strength progression: lower rep targets with longer recovery.',
    }
  }

  return {
    sets: String(Math.min(baseSets + 1, 6)),
    reps: String(Math.max(3, Math.min(baseReps, 8))),
    tempo: baseTempo || 'X/0/X',
    rest: formatRestSeconds(Math.max(baseRest, 90)),
    rationale: 'Power progression: prioritize speed intent with adequate rest.',
  }
}

function normalizeEquipmentKey(primaryEquipment: string[] | null | undefined) {
  const first = Array.isArray(primaryEquipment) ? String(primaryEquipment[0] ?? '').trim().toLowerCase() : ''
  if (!first || first === 'none') return 'Bodyweight'
  if (first.includes('dumbbell')) return 'Dumbbells'
  if (first.includes('barbell')) return 'Barbell'
  if (first.includes('kettlebell')) return 'Kettlebell'
  if (first.includes('bench')) return 'Bench'
  if (first.includes('cable')) return 'Cable'
  if (first.includes('band') || first.includes('tube')) return 'Band'
  if (first.includes('machine') || first.includes('smith')) return 'Machine'
  return first.replace(/\b\w/g, char => char.toUpperCase())
}

function hydrateExerciseFromRecord(exercise: BuilderExercise, match: ExerciseLibraryRecord | null) {
  if (!match) {
    return {
      ...exercise,
      libraryExerciseId: '',
      description: '',
      primaryEquipment: [],
      imageUrl: '',
      videoUrl: '',
    }
  }

  return {
    ...exercise,
    libraryExerciseId: match.id,
    description: String(match.description ?? '').trim(),
    primaryEquipment: Array.isArray(match.primary_equipment) ? match.primary_equipment.filter(Boolean) : [],
    imageUrl: String(match.media_image_url ?? '').trim(),
    videoUrl: String(match.media_video_url ?? '').trim(),
  }
}

function isDraftPlan(plan: LatestWorkoutPlan | CoachProgramDraft | null): plan is CoachProgramDraft {
  return Boolean(plan && 'generatedAt' in plan)
}

function toEditorState(plan: LatestWorkoutPlan | CoachProgramDraft | null) {
  const workouts = isDraftPlan(plan) ? plan.workouts : plan?.plan_json?.workouts

  return {
    templateId: String((isDraftPlan(plan) ? plan.templateId : '') ?? '').trim(),
    name: String(plan?.name ?? '').trim(),
    goal: String(plan?.goal ?? '').trim(),
    nasmOptPhase: String((isDraftPlan(plan) ? plan.nasmOptPhase : plan?.nasm_opt_phase) ?? 1),
    phaseName: String((isDraftPlan(plan) ? plan.phaseName : plan?.phase_name) ?? 'Stabilization Endurance').trim(),
    sessionsPerWeek: String((isDraftPlan(plan) ? plan.sessionsPerWeek : plan?.sessions_per_week) ?? 3),
    estimatedDurationMins: String((isDraftPlan(plan) ? plan.estimatedDurationMins : plan?.estimated_duration_mins) ?? 60),
    startDate: String((isDraftPlan(plan) ? plan.startDate : '') ?? '').trim() || new Date().toISOString().slice(0, 10),
    days: Array.isArray(workouts) && workouts.length > 0
      ? workouts.map((day, index) => toBuilderDay(day as BuilderWorkoutDay, index + 1))
      : [toBuilderDay(undefined, 1)],
  }
}

export default function CoachProgramBuilder({ clientId, latestPlan, templates, coachTemplates = [], exercises, equipment, contraindicationNotes = [], readinessSummary, initialEquipmentAccess = [], draftPlan = null, onPlanSaved }: CoachProgramBuilderProps) {
  const router = useRouter()
  const exerciseListId = `exercise-library-${clientId}`
  const initialEditorState = toEditorState(latestPlan)
  const [templateId, setTemplateId] = useState(initialEditorState.templateId)
  const [name, setName] = useState(initialEditorState.name)
  const [goal, setGoal] = useState(initialEditorState.goal)
  const [nasmOptPhase, setNasmOptPhase] = useState(initialEditorState.nasmOptPhase)
  const [phaseName, setPhaseName] = useState(initialEditorState.phaseName)
  const [sessionsPerWeek, setSessionsPerWeek] = useState(initialEditorState.sessionsPerWeek)
  const [estimatedDurationMins, setEstimatedDurationMins] = useState(initialEditorState.estimatedDurationMins)
  const [startDate, setStartDate] = useState(initialEditorState.startDate)
  const [days, setDays] = useState(initialEditorState.days)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerCategory, setPickerCategory] = useState('All Categories')
  const [pickerEquipment, setPickerEquipment] = useState('All Equipment')
  const [pickerMultiAdd, setPickerMultiAdd] = useState(false)
  const [recentExerciseIds, setRecentExerciseIds] = useState<string[]>([])
  const [favoriteExerciseIds, setFavoriteExerciseIds] = useState<string[]>([])
  const [customDaySnippets, setCustomDaySnippets] = useState<string[]>([])
  const [customExerciseSnippets, setCustomExerciseSnippets] = useState<string[]>([])
  const [copyExerciseModal, setCopyExerciseModal] = useState<{ dayId: string; exerciseId: string } | null>(null)
  const [saveTemplateModal, setSaveTemplateModal] = useState(false)
  const [templateSaveBusy, setTemplateSaveBusy] = useState(false)
  const [templateSaveStatus, setTemplateSaveStatus] = useState<string | null>(null)
  const [restTimerTotal, setRestTimerTotal] = useState(60)
  const [restTimerRemaining, setRestTimerRemaining] = useState(60)
  const [restTimerRunning, setRestTimerRunning] = useState(false)

  useEffect(() => {
    if (!draftPlan) return

    const nextState = toEditorState(draftPlan)
    setTemplateId(nextState.templateId)
    setName(nextState.name)
    setGoal(nextState.goal)
    setNasmOptPhase(nextState.nasmOptPhase)
    setPhaseName(nextState.phaseName)
    setSessionsPerWeek(nextState.sessionsPerWeek)
    setEstimatedDurationMins(nextState.estimatedDurationMins)
    setStartDate(nextState.startDate)
    setDays(nextState.days)
    setStatus('Quick-generated draft loaded. Review, adjust, then accept by saving.')
  }, [draftPlan])

  useEffect(() => {
    if (draftPlan) return

    const nextState = toEditorState(latestPlan)
    setTemplateId(nextState.templateId)
    setName(nextState.name)
    setGoal(nextState.goal)
    setNasmOptPhase(nextState.nasmOptPhase)
    setPhaseName(nextState.phaseName)
    setSessionsPerWeek(nextState.sessionsPerWeek)
    setEstimatedDurationMins(nextState.estimatedDurationMins)
    setStartDate(nextState.startDate)
    setDays(nextState.days)
  }, [draftPlan, latestPlan])

  useEffect(() => {
    const recentsRaw = window.localStorage.getItem(recentsStorageKey(clientId))
    const favoritesRaw = window.localStorage.getItem(favoritesStorageKey(clientId))
    const daySnippetsRaw = window.localStorage.getItem(daySnippetsStorageKey(clientId))
    const exerciseSnippetsRaw = window.localStorage.getItem(exerciseSnippetsStorageKey(clientId))

    try {
      const parsedRecents = recentsRaw ? JSON.parse(recentsRaw) : []
      const parsedFavorites = favoritesRaw ? JSON.parse(favoritesRaw) : []
      const parsedDaySnippets = daySnippetsRaw ? JSON.parse(daySnippetsRaw) : []
      const parsedExerciseSnippets = exerciseSnippetsRaw ? JSON.parse(exerciseSnippetsRaw) : []
      setRecentExerciseIds(Array.isArray(parsedRecents) ? parsedRecents.filter(Boolean).slice(0, 16) : [])
      setFavoriteExerciseIds(Array.isArray(parsedFavorites) ? parsedFavorites.filter(Boolean).slice(0, 32) : [])
      setCustomDaySnippets(Array.isArray(parsedDaySnippets) ? parsedDaySnippets.filter(Boolean).slice(0, 12) : [])
      setCustomExerciseSnippets(Array.isArray(parsedExerciseSnippets) ? parsedExerciseSnippets.filter(Boolean).slice(0, 16) : [])
    } catch {
      setRecentExerciseIds([])
      setFavoriteExerciseIds([])
      setCustomDaySnippets([])
      setCustomExerciseSnippets([])
    }
  }, [clientId])

  useEffect(() => {
    window.localStorage.setItem(recentsStorageKey(clientId), JSON.stringify(recentExerciseIds.slice(0, 16)))
  }, [clientId, recentExerciseIds])

  useEffect(() => {
    window.localStorage.setItem(favoritesStorageKey(clientId), JSON.stringify(favoriteExerciseIds.slice(0, 32)))
  }, [clientId, favoriteExerciseIds])

  useEffect(() => {
    window.localStorage.setItem(daySnippetsStorageKey(clientId), JSON.stringify(customDaySnippets.slice(0, 12)))
  }, [clientId, customDaySnippets])

  useEffect(() => {
    window.localStorage.setItem(exerciseSnippetsStorageKey(clientId), JSON.stringify(customExerciseSnippets.slice(0, 16)))
  }, [clientId, customExerciseSnippets])

  useEffect(() => {
    if (!restTimerRunning) return

    const timer = window.setInterval(() => {
      setRestTimerRemaining(current => {
        if (current <= 1) {
          window.clearInterval(timer)
          setRestTimerRunning(false)
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [restTimerRunning])

  const exerciseMap = useMemo(() => {
    return new Map(exercises.map(exercise => [exercise.name.trim().toLowerCase(), exercise]))
  }, [exercises])

  const exerciseCatalog = useMemo<CategorizedExercise[]>(() => {
    return exercises.map(record => ({
      record,
      category: inferExerciseCategory(record.name),
      equipmentKey: normalizeEquipmentKey(record.primary_equipment),
    }))
  }, [exercises])

  const categoryOptions = useMemo(() => {
    return ['All Categories', ...new Set(exerciseCatalog.map(item => item.category))]
  }, [exerciseCatalog])

  const equipmentOptions = useMemo(() => {
    return ['All Equipment', ...new Set(exerciseCatalog.map(item => item.equipmentKey))]
  }, [exerciseCatalog])

  const filteredPickerExercises = useMemo(() => {
    const query = pickerQuery.trim().toLowerCase()
    const ranked = exerciseCatalog
      .filter(item => (pickerCategory === 'All Categories' ? true : item.category === pickerCategory))
      .filter(item => (pickerEquipment === 'All Equipment' ? true : item.equipmentKey === pickerEquipment))
      .map(item => {
        const match = getSearchMatchScore(query, item)
        return {
          item,
          score: match.score,
          matched: match.matched,
        }
      })
      .filter(entry => entry.matched)
      .sort((a, b) => {
        const aFavorite = favoriteExerciseIds.includes(a.item.record.id) ? 1 : 0
        const bFavorite = favoriteExerciseIds.includes(b.item.record.id) ? 1 : 0
        if (aFavorite !== bFavorite) return bFavorite - aFavorite

        if (a.score !== b.score) return b.score - a.score

        const aRecent = recentExerciseIds.indexOf(a.item.record.id)
        const bRecent = recentExerciseIds.indexOf(b.item.record.id)
        if (aRecent !== -1 || bRecent !== -1) {
          if (aRecent === -1) return 1
          if (bRecent === -1) return -1
          return aRecent - bRecent
        }

        return a.item.record.name.localeCompare(b.item.record.name)
      })
      .map(entry => entry.item)

    return ranked
      .slice(0, 80)
  }, [exerciseCatalog, favoriteExerciseIds, pickerCategory, pickerEquipment, pickerQuery, recentExerciseIds])

  const exerciseById = useMemo(() => {
    return new Map(exercises.map(exercise => [exercise.id, exercise]))
  }, [exercises])

  const recentExercises = useMemo(() => {
    return recentExerciseIds.map(id => exerciseById.get(id)).filter((item): item is ExerciseLibraryRecord => Boolean(item))
  }, [exerciseById, recentExerciseIds])

  const favoriteExercises = useMemo(() => {
    return favoriteExerciseIds.map(id => exerciseById.get(id)).filter((item): item is ExerciseLibraryRecord => Boolean(item))
  }, [exerciseById, favoriteExerciseIds])

  const dayNoteSnippets = useMemo(() => {
    return [...DEFAULT_DAY_NOTE_SNIPPETS, ...customDaySnippets].slice(0, 16)
  }, [customDaySnippets])

  const exerciseNoteSnippets = useMemo(() => {
    return [...DEFAULT_EXERCISE_NOTE_SNIPPETS, ...customExerciseSnippets].slice(0, 20)
  }, [customExerciseSnippets])

  const contraindicationText = useMemo(() => {
    return contraindicationNotes.map(item => String(item ?? '').trim()).filter(Boolean).join(' | ').toLowerCase()
  }, [contraindicationNotes])

  const normalizedEquipmentAccess = useMemo(() => {
    return initialEquipmentAccess.map(item => String(item ?? '').trim()).filter(Boolean)
  }, [initialEquipmentAccess])

  const currentPhaseNumber = useMemo(() => {
    const parsed = Number(nasmOptPhase)
    if (!Number.isFinite(parsed)) return 1
    return Math.min(5, Math.max(1, Math.round(parsed)))
  }, [nasmOptPhase])

  function getExerciseWarnings(exercise: BuilderExercise) {
    const warnings: string[] = []

    if (contraindicationText) {
      const exerciseText = `${exercise.name} ${exercise.notes} ${exercise.description}`.toLowerCase()

      CONTRAINDICATION_RULES.forEach(rule => {
        if (rule.profilePattern.test(contraindicationText) && rule.exercisePattern.test(exerciseText)) {
          warnings.push(rule.warning)
        }
      })
    }

    if (normalizedEquipmentAccess.length > 0) {
      const unavailableEquipment = equipmentBadges(exercise.primaryEquipment)
        .filter(item => item.toLowerCase() !== 'bodyweight')
        .filter(item => !equipmentMatchesAccess(item, normalizedEquipmentAccess))

      if (unavailableEquipment.length > 0) {
        warnings.push(`Client profile may not have required equipment: ${unavailableEquipment.join(', ')}.`)
      }
    }

    return [...new Set(warnings)]
  }

  function applyProgressionSuggestion(dayId: string, exerciseId: string, suggestion: ProgressionSuggestion) {
    setDays(current =>
      current.map(day => {
        if (day.id !== dayId) return day

        return {
          ...day,
          exercises: day.exercises.map(exercise => {
            if (exercise.id !== exerciseId) return exercise

            const nextNotes = String(exercise.notes ?? '').includes('Progression:')
              ? exercise.notes
              : `${exercise.notes ? `${exercise.notes}. ` : ''}Progression: ${suggestion.rationale}`

            return {
              ...exercise,
              sets: suggestion.sets,
              reps: suggestion.reps,
              tempo: suggestion.tempo,
              rest: suggestion.rest,
              notes: nextNotes,
            }
          }),
        }
      })
    )
  }

  const calendarEntries = useMemo(() => {
    const parsedStart = parseDateOnly(startDate)
    const spacing = Math.max(1, Math.ceil(7 / Math.max(1, Number(sessionsPerWeek) || 1)))
    let generatedIndex = 0

    return days
      .map((day, index) => {
        const explicitDate = parseDateOnly(day.scheduledDate)
        const generatedDate = !explicitDate && parsedStart ? addUtcDays(parsedStart, generatedIndex++ * spacing) : null
        const scheduledDate = explicitDate ?? generatedDate
        if (!scheduledDate) return null

        return {
          date: formatDateOnly(scheduledDate),
          title: `Day ${index + 1}: ${day.focus || 'Workout Session'}`,
          subtitle: `${day.exercises.length} exercise${day.exercises.length === 1 ? '' : 's'}`,
        }
      })
      .filter((entry): entry is { date: string; title: string; subtitle: string } => Boolean(entry))
  }, [days, sessionsPerWeek, startDate])

  const validationMessages = useMemo(() => {
    const missingFocusDays: number[] = []
    const missingExerciseNameDays: number[] = []

    days.forEach((day, index) => {
      if (!String(day.focus ?? '').trim()) {
        missingFocusDays.push(index + 1)
      }

      if (day.exercises.some(exercise => !String(exercise.name ?? '').trim())) {
        missingExerciseNameDays.push(index + 1)
      }
    })

    const messages: string[] = []

    if (missingFocusDays.length > 0) {
      messages.push(`Add a focus for ${formatDayList(missingFocusDays)}.`)
    }

    if (missingExerciseNameDays.length > 0) {
      messages.push(`Add exercise names for ${formatDayList(missingExerciseNameDays)}.`)
    }

    return messages
  }, [days])

  const dayDensity = useMemo(() => {
    return days.map(day => {
      const totals = day.exercises.reduce((acc, exercise) => {
        const sets = firstPositiveInt(exercise.sets, 3)
        const reps = firstPositiveInt(exercise.reps, 10)
        const rest = firstPositiveInt(exercise.rest, 60)

        const workSeconds = sets * 40
        const restSeconds = Math.max(0, sets - 1) * rest

        acc.totalSets += sets
        acc.totalReps += sets * reps
        acc.workSeconds += workSeconds
        acc.restSeconds += restSeconds
        return acc
      }, { totalSets: 0, totalReps: 0, workSeconds: 0, restSeconds: 0 })

      const totalSeconds = totals.workSeconds + totals.restSeconds
      const density = totalSeconds > 0 ? Math.round((totals.workSeconds / totalSeconds) * 100) : 0

      return {
        dayId: day.id,
        totalSets: totals.totalSets,
        totalReps: totals.totalReps,
        workMins: Math.round(totals.workSeconds / 60),
        restMins: Math.round(totals.restSeconds / 60),
        totalMins: Math.round(totalSeconds / 60),
        density,
      }
    })
  }, [days])

  function applyTemplate(nextTemplateId: string) {
    setTemplateId(nextTemplateId)

    if (!nextTemplateId) {
      return
    }

    // Search for template in both licensed templates and coach templates
    let template = templates.find(item => item.id === nextTemplateId)
    if (!template) {
      template = coachTemplates.find(item => item.id === nextTemplateId)
    }
    
    if (!template) {
      return
    }

    setName(template.title)
    setGoal(String(template.goal ?? '').trim())
    setNasmOptPhase(String(template.nasm_opt_phase ?? 1))
    setPhaseName(String(template.phase_name ?? 'Custom Phase').trim())
    setSessionsPerWeek(String(template.sessions_per_week ?? 3))
    setEstimatedDurationMins(String(template.estimated_duration_mins ?? 60))
    const workouts = template.template_json?.workouts
    setDays(
      Array.isArray(workouts) && workouts.length > 0
        ? workouts.map((day, index) => toBuilderDay(day as BuilderWorkoutDay, index + 1))
        : [toBuilderDay(undefined, 1)]
    )
  }

  function startRestTimer(restValue: string) {
    const seconds = Math.max(15, firstPositiveInt(restValue, 60))
    setRestTimerTotal(seconds)
    setRestTimerRemaining(seconds)
    setRestTimerRunning(true)
  }

  function toggleRestTimer() {
    if (restTimerRemaining <= 0) {
      setRestTimerRemaining(restTimerTotal)
      setRestTimerRunning(true)
      return
    }
    setRestTimerRunning(current => !current)
  }

  function resetRestTimer() {
    setRestTimerRunning(false)
    setRestTimerRemaining(restTimerTotal)
  }

  function resetFromPlan(plan: LatestWorkoutPlan | CoachProgramDraft | null) {
    const nextState = toEditorState(plan)
    setTemplateId(nextState.templateId)
    setName(nextState.name)
    setGoal(nextState.goal)
    setNasmOptPhase(nextState.nasmOptPhase)
    setPhaseName(nextState.phaseName)
    setSessionsPerWeek(nextState.sessionsPerWeek)
    setEstimatedDurationMins(nextState.estimatedDurationMins)
    setStartDate(nextState.startDate)
    setDays(nextState.days)
  }

  function updateDay(dayId: string, field: 'focus' | 'scheduledDate' | 'notes', value: string) {
    setDays(current => current.map(day => (day.id === dayId ? { ...day, [field]: value } : day)))
  }

  function applyDaySnippet(dayId: string, snippet: string) {
    setDays(current => current.map(day => (
      day.id === dayId
        ? { ...day, notes: appendSnippet(day.notes ?? '', snippet) }
        : day
    )))
  }

  function saveDaySnippet(dayId: string) {
    const note = days.find(day => day.id === dayId)?.notes ?? ''
    const normalized = String(note).trim()
    if (normalized.length < 10) {
      setStatus('Day note too short to save as snippet.')
      return
    }

    setCustomDaySnippets(current => {
      const withoutDuplicate = current.filter(item => item.toLowerCase() !== normalized.toLowerCase())
      return [normalized, ...withoutDuplicate].slice(0, 12)
    })
    setStatus('Day note snippet saved.')
  }

  function updateExercise(dayId: string, exerciseId: string, field: keyof BuilderExercise, value: string | boolean) {
    setDays(current =>
      current.map(day => {
        if (day.id !== dayId) return day

        return {
          ...day,
          exercises: day.exercises.map(exercise => {
            if (exercise.id !== exerciseId) return exercise

            const nextExercise = {
              ...exercise,
              [field]: value,
            }

            if (field !== 'name') return nextExercise

            const match = exerciseMap.get(String(value).trim().toLowerCase())
            return hydrateExerciseFromRecord(nextExercise, match ?? null)
          }),
        }
      })
    )
  }

  function applyExerciseSnippet(dayId: string, exerciseId: string, snippet: string) {
    setDays(current =>
      current.map(day => {
        if (day.id !== dayId) return day

        return {
          ...day,
          exercises: day.exercises.map(exercise => (
            exercise.id === exerciseId
              ? { ...exercise, notes: appendSnippet(exercise.notes, snippet) }
              : exercise
          )),
        }
      })
    )
  }

  function saveExerciseSnippet(dayId: string, exerciseId: string) {
    const note = days
      .find(day => day.id === dayId)
      ?.exercises.find(exercise => exercise.id === exerciseId)
      ?.notes ?? ''

    const normalized = String(note).trim()
    if (normalized.length < 10) {
      setStatus('Exercise note too short to save as snippet.')
      return
    }

    setCustomExerciseSnippets(current => {
      const withoutDuplicate = current.filter(item => item.toLowerCase() !== normalized.toLowerCase())
      return [normalized, ...withoutDuplicate].slice(0, 16)
    })
    setStatus('Exercise note snippet saved.')
  }

  function openPicker(dayId: string, exerciseId: string) {
    const day = days.find(item => item.id === dayId)
    const suggestedCategory = suggestCategoryFromDayFocus(String(day?.focus ?? ''))

    setPickerTarget({ dayId, exerciseId })
    setPickerQuery('')
    setPickerCategory(suggestedCategory)
    setPickerEquipment('All Equipment')
  }

  function closePicker() {
    setPickerTarget(null)
  }

  function selectExerciseFromPicker(record: ExerciseLibraryRecord) {
    if (!pickerTarget) return

    let nextTarget: PickerTarget | null = null
    const currentTarget = pickerTarget

    setDays(current =>
      current.map(day => {
        if (day.id !== currentTarget.dayId) return day

        const currentIndex = day.exercises.findIndex(exercise => exercise.id === currentTarget.exerciseId)

        return {
          ...day,
          exercises: (() => {
            const updated = day.exercises.map(exercise => {
              if (exercise.id !== currentTarget.exerciseId) return exercise

              const withName = {
                ...exercise,
                name: record.name,
              }

              return hydrateExerciseFromRecord(withName, record)
            })

            if (pickerMultiAdd) {
              if (currentIndex >= 0 && currentIndex < updated.length - 1) {
                nextTarget = { dayId: day.id, exerciseId: updated[currentIndex + 1].id }
              } else {
                const appended = createBlankExercise()
                nextTarget = { dayId: day.id, exerciseId: appended.id }
                return [...updated, appended]
              }
            }

            return updated
          })(),
        }
      })
    )

    setRecentExerciseIds(current => {
      const withoutCurrent = current.filter(id => id !== record.id)
      return [record.id, ...withoutCurrent].slice(0, 16)
    })

    if (pickerMultiAdd && nextTarget) {
      setPickerTarget(nextTarget)
      return
    }

    closePicker()
  }

  function toggleFavorite(recordId: string) {
    setFavoriteExerciseIds(current => (
      current.includes(recordId)
        ? current.filter(id => id !== recordId)
        : [recordId, ...current].slice(0, 32)
    ))
  }

  function addDay() {
    setDays(current => [...current, toBuilderDay(undefined, current.length + 1)])
  }

  function duplicateDay(dayId: string) {
    setDays(current => {
      const index = current.findIndex(day => day.id === dayId)
      if (index === -1) return current

      const copy = toBuilderDay({
        ...current[index],
        exercises: current[index].exercises.map(exercise => ({
          libraryExerciseId: exercise.libraryExerciseId,
          name: exercise.name,
          block: exercise.block,
          sets: exercise.sets,
          reps: exercise.reps,
          tempo: exercise.tempo,
          rest: exercise.rest,
          notes: exercise.notes,
          description: exercise.description,
          primaryEquipment: exercise.primaryEquipment,
          imageUrl: exercise.imageUrl,
          videoUrl: exercise.videoUrl,
        })),
      }, index + 2)

      const next = [...current.slice(0, index + 1), copy, ...current.slice(index + 1)]
      return next.map((day, dayIndex) => ({ ...day, day: dayIndex + 1 }))
    })
  }

  function moveDay(dayId: string, direction: 'up' | 'down') {
    setDays(current => {
      const index = current.findIndex(day => day.id === dayId)
      if (index === -1) return current

      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= current.length) return current

      const next = [...current]
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next.map((day, dayIndex) => ({ ...day, day: dayIndex + 1 }))
    })
  }

  function removeDay(dayId: string) {
    setDays(current => current.filter(day => day.id !== dayId).map((day, index) => ({ ...day, day: index + 1 })))
  }

  function addExercise(dayId: string) {
    setDays(current =>
      current.map(day => (day.id === dayId ? { ...day, exercises: [...day.exercises, createBlankExercise()] } : day))
    )
  }

  function duplicateExercise(dayId: string, exerciseId: string) {
    setDays(current =>
      current.map(day => {
        if (day.id !== dayId) return day

        const index = day.exercises.findIndex(exercise => exercise.id === exerciseId)
        if (index === -1) return day

        const source = day.exercises[index]
        const copy = toBuilderExercise({
          libraryExerciseId: source.libraryExerciseId,
          name: source.name,
          block: source.block,
          sets: source.sets,
          reps: source.reps,
          tempo: source.tempo,
          rest: source.rest,
          notes: source.notes,
          description: source.description,
          primaryEquipment: source.primaryEquipment,
          imageUrl: source.imageUrl,
          videoUrl: source.videoUrl,
        })

        return {
          ...day,
          exercises: [...day.exercises.slice(0, index + 1), copy, ...day.exercises.slice(index + 1)],
        }
      })
    )
  }

  function moveExercise(dayId: string, exerciseId: string, direction: 'up' | 'down') {
    setDays(current =>
      current.map(day => {
        if (day.id !== dayId) return day

        const index = day.exercises.findIndex(exercise => exercise.id === exerciseId)
        if (index === -1) return day

        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= day.exercises.length) return day

        const nextExercises = [...day.exercises]
        ;[nextExercises[index], nextExercises[targetIndex]] = [nextExercises[targetIndex], nextExercises[index]]

        return {
          ...day,
          exercises: nextExercises,
        }
      })
    )
  }

  function removeExercise(dayId: string, exerciseId: string) {
    setDays(current =>
      current.map(day => {
        if (day.id !== dayId) return day
        const remaining = day.exercises.filter(exercise => exercise.id !== exerciseId)
        return {
          ...day,
          exercises: remaining.length > 0 ? remaining : [createBlankExercise()],
        }
      })
    )
  }

  function copyExerciseToDay(fromDayId: string, exerciseId: string, toDayId: string) {
    setDays(current => {
      let sourceExercise: BuilderExercise | null = null

      // First pass: find the source exercise
      const withFoundSource = current.map(day => {
        if (day.id === fromDayId) {
          const found = day.exercises.find(exercise => exercise.id === exerciseId)
          if (found) sourceExercise = found
        }
        return day
      })

      if (!sourceExercise) return current

      // Second pass: copy to target day
      return withFoundSource.map(day => {
        if (day.id !== toDayId) return day

        const copy = toBuilderExercise({
          libraryExerciseId: sourceExercise!.libraryExerciseId,
          name: sourceExercise!.name,
          block: sourceExercise!.block,
          sets: sourceExercise!.sets,
          reps: sourceExercise!.reps,
          tempo: sourceExercise!.tempo,
          rest: sourceExercise!.rest,
          notes: sourceExercise!.notes,
          description: sourceExercise!.description,
          primaryEquipment: sourceExercise!.primaryEquipment,
          imageUrl: sourceExercise!.imageUrl,
          videoUrl: sourceExercise!.videoUrl,
        })

        return {
          ...day,
          exercises: [...day.exercises, copy],
        }
      })
    })
    setCopyExerciseModal(null)
  }

  async function saveAsTemplate() {
    if (!name || !phaseName) {
      setTemplateSaveStatus('Title and phase name are required.')
      return
    }

    setTemplateSaveBusy(true)
    setTemplateSaveStatus(null)

    try {
      const res = await fetch('/api/coach/program-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: name,
          goal: goal || null,
          nasmOptPhase: Number(nasmOptPhase),
          phaseName,
          sessionsPerWeek: Number(sessionsPerWeek),
          estimatedDurationMins: Number(estimatedDurationMins),
          workouts: days.map((day, index) => ({
            day: index + 1,
            focus: day.focus,
            scheduledDate: day.scheduledDate,
            notes: day.notes,
            exercises: day.exercises.map(exercise => ({
              libraryExerciseId: exercise.libraryExerciseId || null,
              name: exercise.name,
              block: exercise.block || null,
              sets: exercise.sets,
              reps: exercise.reps,
              tempo: exercise.tempo,
              rest: exercise.rest,
              notes: exercise.notes,
            })),
          })),
        }),
      })

      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        setTemplateSaveStatus(payload.error ?? 'Failed to save template.')
        return
      }

      setTemplateSaveStatus('Template saved successfully! You can use this as a starting point for future clients.')
      setTimeout(() => {
        setSaveTemplateModal(false)
        setTemplateSaveStatus(null)
      }, 2000)
    } catch (error) {
      console.error('Error saving template:', error)
      setTemplateSaveStatus('Failed to save template. Check your connection and try again.')
    } finally {
      setTemplateSaveBusy(false)
    }
  }

  async function handleSubmit() {
    if (validationMessages.length > 0) {
      setStatus('Complete required fields before saving.')
      return
    }

    setBusy(true)
    setStatus(null)

    try {
      const res = await fetch('/api/coach/workout-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          templateId,
          name,
          goal,
          nasmOptPhase: Number(nasmOptPhase),
          phaseName,
          sessionsPerWeek: Number(sessionsPerWeek),
          estimatedDurationMins: Number(estimatedDurationMins),
          startDate,
          workouts: days.map((day, index) => ({
            day: index + 1,
            focus: day.focus,
            scheduledDate: day.scheduledDate,
            notes: day.notes,
            exercises: day.exercises.map(exercise => ({
              libraryExerciseId: exercise.libraryExerciseId || null,
              name: exercise.name,
              block: exercise.block || null,
              sets: exercise.sets,
              reps: exercise.reps,
              tempo: exercise.tempo,
              rest: exercise.rest,
              notes: exercise.notes,
            })),
          })),
        }),
      })

      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        setStatus(payload.error ?? 'Failed to save custom workout plan.')
        return
      }

      setStatus(draftPlan ? 'Draft accepted and saved for this client.' : 'Custom program saved for this client.')
      onPlanSaved?.()
      router.refresh()
    } catch {
      setStatus('Failed to save custom workout plan. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="coach-program-builder-section"
      style={{
        background: 'linear-gradient(180deg, rgba(18,35,54,0.98), rgba(13,27,42,0.96))',
        border: '1px solid rgba(212,160,23,0.22)',
        padding: 24,
        marginBottom: 40,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'Bebas Neue, sans-serif', fontSize: 28, letterSpacing: '0.08em', color: 'var(--white)' }}>
            Custom Program Builder
          </h2>
          <p style={{ margin: '8px 0 0', maxWidth: 700, color: 'var(--gray)', fontSize: 14 }}>
            Build individualized training blocks and calendar dates here. Imported template and exercise library content only appears after you load licensed data into the catalog tables.
          </p>
        </div>
        <div className="coach-program-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(110px, 1fr))', gap: 10, width: '100%', maxWidth: 420 }}>
          <Metric label="Templates" value={String(templates.length)} />
          <Metric label="Exercises" value={String(exercises.length)} />
          <Metric label="Equipment" value={String(equipment.length)} />
        </div>
      </div>

      {readinessSummary && (
        <div style={readinessPanelStyle}>
          <p style={{ margin: 0, color: readinessSummary.readiness === 'high' ? '#9AE6B4' : readinessSummary.readiness === 'low' ? '#FEB2B2' : '#FBD38D', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
            Client Readiness: {readinessSummary.readiness}
          </p>
          <p style={{ margin: '6px 0 0', color: 'var(--white)', fontSize: 13 }}>
            14d completion {readinessSummary.completionRate14d}% · Avg RPE {readinessSummary.avgRpe14d ?? 'N/A'} · Completed last 7d {readinessSummary.completedSessions7d}
          </p>
          <p style={{ margin: '6px 0 0', color: 'var(--gray)', fontSize: 12 }}>
            {readinessSummary.daysSinceLastCompleted === null
              ? 'No completed sessions logged yet.'
              : `${readinessSummary.daysSinceLastCompleted} day(s) since last completed workout.`}
          </p>
          <p style={{ margin: '8px 0 0', color: 'var(--gold-lt)', fontSize: 12 }}>
            {readinessSummary.recommendation}
          </p>
        </div>
      )}

      {draftPlan && (
        <div style={{ marginBottom: 18, padding: '14px 16px', border: '1px solid rgba(212,160,23,0.35)', background: 'rgba(212,160,23,0.08)' }}>
          <p style={{ margin: 0, color: 'var(--gold-lt)', fontFamily: 'Raleway, sans-serif', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Quick Generate Draft Ready For Review
          </p>
          <p style={{ margin: '8px 0 0', color: 'var(--white)', fontSize: 14, lineHeight: 1.5 }}>
            {draftPlan.templateTitle ? `${draftPlan.templateTitle} generated this plan. ` : ''}Review or adjust any day, exercise, load, or schedule here. Saving is the acceptance step.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
        <label style={labelStyle}>
          Template
          <select value={templateId} onChange={event => applyTemplate(event.target.value)} style={inputStyle}>
            <option value="">Start from scratch</option>
            {coachTemplates.length > 0 && (
              <optgroup label="Your Saved Templates">
                {coachTemplates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </optgroup>
            )}
            {templates.length > 0 && (
              <optgroup label="Library Templates">
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label style={labelStyle}>
          Program Name
          <input value={name} onChange={event => setName(event.target.value)} style={inputStyle} placeholder="Spring Strength Block" />
        </label>
        <label style={labelStyle}>
          Goal
          <input value={goal} onChange={event => setGoal(event.target.value)} style={inputStyle} placeholder="fat-loss" />
        </label>
        <label style={labelStyle}>
          NASM Phase
          <input value={nasmOptPhase} onChange={event => setNasmOptPhase(event.target.value)} type="number" min={1} max={5} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Phase Name
          <input value={phaseName} onChange={event => setPhaseName(event.target.value)} style={inputStyle} placeholder="Strength Endurance" />
        </label>
        <label style={labelStyle}>
          Sessions / Week
          <input value={sessionsPerWeek} onChange={event => setSessionsPerWeek(event.target.value)} type="number" min={1} max={7} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Duration (mins)
          <input value={estimatedDurationMins} onChange={event => setEstimatedDurationMins(event.target.value)} type="number" min={15} max={240} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Calendar Start
          <input value={startDate} onChange={event => setStartDate(event.target.value)} type="date" style={inputStyle} />
        </label>
      </div>

      <datalist id={exerciseListId}>
        {exercises.map(exercise => (
          <option key={exercise.id} value={exercise.name} />
        ))}
      </datalist>

      <div style={restTimerPanelStyle}>
        <p style={{ margin: 0, color: 'var(--gold-lt)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
          Rest Timer
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 32, color: 'var(--white)', minWidth: 88 }}>
            {formatClock(restTimerRemaining)}
          </span>
          <button type="button" onClick={toggleRestTimer} style={miniActionButtonStyle}>
            {restTimerRunning ? 'Pause' : 'Start'}
          </button>
          <button type="button" onClick={resetRestTimer} style={miniActionButtonStyle}>
            Reset
          </button>
          <span style={{ color: 'var(--gray)', fontSize: 12 }}>
            Default target: {restTimerTotal}s
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {days.map((day, dayIndex) => (
          <div key={day.id} style={{ border: '1px solid var(--navy-lt)', background: 'rgba(13,27,42,0.7)', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div className="coach-program-day-header-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 2fr) minmax(160px, 1fr)', gap: 10, flex: 1 }}>
                <label style={labelStyle}>
                  Day {dayIndex + 1} Focus
                  <input value={day.focus} onChange={event => updateDay(day.id, 'focus', event.target.value)} style={inputStyle} placeholder="Upper Body Strength" />
                </label>
                <label style={labelStyle}>
                  Scheduled Date
                  <input value={day.scheduledDate} onChange={event => updateDay(day.id, 'scheduledDate', event.target.value)} type="date" style={inputStyle} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => moveDay(day.id, 'up')} style={miniActionButtonStyle} disabled={dayIndex === 0}>
                  ↑ Day
                </button>
                <button type="button" onClick={() => moveDay(day.id, 'down')} style={miniActionButtonStyle} disabled={dayIndex === days.length - 1}>
                  ↓ Day
                </button>
                <button type="button" onClick={() => duplicateDay(day.id)} style={miniActionButtonStyle}>
                  Duplicate Day
                </button>
                <button type="button" onClick={() => removeDay(day.id)} style={secondaryButtonStyle}>
                  Remove Day
                </button>
              </div>
            </div>

            <label style={{ ...labelStyle, marginBottom: 12 }}>
              Coach Notes
              <textarea value={day.notes} onChange={event => updateDay(day.id, 'notes', event.target.value)} style={{ ...inputStyle, minHeight: 72 }} placeholder="Session emphasis, regressions, intent" />
            </label>

            <div style={snippetRowStyle}>
              {dayNoteSnippets.slice(0, 4).map(snippet => (
                <button key={`${day.id}-${snippet}`} type="button" onClick={() => applyDaySnippet(day.id, snippet)} style={snippetButtonStyle}>
                  + {snippet.slice(0, 38)}{snippet.length > 38 ? '...' : ''}
                </button>
              ))}
              <button type="button" onClick={() => saveDaySnippet(day.id)} style={snippetSaveButtonStyle}>
                Save Note Snippet
              </button>
            </div>

            {(() => {
              const density = dayDensity.find(item => item.dayId === day.id)
              if (!density) return null

              return (
                <div style={densityPanelStyle}>
                  <p style={{ margin: 0, color: 'var(--gold-lt)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                    Session Density Preview
                  </p>
                  <p style={{ margin: '6px 0 0', color: 'var(--white)', fontSize: 13 }}>
                    {density.totalSets} sets · {density.totalReps} estimated reps · {density.totalMins} min total
                  </p>
                  <p style={{ margin: '6px 0 0', color: 'var(--gray)', fontSize: 12 }}>
                    Work: {density.workMins} min | Rest: {density.restMins} min | Density: {density.density}%
                  </p>
                </div>
              )
            })()}

            <div style={{ display: 'grid', gap: 12 }}>
              {day.exercises.map(exercise => (
                <div key={exercise.id} style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(18,35,54,0.9)', padding: 14 }}>
                  {(() => {
                    const warnings = getExerciseWarnings(exercise)
                    if (warnings.length === 0) return null

                    return (
                      <div style={warningPanelStyle}>
                        <p style={{ margin: 0, color: '#FFD9A6', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                          Contraindication Check
                        </p>
                        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                          {warnings.map(warning => (
                            <p key={`${exercise.id}-${warning}`} style={{ margin: 0, color: '#FFE7C2', fontSize: 13, lineHeight: 1.45 }}>
                              {warning}
                            </p>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  <div className="coach-program-exercise-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) minmax(90px, 0.9fr) repeat(4, minmax(90px, 1fr)) auto', gap: 10, alignItems: 'end' }}>
                    <label style={labelStyle}>
                      Exercise
                      <input
                        value={exercise.name}
                        onChange={event => updateExercise(day.id, exercise.id, 'name', event.target.value)}
                        list={exerciseListId}
                        style={inputStyle}
                        placeholder={exercises.length > 0 ? 'Search the imported library' : 'Enter exercise name'}
                      />
                      <button type="button" onClick={() => openPicker(day.id, exercise.id)} style={pickerButtonStyle}>
                        Browse Categories
                      </button>
                    </label>
                    <label style={labelStyle}>
                      Block
                      <input value={exercise.block} onChange={event => updateExercise(day.id, exercise.id, 'block', event.target.value)} style={inputStyle} placeholder="A1" />
                    </label>
                    <label style={labelStyle}>
                      Sets
                      <input value={exercise.sets} onChange={event => updateExercise(day.id, exercise.id, 'sets', event.target.value)} style={inputStyle} placeholder="3" />
                    </label>
                    <label style={labelStyle}>
                      Reps
                      <input value={exercise.reps} onChange={event => updateExercise(day.id, exercise.id, 'reps', event.target.value)} style={inputStyle} placeholder="10" />
                    </label>
                    <label style={labelStyle}>
                      Tempo
                      <input value={exercise.tempo} onChange={event => updateExercise(day.id, exercise.id, 'tempo', event.target.value)} style={inputStyle} placeholder="2/0/2" />
                    </label>
                    <label style={labelStyle}>
                      Rest
                      <input value={exercise.rest} onChange={event => updateExercise(day.id, exercise.id, 'rest', event.target.value)} style={inputStyle} placeholder="60s" />
                    </label>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <button type="button" onClick={() => moveExercise(day.id, exercise.id, 'up')} style={miniActionButtonStyle} disabled={day.exercises[0]?.id === exercise.id}>
                        ↑
                      </button>
                      <button type="button" onClick={() => moveExercise(day.id, exercise.id, 'down')} style={miniActionButtonStyle} disabled={day.exercises[day.exercises.length - 1]?.id === exercise.id}>
                        ↓
                      </button>
                      <button type="button" onClick={() => duplicateExercise(day.id, exercise.id)} style={miniActionButtonStyle}>
                        Duplicate
                      </button>
                      <button type="button" onClick={() => setCopyExerciseModal({ dayId: day.id, exerciseId: exercise.id })} style={miniActionButtonStyle}>
                        Copy To...
                      </button>
                      <button type="button" onClick={() => startRestTimer(exercise.rest)} style={miniActionButtonStyle}>
                        Start Rest
                      </button>
                      <button type="button" onClick={() => removeExercise(day.id, exercise.id)} style={secondaryButtonStyle}>
                        Remove
                      </button>
                    </div>
                  </div>

                  <label style={{ ...labelStyle, marginTop: 10 }}>
                    Exercise Notes
                    <input value={exercise.notes} onChange={event => updateExercise(day.id, exercise.id, 'notes', event.target.value)} style={inputStyle} placeholder="Coaching cue, modification, target RPE" />
                  </label>

                  <div style={snippetRowStyle}>
                    {exerciseNoteSnippets.slice(0, 4).map(snippet => (
                      <button key={`${exercise.id}-${snippet}`} type="button" onClick={() => applyExerciseSnippet(day.id, exercise.id, snippet)} style={snippetButtonStyle}>
                        + {snippet.slice(0, 36)}{snippet.length > 36 ? '...' : ''}
                      </button>
                    ))}
                    <button type="button" onClick={() => saveExerciseSnippet(day.id, exercise.id)} style={snippetSaveButtonStyle}>
                      Save Exercise Snippet
                    </button>
                  </div>

                  {(() => {
                    const suggestion = buildProgressionSuggestion(exercise, currentPhaseNumber)

                    return (
                      <div style={progressionPanelStyle}>
                        <p style={{ margin: 0, color: 'var(--gold-lt)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
                          Suggested Progression (Phase {currentPhaseNumber})
                        </p>
                        <p style={{ margin: '6px 0 0', color: 'var(--white)', fontSize: 13 }}>
                          {suggestion.sets} sets · {suggestion.reps} reps · Tempo {suggestion.tempo} · Rest {suggestion.rest}
                        </p>
                        <p style={{ margin: '6px 0 0', color: 'var(--gray)', fontSize: 12 }}>
                          {suggestion.rationale}
                        </p>
                        <button
                          type="button"
                          onClick={() => applyProgressionSuggestion(day.id, exercise.id, suggestion)}
                          style={{ ...miniActionButtonStyle, marginTop: 8, width: 'fit-content' }}
                        >
                          Apply Progression
                        </button>
                      </div>
                    )
                  })()}

                  {(exercise.description || exercise.imageUrl || exercise.videoUrl || equipmentBadges(exercise.primaryEquipment).length > 0) && (
                    <div className="coach-program-exercise-detail" style={{ display: 'grid', gridTemplateColumns: exercise.imageUrl ? '88px 1fr' : '1fr', gap: 12, marginTop: 12, padding: 12, background: 'rgba(13,27,42,0.68)' }}>
                      {exercise.imageUrl && (
                        <div
                          aria-hidden="true"
                          style={{
                            width: 88,
                            minHeight: 88,
                            border: '1px solid rgba(212,160,23,0.18)',
                            backgroundImage: `url(${exercise.imageUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        />
                      )}
                      <div>
                        {exercise.block && (
                          <div style={{ marginBottom: 8 }}>
                            <span style={chipStyle}>{exercise.block}</span>
                          </div>
                        )}
                        {exercise.description && (() => {
                          const lines = formatExerciseDescriptionLines(exercise.description)
                          if (lines.length === 0) return null

                          if (lines.length === 1) {
                            return <p style={{ margin: 0, color: 'var(--white)', fontSize: 13, lineHeight: 1.5 }}>{lines[0]}</p>
                          }

                          return (
                            <div style={{ display: 'grid', gap: 6 }}>
                              {lines.map((line, index) => (
                                <p key={`${exercise.id}-desc-${index}`} style={{ margin: 0, color: 'var(--white)', fontSize: 13, lineHeight: 1.5 }}>
                                  {line}
                                </p>
                              ))}
                            </div>
                          )
                        })()}
                        {(() => {
                          const equipmentItems = Array.isArray(exercise.primaryEquipment)
                            ? exercise.primaryEquipment.map(item => String(item ?? '').trim()).filter(Boolean)
                            : []
                          const badgeItems = equipmentItems.length > 0 ? equipmentItems : ['Bodyweight']

                          return (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                              {badgeItems.map(item => (
                                <span key={item} style={chipStyle}>{item}</span>
                              ))}
                            </div>
                          )
                        })()}
                        {exercise.videoUrl && (
                          <a href={exercise.videoUrl} target="_blank" rel="noreferrer" style={videoLinkStyle}>
                            Open exercise video
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={() => addExercise(day.id)} style={secondaryButtonStyle}>
                Add Exercise
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={addDay} style={secondaryButtonStyle}>
            Add Training Day
          </button>
          {latestPlan && (
            <button
              type="button"
              onClick={() => resetFromPlan(latestPlan)}
              style={secondaryButtonStyle}
            >
              Use Latest Accepted Plan
            </button>
          )}
          <button
            type="button"
            onClick={() => resetFromPlan(draftPlan ?? latestPlan)}
            style={secondaryButtonStyle}
          >
            {draftPlan ? 'Reset To Draft' : 'Reset To Latest Plan'}
          </button>
          <button type="button" onClick={() => setSaveTemplateModal(true)} style={secondaryButtonStyle}>
            Save as Template
          </button>
        </div>
        <button type="button" disabled={busy || validationMessages.length > 0} onClick={handleSubmit} style={primaryButtonStyle}>
          {busy ? 'Saving...' : draftPlan ? 'Accept And Save Plan' : 'Save Custom Program'}
        </button>
      </div>

      <div className="coach-program-mobile-action-bar" style={mobileActionBarStyle}>
        <button type="button" onClick={addDay} style={mobileActionSecondaryButtonStyle}>
          Add Day
        </button>
        <button type="button" onClick={() => setSaveTemplateModal(true)} style={mobileActionSecondaryButtonStyle}>
          Save Template
        </button>
        <button type="button" disabled={busy || validationMessages.length > 0} onClick={handleSubmit} style={mobileActionPrimaryButtonStyle}>
          {busy ? 'Saving...' : draftPlan ? 'Accept Plan' : 'Save Program'}
        </button>
      </div>

      {validationMessages.length > 0 && (
        <div style={{ marginTop: 12, padding: '10px 12px', border: '1px solid rgba(255,61,87,0.45)', background: 'rgba(255,61,87,0.08)' }}>
          <p style={{ margin: 0, color: 'var(--error)', fontSize: 13, fontWeight: 600 }}>Required before save:</p>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--gray)', fontSize: 13 }}>
            {validationMessages.map(message => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {status && (
        <p style={{ margin: '14px 0 0', color: status.toLowerCase().includes('failed') || status.toLowerCase().includes('invalid') ? 'var(--error)' : 'var(--success)' }}>
          {status}
        </p>
      )}

      {equipment.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <p style={{ margin: '0 0 8px', color: 'var(--gray)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Imported Equipment Library
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {equipment.slice(0, 16).map(item => (
              <span key={item.id} style={chipStyle}>{item.name}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <WorkoutCalendarView
          entries={calendarEntries}
          title="Program Calendar Preview"
          subtitle="Adjust day dates above, or use Calendar Start + Sessions/Week for generated spacing."
        />
      </div>

      {pickerTarget && (
        <div style={pickerOverlayStyle}>
          <div style={pickerPanelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: 'var(--white)', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.08em', fontSize: 24 }}>
                Choose Exercise
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setPickerMultiAdd(current => !current)}
                  style={{ ...secondaryButtonStyle, border: pickerMultiAdd ? '1px solid rgba(212,160,23,0.45)' : '1px solid var(--navy-lt)', color: pickerMultiAdd ? 'var(--gold-lt)' : 'var(--white)' }}
                >
                  Multi-Add: {pickerMultiAdd ? 'On' : 'Off'}
                </button>
                <button type="button" onClick={closePicker} style={secondaryButtonStyle}>Close</button>
              </div>
            </div>

            {favoriteExercises.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ margin: '0 0 6px', color: 'var(--gray)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Favorites</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {favoriteExercises.slice(0, 8).map(record => (
                    <button key={`favorite-${record.id}`} type="button" onClick={() => selectExerciseFromPicker(record)} style={pickerQuickButtonStyle}>
                      {record.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {recentExercises.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ margin: '0 0 6px', color: 'var(--gray)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Recent</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {recentExercises.slice(0, 8).map(record => (
                    <button key={`recent-${record.id}`} type="button" onClick={() => selectExerciseFromPicker(record)} style={pickerQuickButtonStyle}>
                      {record.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 12 }}>
              <label style={labelStyle}>
                Search
                <input
                  value={pickerQuery}
                  onChange={event => setPickerQuery(event.target.value)}
                  style={inputStyle}
                  placeholder="Exercise or equipment"
                />
              </label>
              <label style={labelStyle}>
                Category
                <select value={pickerCategory} onChange={event => setPickerCategory(event.target.value)} style={inputStyle}>
                  {categoryOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                Equipment
                <select value={pickerEquipment} onChange={event => setPickerEquipment(event.target.value)} style={inputStyle}>
                  {equipmentOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            <p style={{ margin: '0 0 10px', color: 'var(--gray)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Showing up to 80 results for fast mobile browsing
            </p>

            <div style={{ display: 'grid', gap: 8, maxHeight: '55vh', overflowY: 'auto', paddingRight: 4 }}>
              {filteredPickerExercises.length === 0 && (
                <p style={{ margin: 0, color: 'var(--gray)', fontSize: 14 }}>No matching exercises. Try clearing one of the filters.</p>
              )}

              {filteredPickerExercises.map(item => (
                <div key={item.record.id} style={pickerListButtonStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => selectExerciseFromPicker(item.record)}
                      style={pickerSelectButtonStyle}
                    >
                      {item.record.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(item.record.id)}
                      style={{ ...pickerFavoriteButtonStyle, color: favoriteExerciseIds.includes(item.record.id) ? 'var(--gold)' : 'var(--gray)' }}
                      aria-label={favoriteExerciseIds.includes(item.record.id) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      ★
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <span style={chipStyle}>{item.category}</span>
                    {equipmentBadges(item.record.primary_equipment).slice(0, 2).map(equipmentItem => (
                      <span key={`${item.record.id}-${equipmentItem}`} style={chipStyle}>{equipmentItem}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Copy Exercise Modal */}
      {copyExerciseModal && (
        <div style={pickerOverlayStyle}>
          <div style={pickerPanelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--white)' }}>Copy Exercise To...</h3>
              <button type="button" onClick={() => setCopyExerciseModal(null)} style={{ ...secondaryButtonStyle, padding: '6px 12px' }}>
                Close
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {days.map((day, dayIndex) => (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => copyExerciseModal && copyExerciseToDay(copyExerciseModal.dayId, copyExerciseModal.exerciseId, day.id)}
                  style={{
                    ...secondaryButtonStyle,
                    textAlign: 'left',
                    order: day.id === copyExerciseModal.dayId ? -1 : dayIndex,
                  }}
                  disabled={day.id === copyExerciseModal.dayId}
                >
                  {day.id === copyExerciseModal.dayId ? `Day ${day.day} (Source)` : `Day ${day.day} – ${day.focus || 'Untitled'}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Save as Template Modal */}
      {saveTemplateModal && (
        <div style={pickerOverlayStyle}>
          <div style={pickerPanelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--white)' }}>Save as Template</h3>
              <button
                type="button"
                onClick={() => {
                  setSaveTemplateModal(false)
                  setTemplateSaveStatus(null)
                }}
                style={{ ...secondaryButtonStyle, padding: '6px 12px' }}
              >
                Close
              </button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <p style={{ margin: 0, color: 'var(--gray)', fontSize: 13 }}>
                This program will be saved as a personal template. You can reuse it when building plans for other clients in the future.
              </p>
              <div style={{ display: 'grid', gap: 8 }}>
                <button
                  type="button"
                  disabled={templateSaveBusy || !name || !phaseName}
                  onClick={saveAsTemplate}
                  style={{
                    ...primaryButtonStyle,
                    opacity: templateSaveBusy ? 0.6 : 1,
                  }}
                >
                  {templateSaveBusy ? 'Saving...' : 'Save Template'}
                </button>
                {templateSaveStatus && (
                  <p
                    style={{
                      margin: 0,
                      padding: '10px 12px',
                      border: templateSaveStatus.toLowerCase().includes('success') ? '1px solid rgba(76,175,80,0.45)' : '1px solid rgba(255,61,87,0.45)',
                      background: templateSaveStatus.toLowerCase().includes('success') ? 'rgba(76,175,80,0.08)' : 'rgba(255,61,87,0.08)',
                      color: templateSaveStatus.toLowerCase().includes('success') ? 'var(--success)' : 'var(--error)',
                      fontSize: 13,
                      borderRadius: 4,
                    }}
                  >
                    {templateSaveStatus}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(13,27,42,0.72)', padding: 12 }}>
      <p style={{ margin: 0, color: 'var(--gray)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</p>
      <div style={{ marginTop: 6, color: 'var(--white)', fontFamily: 'Bebas Neue, sans-serif', fontSize: 28 }}>{value}</div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  color: 'var(--gray)',
  fontSize: 12,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--navy-lt)',
  background: 'var(--navy-mid)',
  color: 'var(--white)',
  fontFamily: 'Raleway, sans-serif',
  fontSize: 16,
  minHeight: 44,
}

const primaryButtonStyle: React.CSSProperties = {
  border: 0,
  background: 'var(--gold)',
  color: '#0D1B2A',
  padding: '10px 14px',
  fontFamily: 'Bebas Neue, sans-serif',
  letterSpacing: '0.08em',
  fontSize: 18,
  cursor: 'pointer',
  minHeight: 44,
}

const secondaryButtonStyle: React.CSSProperties = {
  border: '1px solid var(--navy-lt)',
  background: 'transparent',
  color: 'var(--white)',
  padding: '10px 12px',
  fontFamily: 'Raleway, sans-serif',
  fontSize: 13,
  cursor: 'pointer',
  minHeight: 42,
}

const pickerButtonStyle: React.CSSProperties = {
  marginTop: 8,
  border: '1px solid rgba(212,160,23,0.35)',
  background: 'rgba(212,160,23,0.1)',
  color: 'var(--gold-lt)',
  padding: '8px 10px',
  fontFamily: 'Raleway, sans-serif',
  fontSize: 12,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  minHeight: 42,
}

const miniActionButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(13,27,42,0.88)',
  color: 'var(--white)',
  padding: '6px 8px',
  fontFamily: 'Raleway, sans-serif',
  fontSize: 12,
  cursor: 'pointer',
  minHeight: 34,
}

const chipStyle: React.CSSProperties = {
  border: '1px solid rgba(212,160,23,0.22)',
  background: 'rgba(212,160,23,0.12)',
  color: 'var(--gold)',
  padding: '4px 8px',
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const warningPanelStyle: React.CSSProperties = {
  border: '1px solid rgba(255, 167, 38, 0.45)',
  background: 'rgba(255, 167, 38, 0.12)',
  padding: '10px 12px',
  marginBottom: 10,
}

const progressionPanelStyle: React.CSSProperties = {
  border: '1px solid rgba(212,160,23,0.35)',
  background: 'rgba(212,160,23,0.08)',
  padding: '10px 12px',
  marginTop: 10,
}

const restTimerPanelStyle: React.CSSProperties = {
  border: '1px solid rgba(212,160,23,0.28)',
  background: 'rgba(212,160,23,0.07)',
  padding: '12px 14px',
  marginBottom: 14,
}

const densityPanelStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(11,24,39,0.72)',
  padding: '10px 12px',
  marginBottom: 12,
}

const readinessPanelStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.16)',
  background: 'rgba(11,24,39,0.78)',
  padding: '12px 14px',
  marginBottom: 16,
}

const snippetRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 8,
}

const snippetButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.16)',
  background: 'rgba(13,27,42,0.82)',
  color: 'var(--gray)',
  padding: '6px 8px',
  fontFamily: 'Raleway, sans-serif',
  fontSize: 11,
  cursor: 'pointer',
  minHeight: 34,
}

const snippetSaveButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(212,160,23,0.35)',
  background: 'rgba(212,160,23,0.1)',
  color: 'var(--gold-lt)',
  padding: '6px 10px',
  fontFamily: 'Raleway, sans-serif',
  fontSize: 11,
  cursor: 'pointer',
  minHeight: 34,
}

const mobileActionBarStyle: React.CSSProperties = {
  display: 'none',
  position: 'fixed',
  left: 12,
  right: 12,
  bottom: 'max(10px, env(safe-area-inset-bottom))',
  zIndex: 60,
  gap: 8,
  padding: '10px',
  border: '1px solid rgba(212,160,23,0.28)',
  background: 'linear-gradient(180deg, rgba(18,35,54,0.98), rgba(13,27,42,0.98))',
  boxShadow: '0 10px 24px rgba(5,10,17,0.35)',
}

const mobileActionSecondaryButtonStyle: React.CSSProperties = {
  flex: 1,
  border: '1px solid var(--navy-lt)',
  background: 'rgba(13,27,42,0.86)',
  color: 'var(--white)',
  padding: '10px 8px',
  fontFamily: 'Raleway, sans-serif',
  fontSize: 12,
  letterSpacing: '0.03em',
  cursor: 'pointer',
  minHeight: 42,
}

const mobileActionPrimaryButtonStyle: React.CSSProperties = {
  flex: 1.35,
  border: 0,
  background: 'var(--gold)',
  color: '#0D1B2A',
  padding: '10px 8px',
  fontFamily: 'Bebas Neue, sans-serif',
  fontSize: 16,
  letterSpacing: '0.07em',
  cursor: 'pointer',
  minHeight: 42,
}

const videoLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  marginTop: 10,
  color: 'var(--gold-lt)',
  textDecoration: 'none',
  fontSize: 13,
}

const pickerOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(5, 10, 17, 0.72)',
  zIndex: 90,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-end',
  padding: 10,
}

const pickerPanelStyle: React.CSSProperties = {
  width: 'min(980px, 100%)',
  maxHeight: '85vh',
  background: 'linear-gradient(180deg, rgba(18,35,54,0.98), rgba(13,27,42,0.98))',
  border: '1px solid rgba(212,160,23,0.3)',
  padding: 14,
  overflow: 'hidden',
}

const pickerListButtonStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(11, 24, 39, 0.9)',
  padding: '10px 12px',
  textAlign: 'left',
}

const pickerSelectButtonStyle: React.CSSProperties = {
  border: 0,
  background: 'transparent',
  color: 'var(--white)',
  fontSize: 15,
  fontWeight: 700,
  textAlign: 'left',
  padding: 0,
  cursor: 'pointer',
  minHeight: 44,
}

const pickerFavoriteButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(13,27,42,0.8)',
  fontSize: 16,
  lineHeight: 1,
  width: 36,
  height: 36,
  cursor: 'pointer',
}

const pickerQuickButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(212,160,23,0.25)',
  background: 'rgba(212,160,23,0.08)',
  color: 'var(--gold-lt)',
  padding: '8px 10px',
  fontFamily: 'Raleway, sans-serif',
  fontSize: 12,
  cursor: 'pointer',
  minHeight: 42,
}