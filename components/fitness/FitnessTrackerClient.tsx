'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import WorkoutCalendarView from '@/components/fitness/WorkoutCalendarView'
import RestTimer from '@/components/fitness/RestTimer'
import WeeklyCheckinForm from '@/components/fitness/WeeklyCheckinForm'
import CardioLogForm from '@/components/fitness/CardioLogForm'
import ProgressPhotoTimeline from '@/components/fitness/ProgressPhotoTimeline'

interface FitnessProfile {
  preferred_units?: 'metric' | 'imperial'
  sex?: 'male' | 'female' | 'other'
  height_cm?: number
  weight_kg?: number
  waist_cm?: number
  neck_cm?: number
  hip_cm?: number
  training_days_per_week?: number
  fitness_goal?: string
  target_bodyfat_percent?: number
  before_photo_url?: string
}

interface WorkoutExercise {
  name: string
  sets: string
  reps: string
  tempo?: string | null
  rest?: string | null
  notes?: string | null
  description?: string | null
  primaryEquipment?: string[] | null
  imageUrl?: string | null
  videoUrl?: string | null
  block?: string | null
}

interface WorkoutDay {
  day: number
  focus: string
  scheduledDate?: string | null
  notes?: string | null
  exercises: WorkoutExercise[]
}

interface WorkoutPlanRecord {
  id: string
  nasm_opt_phase: number
  phase_name: string
  plan_json?: {
    workouts?: WorkoutDay[]
    calendar?: Array<{
      day: number
      focus: string
      scheduledDate: string | null
      durationMins: number
      exerciseCount: number
    }>
  }
}

interface WorkoutLogRecord {
  id: string
  session_title: string
  session_date: string
  exertion_rpe?: number
}

interface BodyAnalysisRecord {
  estimated_bodyfat_percent?: number
}

interface WorkoutSetLogRecord {
  id: string
  session_date: string
  exercise_name: string
  set_number?: number
  reps: number
  weight_kg?: number
  rest_seconds?: number
  rpe?: number
  rir?: number
  is_warmup?: boolean
  notes?: string | null
}

interface InlineSetDraft {
  sessionDate: string
  setNumber: string
  reps: string
  weight: string
  restSeconds: string
  rpe: string
  rir: string
  isWarmup: boolean
  notes: string
}

interface FitnessTrackerClientProps {
  profile: FitnessProfile | null
  latestPlan: WorkoutPlanRecord | null
  logs: WorkoutLogRecord[]
  setLogs: WorkoutSetLogRecord[]
  latestAnalysis: BodyAnalysisRecord | null
  cardioLogs?: CardioLogEntry[]
  progressPhotos?: ProgressPhotoEntry[]
  initialWorkspace?: FitnessWorkspace
}

interface CardioLogEntry {
  id: string
  session_date: string
  activity_type: string
  duration_mins: number
  distance_km?: number | null
  avg_heart_rate?: number | null
  perceived_effort?: number | null
}

interface ProgressPhotoEntry {
  id: string
  photo_url: string
  taken_at: string
  notes?: string | null
  created_at?: string | null
}
type FitnessWorkspace = 'train' | 'analyze' | 'checkin'

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

function normalizeExerciseName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Returns the default rest period in seconds based on NASM OPT phase and exercise section.
 * Sourced from NASM OPT guidelines via master trainer consultation.
 *
 * Key principles:
 * - Phase 1 (Stabilization Endurance): 0–90 s — short rest maintains elevated HR for endurance adaptation
 * - Phase 2 (Strength Endurance): 0–60 s — superset structure, minimal rest
 * - Phase 3 (Hypertrophy): 30–90 s resistance — moderate rest for metabolic stress & growth
 * - Phase 4 (Maximal Strength): 180–300 s resistance — full CNS recovery for maximal effort
 * - Phase 5 (Power): 180–300 s resistance — full recovery between explosive sets
 * Warm-up and cool-down are continuous (0 s); activation, skill dev & client choice scale with phase.
 */
function defaultRestSeconds(phase: number, section?: string | null): number {
  const s = section ?? ''
  // Non-working sections: continuous movement, no prescribed rest
  if (s === 'warm-up' || s === 'cool-down') return 0
  // Activation (core & balance): light, always short
  if (s === 'activation') return 45
  // Skill development (plyometric & SAQ): technique focus, short but scales up slightly for power phases
  if (s === 'skill-development') return phase >= 4 ? 60 : 45
  // Resistance training: the big differentiator by phase
  if (s === 'resistance') {
    if (phase === 1) return 60   // Stabilization Endurance: 0–90 s, use 60
    if (phase === 2) return 45   // Strength Endurance: 0–60 s, minimal
    if (phase === 3) return 60   // Hypertrophy: 30–90 s, use 60
    if (phase === 4) return 240  // Maximal Strength: 3–5 min, use 4 min
    if (phase === 5) return 240  // Power: 3–5 min, use 4 min
  }
  // Client's choice: mirrors resistance for the phase
  if (s === 'clients-choice') {
    if (phase <= 2) return 45
    if (phase === 3) return 60
    return 240
  }
  // Fallback: use phase-based resistance default
  if (phase <= 2) return 60
  if (phase === 3) return 60
  return 240
}

function defaultInlineSetDraft(sessionDate: string, prescribedReps?: string | null, phase?: number, section?: string | null): InlineSetDraft {
  const repsDefault = (() => {
    const text = String(prescribedReps ?? '').trim()
    if (!text) return '8'
    const rangeMatch = text.match(/(\d+)\s*[-\u2013to]+\s*(\d+)/i)
    if (rangeMatch) return rangeMatch[1]
    const numMatch = text.match(/\d+/)
    return numMatch ? numMatch[0] : '8'
  })()
  const restDefault = defaultRestSeconds(phase ?? 1, section)
  return {
    sessionDate,
    setNumber: '1',
    reps: repsDefault,
    weight: '',
    restSeconds: String(restDefault),
    rpe: '7',
    rir: '2',
    isWarmup: false,
    notes: '',
  }
}

function exerciseDraftKey(workoutDay: number, exerciseName: string) {
  return `${String(workoutDay)}::${normalizeExerciseName(exerciseName)}`
}

function workoutDayTag(workoutDay: number) {
  return `[workout-day:${String(workoutDay)}]`
}

function extractWorkoutDayTag(notes: string | null | undefined) {
  const match = String(notes ?? '').match(/\[workout-day:(\d+)\]/i)
  if (!match) return null

  const day = Number(match[1])
  return Number.isFinite(day) ? day : null
}

function parseSetTarget(value: string | null | undefined) {
  const text = String(value ?? '').trim()
  if (!text) return 0

  const rangeMatch = text.match(/(\d+)\s*[-to]{1,3}\s*(\d+)/i)
  if (rangeMatch) {
    return Number(rangeMatch[2])
  }

  const firstNumberMatch = text.match(/\d+/)
  if (!firstNumberMatch) return 0

  return Number(firstNumberMatch[0])
}

export default function FitnessTrackerClient({ profile, latestPlan, logs, setLogs, latestAnalysis, cardioLogs = [], progressPhotos = [], initialWorkspace = 'train' }: FitnessTrackerClientProps) {
  const [plan, setPlan] = useState<WorkoutPlanRecord | null>(latestPlan)
  const [localWorkoutLogs, setLocalWorkoutLogs] = useState<WorkoutLogRecord[]>(logs)
  const [inlineSetDrafts, setInlineSetDrafts] = useState<Record<string, InlineSetDraft>>({})
  const [localSetLogs, setLocalSetLogs] = useState<WorkoutSetLogRecord[]>(setLogs)
  const [bodyfatState, setBodyfatState] = useState({
    estimated: latestAnalysis?.estimated_bodyfat_percent ? String(latestAnalysis.estimated_bodyfat_percent) : '',
  })
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [activeRestTimerKey, setActiveRestTimerKey] = useState<string | null>(null)
  const [completeModal, setCompleteModal] = useState<WorkoutDay | null>(null)
  const [skipModal, setSkipModal] = useState<{ workoutDay: number; exercise: WorkoutExercise } | null>(null)
  const [localCardioLogs, setLocalCardioLogs] = useState(cardioLogs)
  const [workspace, setWorkspace] = useState<FitnessWorkspace>(initialWorkspace)
  const initialUnits: 'metric' | 'imperial' = profile?.preferred_units === 'metric' ? 'metric' : 'imperial'
  const [units, setUnits] = useState<'metric' | 'imperial'>(initialUnits)
  const [activeWorkoutDay, setActiveWorkoutDay] = useState<number | null>(null)

  const planWorkouts = useMemo(() => {
    return plan?.plan_json?.workouts ?? []
  }, [plan])

  const planCalendarEntries = useMemo(() => {
    const explicitCalendar = plan?.plan_json?.calendar ?? []

    if (explicitCalendar.length > 0) {
      return explicitCalendar
        .filter(item => item.scheduledDate)
        .map(item => ({
          date: String(item.scheduledDate),
          title: `Day ${item.day}: ${item.focus}`,
          subtitle: `${item.exerciseCount} exercise${item.exerciseCount === 1 ? '' : 's'} • ${item.durationMins} mins`,
          workoutDay: item.day,
        }))
    }

    return planWorkouts
      .filter(workout => workout.scheduledDate)
      .map(workout => ({
        date: String(workout.scheduledDate),
        title: `Day ${workout.day}: ${workout.focus}`,
        subtitle: `${workout.exercises.length} exercise${workout.exercises.length === 1 ? '' : 's'}`,
        workoutDay: workout.day,
      }))
  }, [plan, planWorkouts])

  useEffect(() => {
    if (units === initialUnits) return

    let cancelled = false

    async function persistUnits() {
      const res = await fetch('/api/fitness/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredUnits: units }),
      })

      if (!res.ok && !cancelled) {
        setStatus('Could not save your units preference.')
      }
    }

    void persistUnits()
    return () => {
      cancelled = true
    }
  }, [units, initialUnits])

  const handleCalendarEntrySelect = useCallback((entry: { workoutDay?: number }) => {
    if (!entry.workoutDay) return
    setWorkspace('train')
    setActiveWorkoutDay(entry.workoutDay)
    setTimeout(() => {
      const target = document.getElementById(`workout-day-${entry.workoutDay}`)
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }, [])

  const setLogsByExercise = useMemo(() => {
    const map = new Map<string, WorkoutSetLogRecord[]>()

    for (const row of localSetLogs) {
      const key = normalizeExerciseName(row.exercise_name)
      const current = map.get(key) ?? []
      current.push(row)
      map.set(key, current)
    }

    return map
  }, [localSetLogs])

  const workoutProgressByDay = useMemo(() => {
    const map = new Map<number, { targetSets: number; loggedSets: number; totalReps: number; totalVolumeKg: number }>()

    for (const workout of planWorkouts) {
      const metric = { targetSets: 0, loggedSets: 0, totalReps: 0, totalVolumeKg: 0 }

      for (const exercise of workout.exercises) {
        metric.targetSets += parseSetTarget(exercise.sets)

          const logsForExercise = (setLogsByExercise.get(normalizeExerciseName(exercise.name)) ?? [])
            .filter(row => extractWorkoutDayTag(row.notes) === workout.day)
        metric.loggedSets += logsForExercise.length
        metric.totalReps += logsForExercise.reduce((sum, row) => sum + Number(row.reps ?? 0), 0)
        metric.totalVolumeKg += logsForExercise.reduce((sum, row) => sum + Number(row.reps ?? 0) * Number(row.weight_kg ?? 0), 0)
      }

      map.set(workout.day, metric)
    }

    return map
  }, [planWorkouts, setLogsByExercise])

  const progression = useMemo(() => {
    const byDate = new Map<string, { volume: number; sets: number; avgRpe: number; rpeCount: number }>()

    for (const row of localSetLogs) {
      const key = row.session_date
      const current = byDate.get(key) ?? { volume: 0, sets: 0, avgRpe: 0, rpeCount: 0 }
      const volume = Number(row.reps ?? 0) * Number(row.weight_kg ?? 0)
      current.volume += Number.isFinite(volume) ? volume : 0
      current.sets += 1

      const rpe = Number(row.rpe)
      if (Number.isFinite(rpe) && rpe > 0) {
        current.avgRpe += rpe
        current.rpeCount += 1
      }

      byDate.set(key, current)
    }

    const points = [...byDate.entries()]
      .map(([date, value]) => ({
        date,
        volume: Math.round(value.volume * 100) / 100,
        sets: value.sets,
        avgRpe: value.rpeCount > 0 ? Math.round((value.avgRpe / value.rpeCount) * 10) / 10 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const totalSets = localSetLogs.length
    const totalReps = localSetLogs.reduce((sum, row) => sum + Number(row.reps ?? 0), 0)
    const totalVolumeKg = localSetLogs.reduce((sum, row) => sum + Number(row.reps ?? 0) * Number(row.weight_kg ?? 0), 0)
    const rpeRows = localSetLogs.filter(row => Number(row.rpe ?? 0) > 0)
    const avgRpe = rpeRows.length > 0
      ? rpeRows.reduce((sum, row) => sum + Number(row.rpe ?? 0), 0) / rpeRows.length
      : 0

    return {
      points,
      totalSets,
      totalReps,
      totalVolumeKg: Math.round(totalVolumeKg),
      avgRpe: Number.isFinite(avgRpe) ? Math.round(avgRpe * 10) / 10 : 0,
    }
  }, [localSetLogs])

  async function handleInlineSetLog(e: React.FormEvent, workout: WorkoutDay, exercise: WorkoutExercise) {
    e.preventDefault()
    const key = exerciseDraftKey(workout.day, exercise.name)
    const initialDate = workout.scheduledDate || todayDateOnly()
    const draft = inlineSetDrafts[key] ?? defaultInlineSetDraft(initialDate, exercise.reps, plan?.nasm_opt_phase, exercise.block)

    setBusy(`set-log:${key}`)
    setStatus(null)

    const weightValue = Number(draft.weight)
    const weightKg = Number.isFinite(weightValue) && weightValue > 0
      ? (units === 'imperial' ? weightValue * 0.45359237 : weightValue)
      : undefined

    const res = await fetch('/api/workouts/log-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workoutPlanId: plan?.id,
        sessionDate: draft.sessionDate,
        exerciseName: exercise.name,
        setNumber: Number(draft.setNumber),
        reps: Number(draft.reps),
        weightKg,
        restSeconds: Number(draft.restSeconds),
        rpe: Number(draft.rpe),
        rir: Number(draft.rir),
        isWarmup: draft.isWarmup,
        notes: `${workoutDayTag(workout.day)} ${draft.notes}`.trim(),
      }),
    })

    const payload = await res.json()
    setBusy(null)

    if (!res.ok) {
      setStatus(payload.error ?? 'Could not save set log')
      return
    }

    setLocalSetLogs(prev => [payload.setLog as WorkoutSetLogRecord, ...prev])
    setStatus(`Logged set for ${exercise.name}. Metrics updated.`)
    // Auto-start rest timer
    setActiveRestTimerKey(key)
    setInlineSetDrafts(prev => ({
      ...prev,
      [key]: {
        ...draft,
        setNumber: String(Math.max(1, Number(draft.setNumber || '1') + 1)),
        notes: '',
      },
    }))
  }

  async function handleSkipExercise(workout: WorkoutDay, exercise: WorkoutExercise, reason: string, notes: string) {
    await fetch('/api/fitness/skip-exercise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_date: todayDateOnly(),
        exercise_name: exercise.name,
        workout_day: workout.day,
        reason,
        notes: notes || null,
      }),
    })
    setSkipModal(null)
    setStatus(`Skipped ${exercise.name}.`)
  }

  const handleTimerDone = useCallback(() => {
    setActiveRestTimerKey(null)
  }, [])

  async function handleCompleteWorkoutDay(workout: WorkoutDay, exertionRpe?: number) {
    const busyKey = `log-day:${String(workout.day)}`
    const sessionDate = workout.scheduledDate || todayDateOnly()
    const sessionTitle = `Day ${String(workout.day)}: ${workout.focus}`

    const existing = localWorkoutLogs.find(
      row => row.session_date === sessionDate && row.session_title === sessionTitle
    )
    if (existing) {
      setStatus('This workout day is already logged.')
      return
    }

    setBusy(busyKey)
    setStatus(null)

    const res = await fetch('/api/workouts/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workoutPlanId: plan?.id,
        sessionDate,
        sessionTitle,
        exertionRpe: Number.isFinite(exertionRpe) ? exertionRpe : undefined,
        notes: `${workoutDayTag(workout.day)} Completed from current workout plan.`,
        completed: true,
      }),
    })

    const payload = await res.json()
    setBusy(null)

    if (!res.ok) {
      setStatus(payload.error ?? 'Could not save workout log')
      return
    }

    if (payload?.log) {
      setLocalWorkoutLogs(prev => [payload.log as WorkoutLogRecord, ...prev])
    }
    setCompleteModal(null)
    setStatus(`Marked Day ${String(workout.day)} complete.`)
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 22 }}>
        <div style={{ border: '1px solid var(--navy-lt)', padding: 16, background: 'var(--navy-mid)' }}>
          <p style={{ margin: '0 0 6px', color: 'var(--gray)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Current Goal</p>
          <div style={{ fontSize: 22, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>{String(profile?.fitness_goal ?? 'Not set')}</div>
        </div>
        <div style={{ border: '1px solid var(--navy-lt)', padding: 16, background: 'var(--navy-mid)' }}>
          <p style={{ margin: '0 0 6px', color: 'var(--gray)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Nasm OPT Phase</p>
          <div style={{ fontSize: 22, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>
            {plan ? `Phase ${String(plan.nasm_opt_phase)} - ${String(plan.phase_name)}` : 'Not generated'}
          </div>
        </div>
        <div style={{ border: '1px solid var(--navy-lt)', padding: 16, background: 'var(--navy-mid)' }}>
          <p style={{ margin: '0 0 6px', color: 'var(--gray)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Estimated Body Fat</p>
          <div style={{ fontSize: 22, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>{bodyfatState.estimated ? `~${bodyfatState.estimated}%` : 'Unknown'}</div>
          <p style={{ margin: '4px 0 0', color: 'var(--gray)', fontSize: 11 }}>Approximation</p>
        </div>
      </div>
      <section style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 12, marginBottom: 16 }}>
        <p style={{ margin: '0 0 10px', color: 'var(--gray)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Display Units
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {([
            { key: 'imperial', label: 'Imperial (lb)' },
            { key: 'metric', label: 'Metric (kg)' },
          ] as const).map(option => {
            const active = units === option.key
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setUnits(option.key)}
                style={{
                  border: active ? '1px solid rgba(212,160,23,0.55)' : '1px solid rgba(255,255,255,0.14)',
                  background: active ? 'rgba(212,160,23,0.14)' : 'var(--navy)',
                  color: active ? 'var(--gold-lt)' : 'var(--white)',
                  padding: '8px 12px',
                  cursor: 'pointer',
                }}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </section>
      <section style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 12, marginBottom: 16 }}>
        <p style={{ margin: '0 0 10px', color: 'var(--gray)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Focus Workspace
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            { key: 'train' as const, label: 'Train', hint: 'Workout plan, set logging, calendar + cardio' },
            { key: 'analyze' as const, label: 'Analyze', hint: 'Stats, trends, recent logs' },
            { key: 'checkin' as const, label: 'Check-In', hint: 'Recovery check-in and progress review' },
          ].map(tab => {
            const active = workspace === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setWorkspace(tab.key)}
                style={{
                  border: active ? '1px solid rgba(212,160,23,0.55)' : '1px solid rgba(255,255,255,0.14)',
                  background: active ? 'rgba(212,160,23,0.14)' : 'var(--navy)',
                  color: active ? 'var(--gold-lt)' : 'var(--white)',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 18 }}>{tab.label}</div>
                <div style={{ color: 'var(--gray)', fontSize: 11 }}>{tab.hint}</div>
              </button>
            )
          })}
        </div>
      </section>

      {workspace === 'train' && (
      <>
      <div className="fitness-main-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, alignItems: 'start' }}>
        <section style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18 }}>
          <div className="fitness-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 28 }}>Current Workout Plan</h2>
          </div>

          {planWorkouts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {planWorkouts.map(workout => (
                <a
                  key={`jump-${workout.day}`}
                  href={`#workout-day-${workout.day}`}
                  style={{
                    border: '1px solid rgba(255,255,255,0.18)',
                    background: 'var(--navy)',
                    color: 'var(--white)',
                    textDecoration: 'none',
                    padding: '6px 10px',
                    fontSize: 12,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Day {workout.day}
                </a>
              ))}
            </div>
          )}

          {planWorkouts.length === 0 ? (
            <p style={{ color: 'var(--gray)', margin: 0 }}>No plan generated yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {planWorkouts.map(workout => {
                const workoutProgress = workoutProgressByDay.get(workout.day) ?? { targetSets: 0, loggedSets: 0, totalReps: 0, totalVolumeKg: 0 }
                const completionRatio = workoutProgress.targetSets > 0
                  ? Math.min(1, workoutProgress.loggedSets / workoutProgress.targetSets)
                  : 0

                return (
                <details id={`workout-day-${workout.day}`} key={workout.day} open={activeWorkoutDay ? workout.day === activeWorkoutDay : workout.day === 1} style={accordionWorkoutStyle}>
                  <summary style={accordionWorkoutSummaryStyle}>
                    <span style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em', fontSize: 21 }}>
                      Day {workout.day}: {workout.focus}
                    </span>
                    <span style={{ color: 'var(--gray)', fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {workout.exercises.length} exercises | {Math.round(completionRatio * 100)}% complete
                    </span>
                  </summary>
                  <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <span style={workoutStatBadgeStyle}>Sets: {workoutProgress.loggedSets}/{workoutProgress.targetSets || '-'}</span>
                    <span style={workoutStatBadgeStyle}>Reps: {workoutProgress.totalReps}</span>
                    <span style={workoutStatBadgeStyle}>Volume: {formatWeight(workoutProgress.totalVolumeKg, units)}</span>
                    <span style={workoutStatBadgeStyle}>Completion: {Math.round(completionRatio * 100)}%</span>
                  </div>
                  <div style={{ height: 6, width: '100%', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', marginBottom: 10 }}>
                    <div style={{ height: '100%', width: `${Math.round(completionRatio * 100)}%`, background: 'var(--gold)' }} />
                  </div>
                  {workout.scheduledDate && (
                    <p style={{ margin: '0 0 10px', color: 'var(--gold)', fontSize: 13 }}>
                      Scheduled for {new Date(`${workout.scheduledDate}T12:00:00Z`).toLocaleDateString()}
                    </p>
                  )}
                  {workout.notes && (
                    <p style={{ margin: '0 0 12px', color: 'var(--gray)', fontSize: 13, lineHeight: 1.5 }}>{workout.notes}</p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                    <button
                      type="button"
                      onClick={() => setCompleteModal(workout)}
                      disabled={busy === `log-day:${String(workout.day)}`}
                      style={buttonStyle}
                    >
                      {busy === `log-day:${String(workout.day)}` ? 'Saving...' : `Mark Day ${String(workout.day)} Complete`}
                    </button>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                    {(() => {
                      const OPT_SECTION_ORDER = ['warm-up','activation','skill-development','resistance','clients-choice','cool-down']
                      const OPT_SECTION_LABELS: Record<string, string> = {
                        'warm-up': 'WARM-UP',
                        'activation': 'ACTIVATION (core & balance)',
                        'skill-development': 'SKILL DEVELOPMENT (plyometric & SAQ)',
                        'resistance': 'RESISTANCE TRAINING',
                        'clients-choice': "CLIENT'S CHOICE",
                        'cool-down': 'COOL-DOWN',
                      }
                      const hasSections = workout.exercises.some(ex => ex.block && OPT_SECTION_ORDER.includes(ex.block))
                      const seenSections = new Set<string>()
                      return workout.exercises.map((ex, exIdx) => {
                        const exerciseKey = exerciseDraftKey(workout.day, ex.name)
                        const draft = inlineSetDrafts[exerciseKey] ?? defaultInlineSetDraft(workout.scheduledDate || todayDateOnly(), ex.reps, plan?.nasm_opt_phase, ex.block)
                        const exerciseRecentLogs = (setLogsByExercise.get(normalizeExerciseName(ex.name)) ?? [])
                          .filter(row => extractWorkoutDayTag(row.notes) === workout.day)
                          .slice(0, 3)
                        const exLoggedSets = (setLogsByExercise.get(normalizeExerciseName(ex.name)) ?? [])
                          .filter(row => extractWorkoutDayTag(row.notes) === workout.day && !row.is_warmup).length
                        const exTargetSets = parseSetTarget(ex.sets)

                        const sectionHeader = hasSections && ex.block && OPT_SECTION_ORDER.includes(ex.block) && !seenSections.has(ex.block)
                          ? (() => { seenSections.add(ex.block!); return (
                            <div key={`sh-${ex.block}`} style={{
                              margin: exIdx === 0 ? '0 0 6px' : '16px 0 6px',
                              padding: '4px 10px',
                              background: 'rgba(212,160,23,0.1)',
                              borderLeft: '3px solid var(--gold)',
                              fontFamily: 'Bebas Neue, sans-serif',
                              fontSize: 13,
                              letterSpacing: '0.1em',
                              color: 'var(--gold)',
                            }}>{OPT_SECTION_LABELS[ex.block!] ?? ex.block!.toUpperCase()}</div>
                          ) })()
                          : null

                        return (
                          <li key={`${workout.day}-${ex.name}`} style={{ marginBottom: 12, listStyle: 'none' }}>
                            {sectionHeader}
                        <details style={accordionExerciseStyle}>
                          <summary style={accordionExerciseSummaryStyle}>
                            <span style={{ color: 'var(--white)', fontWeight: 600 }}>
                              {ex.name}
                            </span>
                            <span style={{ color: exLoggedSets >= exTargetSets && exTargetSets > 0 ? 'var(--gold)' : 'var(--gray)', fontSize: 12 }}>
                              {ex.sets} sets × {ex.reps}{ex.tempo ? ` · Tempo ${ex.tempo}` : ''}{ex.rest ? ` · Rest ${ex.rest}` : ''}
                              {exTargetSets > 0 && (
                                <span style={{ marginLeft: 8, padding: '1px 7px', border: `1px solid ${exLoggedSets >= exTargetSets ? 'rgba(212,160,23,0.5)' : 'rgba(255,255,255,0.15)'}`, background: exLoggedSets >= exTargetSets ? 'rgba(212,160,23,0.15)' : 'rgba(255,255,255,0.05)', color: exLoggedSets >= exTargetSets ? 'var(--gold)' : 'var(--gray)', borderRadius: 2 }}>
                                  {exLoggedSets}/{exTargetSets} sets
                                </span>
                              )}
                            </span>
                          </summary>
                          <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        {ex.description && (() => {
                          const lines = formatExerciseDescriptionLines(ex.description)
                          if (lines.length === 0) return null

                          if (lines.length === 1) {
                            return <p style={{ margin: '4px 0 0', color: 'var(--gray)', fontSize: 13, lineHeight: 1.5 }}>{lines[0]}</p>
                          }

                          return (
                            <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                              {lines.map((line, index) => (
                                <p key={`${workout.day}-${ex.name}-desc-${index}`} style={{ margin: 0, color: 'var(--gray)', fontSize: 13, lineHeight: 1.5 }}>
                                  {line}
                                </p>
                              ))}
                            </div>
                          )
                        })()}
                        {ex.notes && (
                          <p style={{ margin: '4px 0 0', color: 'var(--gold)', fontSize: 13 }}>{ex.notes}</p>
                        )}
                        {(equipmentBadges(ex.primaryEquipment).length > 0 || ex.imageUrl || ex.videoUrl) && (
                          <div style={{ display: 'grid', gridTemplateColumns: ex.imageUrl ? '76px 1fr' : '1fr', gap: 10, marginTop: 8 }}>
                            {ex.imageUrl && (
                              <div
                                aria-hidden="true"
                                style={{
                                  width: 76,
                                  minHeight: 76,
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  backgroundImage: `url(${ex.imageUrl})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                }}
                              />
                            )}
                            <div>
                              {(() => {
                                const equipmentItems = Array.isArray(ex.primaryEquipment)
                                  ? ex.primaryEquipment.map(item => String(item ?? '').trim()).filter(Boolean)
                                  : []
                                const badgeItems = equipmentItems.length > 0 ? equipmentItems : ['Bodyweight']

                                return (
                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {badgeItems.map(item => (
                                      <span
                                        key={item}
                                        style={{
                                          border: '1px solid rgba(212,160,23,0.22)',
                                          background: 'rgba(212,160,23,0.12)',
                                          color: 'var(--gold)',
                                          padding: '2px 8px',
                                          fontSize: 11,
                                          letterSpacing: '0.06em',
                                          textTransform: 'uppercase',
                                        }}
                                      >
                                        {item}
                                      </span>
                                    ))}
                                  </div>
                                )
                              })()}
                              {ex.videoUrl && (
                                <a href={ex.videoUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', marginTop: 8, color: 'var(--gold-lt)', textDecoration: 'none', fontSize: 13 }}>
                                  Open exercise video
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                          <form onSubmit={event => handleInlineSetLog(event, workout, ex)} style={{ marginTop: 10, border: '1px solid rgba(255,255,255,0.08)', padding: 10, background: 'rgba(13,27,42,0.55)' }}>
                            <p style={{ margin: '0 0 8px', color: 'var(--gray)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                              Log set here (no separate scrolling needed)
                            </p>
                            <p style={{ margin: '0 0 8px', color: 'var(--gray)', fontSize: 11, lineHeight: 1.45 }}>
                              Pre-filled values are starting suggestions from your plan. Update each field to what you actually completed.
                            </p>
                            <div className="fitness-set-input-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <div>
                                <label style={setFieldLabelStyle}>Workout Date</label>
                                <input
                                  type="date"
                                  value={draft.sessionDate}
                                  onChange={event => {
                                    const value = event.target.value
                                    setInlineSetDrafts(prev => ({ ...prev, [exerciseKey]: { ...draft, sessionDate: value } }))
                                  }}
                                  style={inputStyle}
                                  required
                                  aria-label="Session date"
                                />
                                <p style={setFieldHintStyle}>Date this set was completed.</p>
                              </div>
                              <div>
                                <label style={setFieldLabelStyle}>Set Number</label>
                                <input
                                  type="number"
                                  min={1}
                                  value={draft.setNumber}
                                  onChange={event => {
                                    const value = event.target.value
                                    setInlineSetDrafts(prev => ({ ...prev, [exerciseKey]: { ...draft, setNumber: value } }))
                                  }}
                                  style={inputStyle}
                                  placeholder="1"
                                  aria-label="Set number"
                                />
                                <p style={setFieldHintStyle}>Set order for this exercise on this date.</p>
                              </div>
                            </div>
                            <div className="fitness-set-input-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                              <div>
                                <label style={setFieldLabelStyle}>Reps Completed</label>
                                <input
                                  type="number"
                                  min={1}
                                  value={draft.reps}
                                  onChange={event => {
                                    const value = event.target.value
                                    setInlineSetDrafts(prev => ({ ...prev, [exerciseKey]: { ...draft, reps: value } }))
                                  }}
                                  style={inputStyle}
                                  placeholder="8"
                                  required
                                  aria-label="Number of reps"
                                />
                                <p style={setFieldHintStyle}>Actual reps completed in this set.</p>
                              </div>
                              <div>
                                <label style={setFieldLabelStyle}>Weight Used ({units === 'imperial' ? 'lb' : 'kg'})</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min={0}
                                  value={draft.weight}
                                  onChange={event => {
                                    const value = event.target.value
                                    setInlineSetDrafts(prev => ({ ...prev, [exerciseKey]: { ...draft, weight: value } }))
                                  }}
                                  style={inputStyle}
                                  placeholder={units === 'imperial' ? 'e.g. 95' : 'e.g. 42.5'}
                                  aria-label={`Weight in ${units === 'imperial' ? 'pounds' : 'kilograms'}`}
                                />
                                <p style={setFieldHintStyle}>Total load used for this set. Leave blank for bodyweight/no load.</p>
                              </div>
                            </div>
                            <div className="fitness-set-input-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
                              <div>
                                <label style={setFieldLabelStyle}>Rest (sec)</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.restSeconds}
                                  onChange={event => {
                                    const value = event.target.value
                                    setInlineSetDrafts(prev => ({ ...prev, [exerciseKey]: { ...draft, restSeconds: value } }))
                                  }}
                                  style={inputStyle}
                                  placeholder="60"
                                  aria-label="Rest time in seconds"
                                />
                                <p style={setFieldHintStyle}>Seconds rested before the next set.</p>
                              </div>
                              <div>
                                <label style={setFieldLabelStyle}>RPE (1-10)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min={1}
                                  max={10}
                                  value={draft.rpe}
                                  onChange={event => {
                                    const value = event.target.value
                                    setInlineSetDrafts(prev => ({ ...prev, [exerciseKey]: { ...draft, rpe: value } }))
                                  }}
                                  style={inputStyle}
                                  placeholder="7"
                                  aria-label="Rate of perceived exertion (1-10)"
                                  title="Rate of Perceived Exertion (1-10)"
                                />
                                <p style={setFieldHintStyle}>How hard the set felt, 10 = max effort.</p>
                              </div>
                              <div>
                                <label style={setFieldLabelStyle}>RIR (0-6)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min={0}
                                  max={6}
                                  value={draft.rir}
                                  onChange={event => {
                                    const value = event.target.value
                                    setInlineSetDrafts(prev => ({ ...prev, [exerciseKey]: { ...draft, rir: value } }))
                                  }}
                                  style={inputStyle}
                                  placeholder="2"
                                  aria-label="Reps in reserve (0-6)"
                                  title="Reps in Reserve (0-6)"
                                />
                                <p style={setFieldHintStyle}>Estimated reps left before failure.</p>
                              </div>
                              <div>
                                <label style={setFieldLabelStyle}>Set Type</label>
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--gray)', fontSize: 12, border: '1px solid var(--navy-lt)', minHeight: 44 }}>
                                  <input
                                    type="checkbox"
                                    checked={draft.isWarmup}
                                    onChange={event => {
                                      const checked = event.target.checked
                                      setInlineSetDrafts(prev => ({ ...prev, [exerciseKey]: { ...draft, isWarmup: checked } }))
                                    }}
                                    aria-label="Mark as warm-up set"
                                  />
                                  Warm-up set
                                </label>
                                <p style={setFieldHintStyle}>Check for non-working preparation sets.</p>
                              </div>
                            </div>
                            <div style={{ marginTop: 8 }}>
                              <label style={setFieldLabelStyle}>Set Notes (optional)</label>
                              <textarea
                                value={draft.notes}
                                onChange={event => {
                                  const value = event.target.value
                                  setInlineSetDrafts(prev => ({ ...prev, [exerciseKey]: { ...draft, notes: value } }))
                                }}
                                style={{ ...inputStyle, minHeight: 62 }}
                                placeholder="Form cues, pain, tempo changes, or equipment used"
                              />
                              <p style={setFieldHintStyle}>Useful context for your coach and future progression.</p>
                            </div>
                            <button type="submit" disabled={busy === `set-log:${exerciseKey}`} style={{ ...buttonStyle, marginTop: 8 }}>
                              {busy === `set-log:${exerciseKey}` ? 'Saving...' : 'Save Set'}
                            </button>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                              {activeRestTimerKey === exerciseKey && (
                                <RestTimer
                                  defaultSeconds={draft.restSeconds ? Number(draft.restSeconds) : 90}
                                  onDone={handleTimerDone}
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => setSkipModal({ workoutDay: workout.day, exercise: ex })}
                                style={{ fontSize: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--gray)', padding: '4px 10px', cursor: 'pointer', fontFamily: 'Raleway, sans-serif' }}
                              >
                                Skip Exercise
                              </button>
                            </div>
                            {exerciseRecentLogs.length > 0 && (
                              <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                                {exerciseRecentLogs.map(row => (
                                  <div key={row.id} style={{ fontSize: 12, color: 'var(--gray)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6 }}>
                                    {row.session_date} | Set {row.set_number ?? '-'} | {row.reps} reps | {formatWeight(row.weight_kg, units)} | RPE {row.rpe ?? '-'}
                                  </div>
                                ))}
                              </div>
                            )}
                          </form>
                          </div>
                        </details>
                          </li>
                        )
                      })
                    })()}
                  </ul>
                  </div>
                </details>
                  )
                })}
            </div>
          )}
        </section>

      </div>

      <div style={{ marginTop: 16 }}>
        <WorkoutCalendarView
          entries={planCalendarEntries}
          title="Workout Calendar"
          subtitle="Your coach can assign scheduled training dates for each session block."
          onSelectEntry={handleCalendarEntrySelect}
        />
      </div>

      <section style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18, marginTop: 16 }}>
        <h2 style={{ margin: '0 0 16px', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 28 }}>Cardio Sessions</h2>
        <CardioLogForm preferredUnits={units} initialLogs={localCardioLogs} />
      </section>

      </>
      )}

      {(workspace === 'analyze' || workspace === 'checkin') && (
        <div className="fitness-sub-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, marginTop: 16 }}>
          {workspace === 'analyze' && (
            <section style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18 }}>
              <h2 style={{ margin: '0 0 10px', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 28 }}>Progress Stats</h2>
              <div className="fitness-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(140px, 1fr))', gap: 10 }}>
                <Stat label="Total Sets" value={String(progression.totalSets)} />
                <Stat label="Total Reps" value={String(progression.totalReps)} />
                <Stat label={`Total Volume (${units === 'imperial' ? 'lb' : 'kg'})`} value={units === 'imperial' ? String(Math.round(progression.totalVolumeKg * 2.20462)) : String(progression.totalVolumeKg)} />
                <Stat label="Avg RPE" value={String(progression.avgRpe || '-')} />
              </div>

              <div style={{ marginTop: 14 }}>
                <p style={{ margin: '0 0 6px', color: 'var(--gray)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Volume Trend</p>
                <TrendChart
                  points={progression.points.map(p => ({ label: shortDate(p.date), value: units === 'imperial' ? p.volume * 2.20462 : p.volume }))}
                  stroke="var(--gold)"
                />
              </div>

              <div style={{ marginTop: 14 }}>
                <p style={{ margin: '0 0 6px', color: 'var(--gray)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Sets Per Session</p>
                <TrendChart points={progression.points.map(p => ({ label: shortDate(p.date), value: p.sets }))} stroke="#48BB78" />
              </div>

              <div style={{ marginTop: 14 }}>
                <p style={{ margin: '0 0 6px', color: 'var(--gray)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Avg RPE Trend</p>
                <TrendChart points={progression.points.map(p => ({ label: shortDate(p.date), value: p.avgRpe }))} stroke="#89A7C6" min={1} max={10} />
              </div>
            </section>
          )}

        </div>
      )}

      {status && <p style={{ marginTop: 14, color: status.toLowerCase().includes('could') ? 'var(--error)' : 'var(--success)' }}>{status}</p>}

      {workspace === 'analyze' && localWorkoutLogs.length > 0 && (
        <section style={{ marginTop: 18, border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18 }}>
          <h2 style={{ margin: '0 0 10px', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 28 }}>Recent Logs</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {localWorkoutLogs.map(log => (
              <div key={String(log.id)} style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy)', padding: 10 }}>
                <div style={{ fontWeight: 600 }}>{String(log.session_title)}</div>
                <div style={{ color: 'var(--gray)', fontSize: 13, overflowWrap: 'anywhere' }}>{String(log.session_date)} | RPE {String(log.exertion_rpe ?? '-')}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {workspace === 'analyze' && localSetLogs.length > 0 && (
        <section style={{ marginTop: 18, border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18 }}>
          <h2 style={{ margin: '0 0 10px', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 28 }}>Recent Sets</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {localSetLogs.slice(0, 15).map(row => (
              <div key={row.id} style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy)', padding: 10 }}>
                <div style={{ fontWeight: 600 }}>{row.exercise_name}</div>
                <div style={{ color: 'var(--gray)', fontSize: 13, overflowWrap: 'anywhere' }}>
                  {row.session_date} | Set {row.set_number ?? '-'} | {row.reps} reps | {formatWeight(row.weight_kg, units)} | Rest {row.rest_seconds ?? '-'}s | RPE {row.rpe ?? '-'} | RIR {row.rir ?? '-'}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {workspace === 'checkin' && (
      <>
        {/* Weekly Check-In */}
        <section style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18, marginTop: 16 }}>
          <h2 style={{ margin: '0 0 16px', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 28 }}>Weekly Check-In</h2>
          <WeeklyCheckinForm preferredUnits={units} />
        </section>

        <div style={{ marginTop: 16 }}>
          <ProgressPhotoTimeline
            initialPhotos={progressPhotos}
            canUpload
            subtitle="Upload progress photos and run an approximate body-fat check from the same flow. Estimates are directional only."
            bodyFatInputs={{
              sex: profile?.sex,
              heightCm: profile?.height_cm,
              weightKg: profile?.weight_kg,
              waistCm: profile?.waist_cm,
              neckCm: profile?.neck_cm,
              hipCm: profile?.hip_cm,
            }}
            estimatedBodyfat={bodyfatState.estimated || null}
            onEstimatedBodyfat={(value) => {
              setBodyfatState({ estimated: String(value) })
              setStatus(`Approximate body-fat estimate: ${value}%`)
            }}
          />
        </div>
      </>
      )}

      {completeModal && (
        <CompleteWorkoutModal
          workout={completeModal}
          onClose={() => setCompleteModal(null)}
          onConfirm={(rpe) => {
            void handleCompleteWorkoutDay(completeModal, rpe)
          }}
          busy={busy === `log-day:${String(completeModal.day)}`}
        />
      )}

      {/* Skip Exercise Modal */}
      {skipModal && (
        <SkipExerciseModal
          exercise={skipModal.exercise}
          workoutDay={skipModal.workoutDay}
          onConfirm={(reason, notes) => {
            const fakeWorkout: WorkoutDay = { day: skipModal.workoutDay, focus: '', exercises: [] }
            void handleSkipExercise(fakeWorkout, skipModal.exercise, reason, notes)
          }}
          onClose={() => setSkipModal(null)}
        />
      )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy)', padding: 10 }}>
      <div style={{ color: 'var(--gray)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, letterSpacing: '0.04em' }}>{value}</div>
    </div>
  )
}

function shortDate(dateString: string) {
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return dateString
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatWeight(weightKg: number | undefined, units: 'metric' | 'imperial') {
  if (!weightKg) return '-'
  if (units === 'imperial') return `${Math.round(weightKg * 2.20462 * 10) / 10} lb`
  return `${Math.round(weightKg * 10) / 10} kg`
}

function TrendChart({
  points,
  stroke,
  min,
  max,
}: {
  points: Array<{ label: string; value: number }>
  stroke: string
  min?: number
  max?: number
}) {
  if (points.length === 0) {
    return <div style={{ color: 'var(--gray)', fontSize: 13 }}>No data yet</div>
  }

  const width = 520
  const height = 140
  const pad = 18
  const values = points.map(p => p.value)
  const minValue = min ?? Math.min(...values)
  const maxValue = max ?? Math.max(...values)
  const range = maxValue - minValue || 1

  const coords = points.map((p, i) => {
    const x = pad + (i / Math.max(points.length - 1, 1)) * (width - pad * 2)
    const y = height - pad - ((p.value - minValue) / range) * (height - pad * 2)
    return `${x},${y}`
  })

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 140, background: 'var(--navy)', border: '1px solid var(--navy-lt)' }}>
      <polyline fill="none" stroke={stroke} strokeWidth="3" points={coords.join(' ')} />
    </svg>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--navy-lt)',
  background: 'var(--navy)',
  color: 'var(--white)',
  minHeight: 44,
  fontSize: 16,
}

const setFieldLabelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  color: 'var(--gray)',
  fontSize: 11,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
}

const setFieldHintStyle: React.CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--gray)',
  fontSize: 11,
  lineHeight: 1.35,
}

const buttonStyle: React.CSSProperties = {
  border: 0,
  background: 'var(--gold)',
  color: '#0D1B2A',
  padding: '10px 14px',
  fontFamily: 'Bebas Neue, sans-serif',
  fontSize: 17,
  letterSpacing: '0.06em',
  cursor: 'pointer',
  minHeight: 44,
}

const workoutStatBadgeStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--white)',
  padding: '2px 8px',
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const accordionWorkoutStyle: React.CSSProperties = {
  border: '1px solid var(--navy-lt)',
  background: 'var(--navy)',
}

const accordionWorkoutSummaryStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 12px',
  cursor: 'pointer',
}

const accordionExerciseStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(13,27,42,0.62)',
}

const accordionExerciseSummaryStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  padding: '8px 10px',
  cursor: 'pointer',
}

function CompleteWorkoutModal({ workout, onConfirm, onClose, busy }: {
  workout: WorkoutDay
  onConfirm: (rpe?: number) => void
  onClose: () => void
  busy: boolean
}) {
  const [rpe, setRpe] = useState('')
  const parsedRpe = Number(rpe)
  const canSubmit = rpe.trim() === '' || (Number.isFinite(parsedRpe) && parsedRpe >= 1 && parsedRpe <= 10)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-lt)', padding: 24, maxWidth: 420, width: '100%' }}>
        <h3 style={{ margin: '0 0 12px', fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, letterSpacing: '0.05em' }}>
          Complete Day {String(workout.day)}
        </h3>
        <p style={{ color: 'var(--gray)', fontSize: 13, margin: '0 0 12px' }}>
          {workout.focus} - optionally add session RPE (1-10), then save.
        </p>
        <input
          type="number"
          min={1}
          max={10}
          step="0.5"
          value={rpe}
          onChange={e => setRpe(e.target.value)}
          placeholder="Optional RPE"
          style={{ width: '100%', padding: '10px 12px', background: 'var(--navy)', border: '1px solid var(--navy-lt)', color: 'var(--white)', fontFamily: 'Raleway, sans-serif', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--navy-lt)', color: 'var(--gray)', fontFamily: 'Raleway, sans-serif', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={() => onConfirm(Number.isFinite(parsedRpe) ? parsedRpe : undefined)}
            disabled={!canSubmit || busy}
            style={{ padding: '8px 16px', background: 'var(--gold)', color: '#0D1B2A', border: 'none', fontFamily: 'Bebas Neue, sans-serif', fontSize: 15, letterSpacing: '0.05em', cursor: 'pointer' }}
          >
            {busy ? 'Saving...' : 'Save Completion'}
          </button>
        </div>
      </div>
    </div>
  )
}

  function SkipExerciseModal({ exercise, workoutDay, onConfirm, onClose }: {
    exercise: WorkoutExercise
    workoutDay: number
    onConfirm: (reason: string, notes: string) => void
    onClose: () => void
  }) {
    const [reason, setReason] = useState('other')
    const [notes, setNotes] = useState('')
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-lt)', padding: 24, maxWidth: 400, width: '100%' }}>
          <h3 style={{ margin: '0 0 12px', fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, letterSpacing: '0.05em' }}>Skip: {exercise.name}</h3>
          <p style={{ color: 'var(--gray)', fontSize: 13, margin: '0 0 12px' }}>Day {workoutDay} — Why are you skipping?</p>
          <select value={reason} onChange={e => setReason(e.target.value)} style={{ width: '100%', padding: '8px 10px', background: 'var(--navy)', border: '1px solid var(--navy-lt)', color: 'var(--white)', fontFamily: 'Raleway, sans-serif', fontSize: 14, marginBottom: 10 }}>
            <option value="no_equipment">No Equipment</option>
            <option value="injury">Injury / Pain</option>
            <option value="time">Running Out of Time</option>
            <option value="other">Other</option>
          </select>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes (optional)" rows={2} style={{ width: '100%', padding: '8px 10px', background: 'var(--navy)', border: '1px solid var(--navy-lt)', color: 'var(--white)', fontFamily: 'Raleway, sans-serif', fontSize: 14, marginBottom: 12, resize: 'vertical', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--navy-lt)', color: 'var(--gray)', fontFamily: 'Raleway, sans-serif', cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => onConfirm(reason, notes)} style={{ padding: '8px 16px', background: 'var(--gold)', color: '#0D1B2A', border: 'none', fontFamily: 'Bebas Neue, sans-serif', fontSize: 15, letterSpacing: '0.05em', cursor: 'pointer' }}>Log Skip</button>
          </div>
        </div>
      </div>
    )
  }
