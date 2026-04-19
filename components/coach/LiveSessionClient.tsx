'use client'

import { useState, useCallback } from 'react'

interface Exercise {
  name: string
  sets: string
  reps: string
  rest?: string | null
  notes?: string | null
}

interface Workout {
  day: number
  focus: string
  exercises: Exercise[]
}

interface Plan {
  id: string
  name: string
  plan_json: { workouts?: Workout[] } | null
}

interface SetLog {
  id: string
  exercise_name: string
  set_number?: number | null
  reps: number
  weight_kg?: number | null
  rpe?: number | null
}

interface LiveSessionClientProps {
  clientId: string
  plan: Plan | null
  initialSets: SetLog[]
  today: string
}

function parseSetTarget(value: string | null | undefined): number {
  const text = String(value ?? '').trim()
  const match = text.match(/\d+/)
  return match ? Number(match[0]) : 0
}

function parseLowerReps(value: string | null | undefined): string {
  const text = String(value ?? '').trim()
  const rangeMatch = text.match(/(\d+)\s*[-–]+\s*(\d+)/)
  if (rangeMatch) return rangeMatch[1]
  const match = text.match(/\d+/)
  return match ? match[0] : '8'
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  background: 'var(--navy)',
  border: '1px solid var(--navy-lt)',
  color: 'var(--white)',
  fontFamily: 'Raleway, sans-serif',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
}

export default function LiveSessionClient({ clientId, plan, initialSets, today }: LiveSessionClientProps) {
  const workouts: Workout[] = plan?.plan_json?.workouts ?? []
  const [selectedDay, setSelectedDay] = useState<number>(workouts[0]?.day ?? 1)
  const [sets, setSets] = useState<SetLog[]>(initialSets)
  const [drafts, setDrafts] = useState<Record<string, { reps: string; weight: string; rpe: string; isWarmup: boolean }>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const currentWorkout = workouts.find(w => w.day === selectedDay)

  const setsForExercise = useCallback((exerciseName: string) => {
    return sets.filter(s => s.exercise_name.trim().toLowerCase() === exerciseName.trim().toLowerCase())
  }, [sets])

  function getDraft(exName: string, ex: Exercise) {
    return drafts[exName] ?? {
      reps: parseLowerReps(ex.reps),
      weight: '',
      rpe: '7',
      isWarmup: false,
    }
  }

  async function logSet(ex: Exercise) {
    const key = ex.name.trim().toLowerCase()
    const draft = getDraft(key, ex)
    const existingSets = setsForExercise(ex.name).filter(s => !s.rpe || true)
    const setNum = existingSets.length + 1

    setSaving(key)
    const res = await fetch(`/api/coach/clients/${clientId}/live-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_date: today,
        exercise_name: ex.name,
        set_number: setNum,
        reps: Number(draft.reps),
        weight_kg: draft.weight ? Number(draft.weight) : null,
        rpe: draft.rpe ? Number(draft.rpe) : null,
        is_warmup: draft.isWarmup,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      setSets(prev => [...prev, data])
      // Reset draft for next set
      setDrafts(prev => ({ ...prev, [key]: { ...draft, isWarmup: false } }))
    }
    setSaving(null)
  }

  if (!plan) {
    return (
      <div style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 24, textAlign: 'center' }}>
        <p style={{ color: 'var(--gray)', margin: 0 }}>No active workout plan for this client. Generate one first.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Day selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {workouts.map(w => (
          <button
            key={w.day}
            type="button"
            onClick={() => setSelectedDay(w.day)}
            style={{
              padding: '8px 14px',
              border: `1px solid ${selectedDay === w.day ? 'rgba(212,160,23,0.45)' : 'var(--navy-lt)'}`,
              background: selectedDay === w.day ? 'rgba(212,160,23,0.12)' : 'var(--navy-mid)',
              color: selectedDay === w.day ? 'var(--gold)' : 'var(--white)',
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 15,
              cursor: 'pointer',
              letterSpacing: '0.06em',
            }}
          >
            Day {w.day}: {w.focus}
          </button>
        ))}
      </div>

      {/* Session summary */}
      {sets.length > 0 && (
        <div style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: '10px 14px' }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Today&apos;s Session — {sets.length} set{sets.length !== 1 ? 's' : ''} logged
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(
              sets.reduce<Record<string, number>>((acc, s) => {
                acc[s.exercise_name] = (acc[s.exercise_name] ?? 0) + 1
                return acc
              }, {})
            ).map(([name, count]) => (
              <span key={name} style={{ fontSize: 12, padding: '2px 8px', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--white)' }}>
                {name}: {count} set{count !== 1 ? 's' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Exercises */}
      {currentWorkout && (
        <div style={{ display: 'grid', gap: 10 }}>
          {currentWorkout.exercises.map(ex => {
            const key = ex.name.trim().toLowerCase()
            const draft = getDraft(key, ex)
            const logged = setsForExercise(ex.name)
            const target = parseSetTarget(ex.sets)
            const done = logged.length >= target && target > 0

            return (
              <div key={ex.name} style={{ border: `1px solid ${done ? 'rgba(72,187,120,0.35)' : 'var(--navy-lt)'}`, background: done ? 'rgba(72,187,120,0.05)' : 'var(--navy-mid)', padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontFamily: 'Raleway, sans-serif', fontWeight: 700, fontSize: 15, color: done ? 'var(--success)' : 'var(--white)' }}>
                      {done ? '✓ ' : ''}{ex.name}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--gray)' }}>
                      {ex.sets} sets × {ex.reps}{ex.rest ? ` · Rest ${ex.rest}` : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: 12, padding: '2px 10px', border: `1px solid ${done ? 'rgba(72,187,120,0.5)' : 'rgba(255,255,255,0.15)'}`, color: done ? 'var(--success)' : 'var(--gray)' }}>
                    {logged.length}/{target > 0 ? target : '?'} sets
                  </span>
                </div>

                {/* Logged sets mini-table */}
                {logged.length > 0 && (
                  <div style={{ marginBottom: 8, display: 'grid', gap: 3 }}>
                    {logged.map((s, i) => (
                      <div key={s.id} style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--gray)', padding: '3px 0' }}>
                        <span style={{ color: 'var(--gold-lt)', minWidth: 48 }}>Set {s.set_number ?? i + 1}</span>
                        <span>{s.reps} reps</span>
                        {s.weight_kg && <span>{s.weight_kg} kg</span>}
                        {s.rpe && <span>RPE {s.rpe}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {!done && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: 6, alignItems: 'end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Reps</label>
                      <input
                        type="number"
                        min={1}
                        value={draft.reps}
                        onChange={e => setDrafts(prev => ({ ...prev, [key]: { ...draft, reps: e.target.value } }))}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Weight (kg)</label>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        value={draft.weight}
                        onChange={e => setDrafts(prev => ({ ...prev, [key]: { ...draft, weight: e.target.value } }))}
                        style={inputStyle}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>RPE</label>
                      <input
                        type="number"
                        step="0.5"
                        min={1}
                        max={10}
                        value={draft.rpe}
                        onChange={e => setDrafts(prev => ({ ...prev, [key]: { ...draft, rpe: e.target.value } }))}
                        style={inputStyle}
                      />
                    </div>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--gray)', textTransform: 'uppercase', cursor: 'pointer', paddingBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={draft.isWarmup}
                        onChange={e => setDrafts(prev => ({ ...prev, [key]: { ...draft, isWarmup: e.target.checked } }))}
                      />
                      Warmup
                    </label>
                    <button
                      type="button"
                      onClick={() => void logSet(ex)}
                      disabled={saving === key}
                      style={{ padding: '8px 14px', background: 'var(--gold)', color: '#0D1B2A', border: 'none', fontFamily: 'Bebas Neue, sans-serif', fontSize: 14, letterSpacing: '0.06em', cursor: saving === key ? 'not-allowed' : 'pointer', alignSelf: 'end', height: 38, whiteSpace: 'nowrap' }}
                    >
                      {saving === key ? '...' : 'Log Set'}
                    </button>
                  </div>
                )}

                {ex.notes && <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--gold)' }}>Note: {ex.notes}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
