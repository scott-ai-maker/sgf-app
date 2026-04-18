'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import WorkoutCalendarView from '@/components/fitness/WorkoutCalendarView'

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
}

interface FitnessTrackerClientProps {
  profile: FitnessProfile | null
  latestPlan: WorkoutPlanRecord | null
  logs: WorkoutLogRecord[]
  setLogs: WorkoutSetLogRecord[]
  latestAnalysis: BodyAnalysisRecord | null
}

function formatExerciseDescriptionLines(description: string | null | undefined) {
  const text = String(description ?? '').replace(/\r/g, '').trim()
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

export default function FitnessTrackerClient({ profile, latestPlan, logs, setLogs, latestAnalysis }: FitnessTrackerClientProps) {
  const [plan, setPlan] = useState<WorkoutPlanRecord | null>(latestPlan)
  const [logState, setSessionLogState] = useState({ sessionDate: new Date().toISOString().slice(0, 10), sessionTitle: '', exertionRpe: '7', notes: '' })
  const [setLogState, setSetLogState] = useState({
    sessionDate: new Date().toISOString().slice(0, 10),
    exerciseName: '',
    setNumber: '1',
    reps: '8',
    weight: '',
    restSeconds: '90',
    rpe: '7',
    rir: '2',
    isWarmup: false,
    notes: '',
  })
  const [localSetLogs, setLocalSetLogs] = useState<WorkoutSetLogRecord[]>(setLogs)
  const [bodyfatState, setBodyfatState] = useState({
    photoDataUrl: '',
    estimated: latestAnalysis?.estimated_bodyfat_percent ? String(latestAnalysis.estimated_bodyfat_percent) : '',
  })
  const [predictImageUrl, setPredictImageUrl] = useState('')
  const [beforePhotoUrl, setBeforePhotoUrl] = useState(profile?.before_photo_url || '')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

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
        }))
    }

    return planWorkouts
      .filter(workout => workout.scheduledDate)
      .map(workout => ({
        date: String(workout.scheduledDate),
        title: `Day ${workout.day}: ${workout.focus}`,
        subtitle: `${workout.exercises.length} exercise${workout.exercises.length === 1 ? '' : 's'}`,
      }))
  }, [plan, planWorkouts])

  const units = profile?.preferred_units === 'imperial' ? 'imperial' : 'metric'

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
    const avgRpe = localSetLogs.length
      ? localSetLogs.reduce((sum, row) => sum + Number(row.rpe ?? 0), 0) / localSetLogs.filter(row => Number(row.rpe ?? 0) > 0).length
      : 0

    return {
      points,
      totalSets,
      totalReps,
      totalVolumeKg: Math.round(totalVolumeKg),
      avgRpe: Number.isFinite(avgRpe) ? Math.round(avgRpe * 10) / 10 : 0,
    }
  }, [localSetLogs])

  async function handleLogSet(e: React.FormEvent) {
    e.preventDefault()
    setBusy('set-log')
    setStatus(null)

    const weightValue = Number(setLogState.weight)
    const weightKg = Number.isFinite(weightValue) && weightValue > 0
      ? (units === 'imperial' ? weightValue * 0.45359237 : weightValue)
      : undefined

    const res = await fetch('/api/workouts/log-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workoutPlanId: plan?.id,
        sessionDate: setLogState.sessionDate,
        exerciseName: setLogState.exerciseName,
        setNumber: Number(setLogState.setNumber),
        reps: Number(setLogState.reps),
        weightKg,
        restSeconds: Number(setLogState.restSeconds),
        rpe: Number(setLogState.rpe),
        rir: Number(setLogState.rir),
        isWarmup: setLogState.isWarmup,
        notes: setLogState.notes,
      }),
    })

    const payload = await res.json()
    setBusy(null)

    if (!res.ok) {
      setStatus(payload.error ?? 'Could not save set log')
      return
    }

    setLocalSetLogs(prev => [payload.setLog as WorkoutSetLogRecord, ...prev])
    setStatus('Set logged successfully.')
    setSetLogState(prev => ({ ...prev, exerciseName: '', notes: '' }))
  }

  async function handleLogWorkout(e: React.FormEvent) {
    e.preventDefault()
    setBusy('log')
    setStatus(null)

    const res = await fetch('/api/workouts/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workoutPlanId: plan?.id,
        sessionDate: logState.sessionDate,
        sessionTitle: logState.sessionTitle,
        exertionRpe: Number(logState.exertionRpe),
        notes: logState.notes,
        completed: true,
      }),
    })

    const payload = await res.json()
    setBusy(null)

    if (!res.ok) {
      setStatus(payload.error ?? 'Could not save workout log')
      return
    }

    setStatus('Workout logged.')
    setSessionLogState(prev => ({ ...prev, sessionTitle: '', notes: '' }))
  }

  async function handlePhotoUpload(file: File | null) {
    if (!file) return
    const base64 = await fileToDataUrl(file)
    setBodyfatState(prev => ({ ...prev, photoDataUrl: base64 }))
  }

  async function handleEstimateBodyfat() {
    if (!profile) {
      setStatus('Complete onboarding first.')
      return
    }

    setBusy('bodyfat')
    setStatus(null)

    const res = await fetch('/api/fitness/bodyfat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sex: profile.sex,
        heightCm: profile.height_cm,
        weightKg: profile.weight_kg,
        waistCm: profile.waist_cm,
        neckCm: profile.neck_cm,
        hipCm: profile.hip_cm,
        photoDataUrl: bodyfatState.photoDataUrl || undefined,
      }),
    })

    const payload = await res.json()
    setBusy(null)

    if (!res.ok) {
      setStatus(payload.error ?? 'Could not estimate body fat')
      return
    }

    setBodyfatState(prev => ({ ...prev, estimated: String(payload.analysis.estimated_bodyfat_percent) }))
    setStatus(`Estimated body fat: ${payload.analysis.estimated_bodyfat_percent}%`)
  }

  async function handlePredictLook() {
    if (!profile?.target_bodyfat_percent || !profile?.fitness_goal) {
      setStatus('Set target body fat and goal in onboarding to generate your prediction.')
      return
    }

    setBusy('predict')
    setStatus(null)

    const res = await fetch('/api/fitness/predict-look', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentBodyfatPercent: bodyfatState.estimated || profile.target_bodyfat_percent,
        targetBodyfatPercent: profile.target_bodyfat_percent,
        fitnessGoal: profile.fitness_goal,
      }),
    })

    const payload = await res.json()
    setBusy(null)

    if (!res.ok) {
      setStatus(payload.error ?? 'Could not generate goal prediction image')
      return
    }

    setPredictImageUrl(payload.imageUrl)
    if (payload.beforePhotoUrl) {
      setBeforePhotoUrl(payload.beforePhotoUrl)
    }
    setStatus('Goal prediction image generated.')
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
          <div style={{ fontSize: 22, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>{bodyfatState.estimated ? `${bodyfatState.estimated}%` : 'Unknown'}</div>
        </div>
      </div>

      <div className="fitness-main-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, alignItems: 'start' }}>
        <section style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18 }}>
          <div className="fitness-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 28 }}>Current Workout Plan</h2>
          </div>

          {planWorkouts.length === 0 ? (
            <p style={{ color: 'var(--gray)', margin: 0 }}>No plan generated yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {planWorkouts.map(workout => (
                <div key={workout.day} style={{ border: '1px solid var(--navy-lt)', padding: 12, background: 'var(--navy)' }}>
                  <h3 style={{ margin: '0 0 8px', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em', fontSize: 21 }}>
                    Day {workout.day}: {workout.focus}
                  </h3>
                  {workout.scheduledDate && (
                    <p style={{ margin: '0 0 10px', color: 'var(--gold)', fontSize: 13 }}>
                      Scheduled for {new Date(`${workout.scheduledDate}T12:00:00Z`).toLocaleDateString()}
                    </p>
                  )}
                  {workout.notes && (
                    <p style={{ margin: '0 0 12px', color: 'var(--gray)', fontSize: 13, lineHeight: 1.5 }}>{workout.notes}</p>
                  )}
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {workout.exercises.map(ex => (
                      <li key={`${workout.day}-${ex.name}`} style={{ marginBottom: 12 }}>
                        <div style={{ color: 'var(--white)', fontWeight: 600 }}>
                          {ex.name} - {ex.sets} sets x {ex.reps}
                          {ex.tempo ? ` · Tempo ${ex.tempo}` : ''}
                          {ex.rest ? ` · Rest ${ex.rest}` : ''}
                        </div>
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
                        {(ex.primaryEquipment?.length || ex.imageUrl || ex.videoUrl) && (
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
                              {ex.primaryEquipment && ex.primaryEquipment.length > 0 && (
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  {ex.primaryEquipment.map(item => (
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
                              )}
                              {ex.videoUrl && (
                                <a href={ex.videoUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', marginTop: 8, color: 'var(--gold-lt)', textDecoration: 'none', fontSize: 13 }}>
                                  Open exercise video
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18 }}>
          <h2 style={{ margin: '0 0 14px', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 28 }}>Log Session</h2>
          <form onSubmit={handleLogWorkout} style={{ display: 'grid', gap: 10 }}>
            <input type="date" value={logState.sessionDate} onChange={e => setSessionLogState(prev => ({ ...prev, sessionDate: e.target.value }))} style={inputStyle} required />
            <input type="text" value={logState.sessionTitle} onChange={e => setSessionLogState(prev => ({ ...prev, sessionTitle: e.target.value }))} style={inputStyle} placeholder="Upper Body Strength" required />
            <input type="number" min={1} max={10} value={logState.exertionRpe} onChange={e => setSessionLogState(prev => ({ ...prev, exertionRpe: e.target.value }))} style={inputStyle} placeholder="RPE 1-10" required />
            <textarea value={logState.notes} onChange={e => setSessionLogState(prev => ({ ...prev, notes: e.target.value }))} style={{ ...inputStyle, minHeight: 80 }} placeholder="Session notes" />
            <button type="submit" disabled={busy === 'log'} style={buttonStyle}>{busy === 'log' ? 'Saving...' : 'Save Log'}</button>
          </form>
        </section>
      </div>

      <div style={{ marginTop: 16 }}>
        <WorkoutCalendarView
          entries={planCalendarEntries}
          title="Workout Calendar"
          subtitle="Your coach can assign scheduled training dates for each session block."
        />
      </div>

      <div className="fitness-sub-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16, marginTop: 16 }}>
        <section style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18 }}>
          <h2 style={{ margin: '0 0 10px', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 28 }}>Progress Stats</h2>
          <div className="fitness-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(140px, 1fr))', gap: 10 }}>
            <Stat label="Total Sets" value={String(progression.totalSets)} />
            <Stat label="Total Reps" value={String(progression.totalReps)} />
            <Stat label={`Total Volume (${units === 'imperial' ? 'lb' : 'kg'})`} value={units === 'imperial' ? String(Math.round(progression.totalVolumeKg * 2.20462)) : String(progression.totalVolumeKg)} />
            <Stat label="Avg RPE" value={String(progression.avgRpe || '-')}
            />
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

        <section style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18 }}>
          <h2 style={{ margin: '0 0 14px', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 28 }}>Log Sets</h2>
          <form onSubmit={handleLogSet} style={{ display: 'grid', gap: 10 }}>
            <input type="date" value={setLogState.sessionDate} onChange={e => setSetLogState(prev => ({ ...prev, sessionDate: e.target.value }))} style={inputStyle} required />
            <input type="text" value={setLogState.exerciseName} onChange={e => setSetLogState(prev => ({ ...prev, exerciseName: e.target.value }))} style={inputStyle} placeholder="Exercise name" required />
            <div className="fitness-set-input-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input type="number" min={1} value={setLogState.setNumber} onChange={e => setSetLogState(prev => ({ ...prev, setNumber: e.target.value }))} style={inputStyle} placeholder="Set #" />
              <input type="number" min={1} value={setLogState.reps} onChange={e => setSetLogState(prev => ({ ...prev, reps: e.target.value }))} style={inputStyle} placeholder="Reps" required />
            </div>
            <div className="fitness-set-input-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input type="number" step="0.1" min={0} value={setLogState.weight} onChange={e => setSetLogState(prev => ({ ...prev, weight: e.target.value }))} style={inputStyle} placeholder={`Weight (${units === 'imperial' ? 'lb' : 'kg'})`} />
              <input type="number" min={0} value={setLogState.restSeconds} onChange={e => setSetLogState(prev => ({ ...prev, restSeconds: e.target.value }))} style={inputStyle} placeholder="Rest (sec)" />
            </div>
            <div className="fitness-set-input-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input type="number" step="0.1" min={1} max={10} value={setLogState.rpe} onChange={e => setSetLogState(prev => ({ ...prev, rpe: e.target.value }))} style={inputStyle} placeholder="RPE (1-10)" />
              <input type="number" step="0.1" min={0} max={6} value={setLogState.rir} onChange={e => setSetLogState(prev => ({ ...prev, rir: e.target.value }))} style={inputStyle} placeholder="RIR" />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gray)', fontSize: 13 }}>
              <input type="checkbox" checked={setLogState.isWarmup} onChange={e => setSetLogState(prev => ({ ...prev, isWarmup: e.target.checked }))} />
              Warm-up set
            </label>
            <textarea value={setLogState.notes} onChange={e => setSetLogState(prev => ({ ...prev, notes: e.target.value }))} style={{ ...inputStyle, minHeight: 70 }} placeholder="Tempo, setup cues, pain notes" />
            <button type="submit" disabled={busy === 'set-log'} style={buttonStyle}>{busy === 'set-log' ? 'Saving...' : 'Save Set'}</button>
          </form>
        </section>

        <section style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18 }}>
          <h2 style={{ margin: '0 0 10px', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 28 }}>Body Fat Check</h2>
          <p style={{ color: 'var(--gray)', marginTop: 0, fontSize: 14 }}>
            Upload or take a progress photo, then estimate body-fat percentage from your profile + circumference data.
          </p>
          <input type="file" accept="image/*" capture="user" onChange={e => handlePhotoUpload(e.target.files?.[0] ?? null)} />
          <div style={{ marginTop: 12 }}>
            <button onClick={handleEstimateBodyfat} disabled={busy === 'bodyfat'} style={buttonStyle}>
              {busy === 'bodyfat' ? 'Estimating...' : 'Estimate Body Fat'}
            </button>
          </div>
        </section>

        <section style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18 }}>
          <h2 style={{ margin: '0 0 10px', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 28 }}>Goal Prediction</h2>
          <p style={{ color: 'var(--gray)', marginTop: 0, fontSize: 14 }}>
            Generate a projection image of your expected physique after achieving your goal. {beforePhotoUrl ? '(Upload a new photo in onboarding to regenerate)' : 'Upload a before photo to get started.'}
          </p>
          <button onClick={handlePredictLook} disabled={busy === 'predict'} style={buttonStyle}>
            {busy === 'predict' ? 'Generating...' : 'Predict My Look'}
          </button>
          {(beforePhotoUrl || predictImageUrl) && (
            <div style={{ display: 'grid', gridTemplateColumns: beforePhotoUrl && predictImageUrl ? '1fr 1fr' : '1fr', gap: 16, marginTop: 12 }}>
              {beforePhotoUrl && (
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--gold)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Before</p>
                  <Image
                    src={beforePhotoUrl}
                    alt="Before photo"
                    width={320}
                    height={426}
                    unoptimized
                    style={{ width: '100%', maxWidth: 320, border: '1px solid var(--navy-lt)', height: 'auto' }}
                  />
                </div>
              )}
              {predictImageUrl && (
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--gold)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>After (Predicted)</p>
                  <Image
                    src={predictImageUrl}
                    alt="Predicted transformation"
                    width={320}
                    height={426}
                    unoptimized
                    style={{ width: '100%', maxWidth: 320, border: '1px solid var(--navy-lt)', height: 'auto' }}
                  />
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {status && <p style={{ marginTop: 14, color: status.toLowerCase().includes('could') ? 'var(--error)' : 'var(--success)' }}>{status}</p>}

      {logs.length > 0 && (
        <section style={{ marginTop: 18, border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18 }}>
          <h2 style={{ margin: '0 0 10px', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 28 }}>Recent Logs</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {logs.map(log => (
              <div key={String(log.id)} style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy)', padding: 10 }}>
                <div style={{ fontWeight: 600 }}>{String(log.session_title)}</div>
                <div style={{ color: 'var(--gray)', fontSize: 13, overflowWrap: 'anywhere' }}>{String(log.session_date)} | RPE {String(log.exertion_rpe ?? '-')}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {localSetLogs.length > 0 && (
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

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}
