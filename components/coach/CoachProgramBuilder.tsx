'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import WorkoutCalendarView from '@/components/fitness/WorkoutCalendarView'
import type {
  ExerciseLibraryRecord,
  EquipmentLibraryRecord,
  WorkoutProgramTemplateRecord,
} from '@/lib/coach-programs'

interface LatestWorkoutPlan {
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
  exercises: ExerciseLibraryRecord[]
  equipment: EquipmentLibraryRecord[]
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

export default function CoachProgramBuilder({ clientId, latestPlan, templates, exercises, equipment }: CoachProgramBuilderProps) {
  const router = useRouter()
  const exerciseListId = `exercise-library-${clientId}`
  const [templateId, setTemplateId] = useState('')
  const [name, setName] = useState(String(latestPlan?.name ?? '').trim())
  const [goal, setGoal] = useState(String(latestPlan?.goal ?? '').trim())
  const [nasmOptPhase, setNasmOptPhase] = useState(String(latestPlan?.nasm_opt_phase ?? 1))
  const [phaseName, setPhaseName] = useState(String(latestPlan?.phase_name ?? 'Stabilization Endurance').trim())
  const [sessionsPerWeek, setSessionsPerWeek] = useState(String(latestPlan?.sessions_per_week ?? 3))
  const [estimatedDurationMins, setEstimatedDurationMins] = useState(String(latestPlan?.estimated_duration_mins ?? 60))
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [days, setDays] = useState(() => initialDaysFromPlan(latestPlan))
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const exerciseMap = useMemo(() => {
    return new Map(exercises.map(exercise => [exercise.name.trim().toLowerCase(), exercise]))
  }, [exercises])

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

  function applyTemplate(nextTemplateId: string) {
    setTemplateId(nextTemplateId)

    if (!nextTemplateId) {
      return
    }

    const template = templates.find(item => item.id === nextTemplateId)
    if (!template) {
      return
    }

    setName(template.title)
    setGoal(String(template.goal ?? '').trim())
    setNasmOptPhase(String(template.nasm_opt_phase ?? 1))
    setPhaseName(String(template.phase_name ?? 'Custom Phase').trim())
    setSessionsPerWeek(String(template.sessions_per_week ?? 3))
    setEstimatedDurationMins(String(template.estimated_duration_mins ?? 60))
    setDays(
      Array.isArray(template.template_json?.workouts) && template.template_json?.workouts.length > 0
        ? template.template_json.workouts.map((day, index) => toBuilderDay(day, index + 1))
        : [toBuilderDay(undefined, 1)]
    )
  }

  function updateDay(dayId: string, field: 'focus' | 'scheduledDate' | 'notes', value: string) {
    setDays(current => current.map(day => (day.id === dayId ? { ...day, [field]: value } : day)))
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
            if (!match) {
              return {
                ...nextExercise,
                libraryExerciseId: '',
                description: '',
                primaryEquipment: [],
                imageUrl: '',
                videoUrl: '',
              }
            }

            return {
              ...nextExercise,
              libraryExerciseId: match.id,
              description: String(match.description ?? '').trim(),
              primaryEquipment: Array.isArray(match.primary_equipment) ? match.primary_equipment.filter(Boolean) : [],
              imageUrl: String(match.media_image_url ?? '').trim(),
              videoUrl: String(match.media_video_url ?? '').trim(),
            }
          }),
        }
      })
    )
  }

  function addDay() {
    setDays(current => [...current, toBuilderDay(undefined, current.length + 1)])
  }

  function removeDay(dayId: string) {
    setDays(current => current.filter(day => day.id !== dayId).map((day, index) => ({ ...day, day: index + 1 })))
  }

  function addExercise(dayId: string) {
    setDays(current =>
      current.map(day => (day.id === dayId ? { ...day, exercises: [...day.exercises, createBlankExercise()] } : day))
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

      setStatus('Custom program saved for this client.')
      router.refresh()
    } catch {
      setStatus('Failed to save custom workout plan. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
        <label style={labelStyle}>
          Template
          <select value={templateId} onChange={event => applyTemplate(event.target.value)} style={inputStyle}>
            <option value="">Start from scratch</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {template.title}
              </option>
            ))}
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
              <button type="button" onClick={() => removeDay(day.id)} style={secondaryButtonStyle}>
                Remove Day
              </button>
            </div>

            <label style={{ ...labelStyle, marginBottom: 12 }}>
              Coach Notes
              <textarea value={day.notes} onChange={event => updateDay(day.id, 'notes', event.target.value)} style={{ ...inputStyle, minHeight: 72 }} placeholder="Session emphasis, regressions, intent" />
            </label>

            <div style={{ display: 'grid', gap: 12 }}>
              {day.exercises.map(exercise => (
                <div key={exercise.id} style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(18,35,54,0.9)', padding: 14 }}>
                  <div className="coach-program-exercise-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) repeat(4, minmax(90px, 1fr)) auto', gap: 10, alignItems: 'end' }}>
                    <label style={labelStyle}>
                      Exercise
                      <input
                        value={exercise.name}
                        onChange={event => updateExercise(day.id, exercise.id, 'name', event.target.value)}
                        list={exerciseListId}
                        style={inputStyle}
                        placeholder={exercises.length > 0 ? 'Search the imported library' : 'Enter exercise name'}
                      />
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
                    <button type="button" onClick={() => removeExercise(day.id, exercise.id)} style={secondaryButtonStyle}>
                      Remove
                    </button>
                  </div>

                  <label style={{ ...labelStyle, marginTop: 10 }}>
                    Exercise Notes
                    <input value={exercise.notes} onChange={event => updateExercise(day.id, exercise.id, 'notes', event.target.value)} style={inputStyle} placeholder="Coaching cue, modification, target RPE" />
                  </label>

                  {(exercise.description || exercise.primaryEquipment.length > 0 || exercise.imageUrl || exercise.videoUrl) && (
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
                        {exercise.description && (
                          <p style={{ margin: 0, color: 'var(--white)', fontSize: 13, lineHeight: 1.5 }}>{exercise.description}</p>
                        )}
                        {exercise.primaryEquipment.length > 0 && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                            {exercise.primaryEquipment.map(item => (
                              <span key={item} style={chipStyle}>{item}</span>
                            ))}
                          </div>
                        )}
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
          <button type="button" onClick={() => setDays(initialDaysFromPlan(latestPlan))} style={secondaryButtonStyle}>
            Reset To Latest Plan
          </button>
        </div>
        <button type="button" disabled={busy || validationMessages.length > 0} onClick={handleSubmit} style={primaryButtonStyle}>
          {busy ? 'Saving...' : 'Save Custom Program'}
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

const chipStyle: React.CSSProperties = {
  border: '1px solid rgba(212,160,23,0.22)',
  background: 'rgba(212,160,23,0.12)',
  color: 'var(--gold)',
  padding: '4px 8px',
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const videoLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  marginTop: 10,
  color: 'var(--gold-lt)',
  textDecoration: 'none',
  fontSize: 13,
}