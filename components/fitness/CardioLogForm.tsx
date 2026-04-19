'use client'

import { useState } from 'react'

const CARDIO_ACTIVITY_OPTIONS = [
  { key: 'treadmill', label: 'Treadmill' },
  { key: 'stationary-bike', label: 'Stationary Bike' },
  { key: 'rowing-machine', label: 'Rowing Machine' },
  { key: 'elliptical', label: 'Elliptical' },
  { key: 'stairmaster', label: 'Stairmaster' },
  { key: 'assault-bike', label: 'Assault / Air Bike' },
  { key: 'ski-erg', label: 'Ski Erg' },
  { key: 'jump-rope', label: 'Jump Rope' },
  { key: 'outdoor-running', label: 'Outdoor Running' },
  { key: 'outdoor-cycling', label: 'Outdoor Cycling' },
  { key: 'swimming', label: 'Swimming' },
  { key: 'hiking', label: 'Hiking' },
  { key: 'other', label: 'Other' },
]

interface CardioLog {
  id: string
  session_date: string
  activity_type: string
  duration_mins: number
  distance_km?: number | null
  avg_heart_rate?: number | null
  calories?: number | null
  perceived_effort?: number | null
  notes?: string | null
}

interface CardioLogFormProps {
  initialLogs: CardioLog[]
  preferredUnits?: 'metric' | 'imperial'
}

export default function CardioLogForm({ initialLogs, preferredUnits = 'imperial' }: CardioLogFormProps) {
  const [logs, setLogs] = useState<CardioLog[]>(initialLogs)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    session_date: today,
    activity_type: 'outdoor-running',
    duration_mins: '',
    distance: '',
    avg_heart_rate: '',
    calories: '',
    perceived_effort: '',
    notes: '',
  })

  const isImperial = preferredUnits === 'imperial'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const distanceKm = form.distance
      ? isImperial
        ? Math.round(Number(form.distance) * 1.60934 * 1000) / 1000
        : Number(form.distance)
      : undefined

    const res = await fetch('/api/fitness/cardio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_date: form.session_date,
        activity_type: form.activity_type,
        duration_mins: Number(form.duration_mins),
        distance_km: distanceKm || null,
        avg_heart_rate: form.avg_heart_rate ? Number(form.avg_heart_rate) : null,
        calories: form.calories ? Number(form.calories) : null,
        perceived_effort: form.perceived_effort ? Number(form.perceived_effort) : null,
        notes: form.notes || null,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to log session')
    } else {
      const data = await res.json()
      setLogs(prev => [data, ...prev])
      setForm({ session_date: today, activity_type: 'outdoor-running', duration_mins: '', distance: '', avg_heart_rate: '', calories: '', perceived_effort: '', notes: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    background: 'var(--navy)',
    border: '1px solid var(--navy-lt)',
    color: 'var(--white)',
    fontFamily: 'Raleway, sans-serif',
    fontSize: 14,
    boxSizing: 'border-box',
  }

  return (
    <div style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontFamily: 'Bebas Neue, sans-serif', fontSize: 22, letterSpacing: '0.06em', color: 'var(--gold)' }}>
          Cardio Log
        </h3>
        <button
          type="button"
          onClick={() => setShowForm(p => !p)}
          style={{ padding: '6px 14px', background: 'var(--gold)', color: '#0D1B2A', border: 'none', fontFamily: 'Bebas Neue, sans-serif', fontSize: 14, letterSpacing: '0.06em', cursor: 'pointer' }}
        >
          {showForm ? 'Cancel' : '+ Log Cardio'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10, marginBottom: 16, border: '1px solid rgba(255,255,255,0.08)', padding: 12, background: 'rgba(13,27,42,0.55)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Date</label>
              <input type="date" value={form.session_date} onChange={e => setForm(p => ({ ...p, session_date: e.target.value }))} style={inputStyle} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Activity</label>
              <select value={form.activity_type} onChange={e => setForm(p => ({ ...p, activity_type: e.target.value }))} style={inputStyle}>
                {CARDIO_ACTIVITY_OPTIONS.map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Duration (min)</label>
              <input type="number" min={1} value={form.duration_mins} onChange={e => setForm(p => ({ ...p, duration_mins: e.target.value }))} style={inputStyle} required placeholder="30" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Distance ({isImperial ? 'mi' : 'km'})
              </label>
              <input type="number" step="0.01" min={0} value={form.distance} onChange={e => setForm(p => ({ ...p, distance: e.target.value }))} style={inputStyle} placeholder="3.1" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Avg HR (bpm)</label>
              <input type="number" min={0} value={form.avg_heart_rate} onChange={e => setForm(p => ({ ...p, avg_heart_rate: e.target.value }))} style={inputStyle} placeholder="145" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Calories</label>
              <input type="number" min={0} value={form.calories} onChange={e => setForm(p => ({ ...p, calories: e.target.value }))} style={inputStyle} placeholder="320" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Effort (1–10)</label>
              <input type="number" min={1} max={10} value={form.perceived_effort} onChange={e => setForm(p => ({ ...p, perceived_effort: e.target.value }))} style={inputStyle} placeholder="7" />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} placeholder="How did it feel?" />
          </div>

          {error && <p style={{ margin: 0, color: 'var(--error)', fontSize: 13 }}>{error}</p>}

          <button type="submit" disabled={saving} style={{ padding: '10px 0', background: saving ? 'var(--navy-lt)' : 'var(--gold)', color: '#0D1B2A', border: 'none', fontFamily: 'Bebas Neue, sans-serif', fontSize: 16, letterSpacing: '0.06em', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : 'Log Cardio Session'}
          </button>
        </form>
      )}

      {logs.length === 0 ? (
        <p style={{ color: 'var(--gray)', fontSize: 14, margin: 0 }}>No cardio sessions logged yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {logs.slice(0, 10).map(log => {
            const actLabel = CARDIO_ACTIVITY_OPTIONS.find(o => o.key === log.activity_type)?.label ?? log.activity_type
            const distDisplay = log.distance_km
              ? isImperial
                ? `${Math.round(log.distance_km / 1.60934 * 100) / 100} mi`
                : `${log.distance_km} km`
              : null

            return (
              <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <span style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--white)' }}>{actLabel}</span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--gray)' }}>
                    {new Date(`${log.session_date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--gray)', flexWrap: 'wrap' }}>
                  <span>{log.duration_mins} min</span>
                  {distDisplay && <span>{distDisplay}</span>}
                  {log.avg_heart_rate && <span>{log.avg_heart_rate} bpm</span>}
                  {log.perceived_effort && <span>RPE {log.perceived_effort}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
