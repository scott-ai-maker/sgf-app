'use client'

import { useState, useEffect, useCallback } from 'react'

interface WeeklyCheckin {
  id: string
  week_start: string
  sleep_quality: number | null
  stress_level: number | null
  soreness_level: number | null
  energy_level: number | null
  weight_kg: number | null
  notes: string | null
  coach_feedback: string | null
  coach_rating_adjustment: number | null
}

interface WeeklyCheckinFormProps {
  preferredUnits?: 'metric' | 'imperial'
}

function getMonday(date: Date): string {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

function RatingInput({
  label,
  hint,
  descriptions,
  value,
  onChange,
}: {
  label: string
  hint: string
  descriptions: Record<string, string>
  value: string
  onChange: (v: string) => void
}) {
  const options = ['1', '2', '3', '4', '5']
  const inputId = `rating-${label.toLowerCase().replace(/\s+/g, '-')}`
  const selectedDescription = value ? descriptions[value] : null

  return (
    <div>
      <label htmlFor={inputId} style={{ display: 'block', fontFamily: 'Raleway, sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray)', marginBottom: 6 }}>
        {label} (1-5)
      </label>
      <p style={{ margin: '0 0 8px', color: 'var(--gray)', fontSize: 12 }}>{hint}</p>
      <div style={{ display: 'flex', gap: 8 }} role="group" aria-labelledby={inputId}>
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(value === opt ? '' : opt)}
            aria-pressed={value === opt}
            aria-label={`${descriptions[opt]} (${label})`}
            style={{
              flex: 1,
              padding: '10px 0',
              border: `1px solid ${value === opt ? 'var(--gold)' : 'var(--navy-lt)'}`,
              background: value === opt ? 'rgba(212,160,23,0.18)' : 'var(--navy-mid)',
              color: value === opt ? 'var(--gold)' : 'var(--gray)',
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 18,
              cursor: 'pointer',
            }}
          >
            {opt}
          </button>
        ))}
      </div>
      <p style={{ margin: '6px 0 0', color: 'var(--gray)', fontSize: 12 }}>
        {selectedDescription ? `Selected: ${value} - ${selectedDescription}` : 'Select a number, or tap again to clear.'}
      </p>
    </div>
  )
}

export default function WeeklyCheckinForm({ preferredUnits = 'imperial' }: WeeklyCheckinFormProps) {
  const thisWeek = getMonday(new Date())
  const [existing, setExisting] = useState<WeeklyCheckin | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    sleep_quality: '',
    stress_level: '',
    soreness_level: '',
    energy_level: '',
    weight: '',
    notes: '',
  })

  const load = useCallback(async () => {
    const res = await fetch('/api/fitness/checkin')
    const payload = await res.json().catch(() => ({}))
    if (res.ok && Array.isArray(payload.checkins)) {
      const thisWeekCheckin = payload.checkins.find((c: WeeklyCheckin) => c.week_start === thisWeek)
      if (thisWeekCheckin) {
        setExisting(thisWeekCheckin)
        setForm({
          sleep_quality: thisWeekCheckin.sleep_quality ? String(thisWeekCheckin.sleep_quality) : '',
          stress_level: thisWeekCheckin.stress_level ? String(thisWeekCheckin.stress_level) : '',
          soreness_level: thisWeekCheckin.soreness_level ? String(thisWeekCheckin.soreness_level) : '',
          energy_level: thisWeekCheckin.energy_level ? String(thisWeekCheckin.energy_level) : '',
          weight: thisWeekCheckin.weight_kg
            ? preferredUnits === 'imperial'
              ? String(Math.round(thisWeekCheckin.weight_kg * 2.20462 * 10) / 10)
              : String(thisWeekCheckin.weight_kg)
            : '',
          notes: thisWeekCheckin.notes ?? '',
        })
      }
    }
    setLoaded(true)
  }, [thisWeek, preferredUnits])

  useEffect(() => { void load() }, [load])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    const weightKg = form.weight
      ? preferredUnits === 'imperial'
        ? Math.round(Number(form.weight) * 0.453592 * 100) / 100
        : Number(form.weight)
      : undefined

    const res = await fetch('/api/fitness/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        week_start: thisWeek,
        sleep_quality: form.sleep_quality ? Number(form.sleep_quality) : null,
        stress_level: form.stress_level ? Number(form.stress_level) : null,
        soreness_level: form.soreness_level ? Number(form.soreness_level) : null,
        energy_level: form.energy_level ? Number(form.energy_level) : null,
        weight_kg: weightKg ?? null,
        notes: form.notes || null,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to save check-in')
    } else {
      setSaved(true)
      const data = await res.json()
      setExisting(data)
    }
    setSaving(false)
  }

  if (!loaded) {
    return <p style={{ color: 'var(--gray)', fontSize: 14 }}>Loading...</p>
  }

  const sleepDescriptions: Record<string, string> = {
    '1': 'Very poor sleep quality',
    '2': 'Poor sleep quality',
    '3': 'Average sleep quality',
    '4': 'Good sleep quality',
    '5': 'Excellent sleep quality',
  }

  const stressDescriptions: Record<string, string> = {
    '1': 'Very high stress',
    '2': 'High stress',
    '3': 'Moderate stress',
    '4': 'Low stress',
    '5': 'Very low stress',
  }

  const sorenessDescriptions: Record<string, string> = {
    '1': 'Very sore',
    '2': 'Sore',
    '3': 'Moderately sore',
    '4': 'Light soreness',
    '5': 'Fresh / recovered',
  }

  const energyDescriptions: Record<string, string> = {
    '1': 'Very low energy',
    '2': 'Low energy',
    '3': 'Moderate energy',
    '4': 'High energy',
    '5': 'Very high energy',
  }

  const weekLabel = new Date(`${thisWeek}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18 }}>
      <h3 style={{ margin: '0 0 4px', fontFamily: 'Bebas Neue, sans-serif', fontSize: 22, letterSpacing: '0.06em', color: 'var(--gold)' }}>
        Weekly Check-In
      </h3>
      <p style={{ margin: '0 0 14px', color: 'var(--gray)', fontSize: 13 }}>
        Week of {weekLabel} · {existing ? 'Update your check-in' : 'How are you feeling this week?'}
      </p>

      {existing?.coach_feedback && (
        <div style={{ padding: '10px 14px', border: '1px solid rgba(212,160,23,0.3)', background: 'rgba(212,160,23,0.07)', marginBottom: 14 }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 700 }}>Coach Feedback</p>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--white)', lineHeight: 1.5 }}>{existing.coach_feedback}</p>
        </div>
      )}

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
        <p style={{ margin: '-4px 0 0', color: 'var(--gray)', fontSize: 12, lineHeight: 1.45 }}>
          If you already submitted this week, your previous values are pre-filled below. Update each number to reflect how this week feels now.
        </p>
        <RatingInput label="Sleep Quality" hint="1 = poor sleep, 5 = excellent sleep" descriptions={sleepDescriptions} value={form.sleep_quality} onChange={v => setForm(p => ({ ...p, sleep_quality: v }))} />
        <RatingInput label="Stress Level" hint="1 = very high stress, 5 = very low stress" descriptions={stressDescriptions} value={form.stress_level} onChange={v => setForm(p => ({ ...p, stress_level: v }))} />
        <RatingInput label="Soreness" hint="1 = very sore, 5 = fresh" descriptions={sorenessDescriptions} value={form.soreness_level} onChange={v => setForm(p => ({ ...p, soreness_level: v }))} />
        <RatingInput label="Energy Level" hint="1 = low energy, 5 = high energy" descriptions={energyDescriptions} value={form.energy_level} onChange={v => setForm(p => ({ ...p, energy_level: v }))} />

        <div>
          <label htmlFor="weight-input" style={{ display: 'block', fontFamily: 'Raleway, sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray)', marginBottom: 6 }}>
            Current Weight ({preferredUnits === 'imperial' ? 'lb' : 'kg'}) — optional
          </label>
          <input
            id="weight-input"
            type="number"
            step="0.1"
            min={0}
            value={form.weight}
            onChange={e => setForm(p => ({ ...p, weight: e.target.value }))}
            className="sgf-form-input"
            placeholder={preferredUnits === 'imperial' ? 'e.g. 185' : 'e.g. 84.0'}
            aria-describedby="weight-hint"
          />
          <p id="weight-hint" style={{ margin: '4px 0 0', color: 'var(--gray)', fontSize: 12 }}>
            Track your current weight to monitor progress
          </p>
        </div>

        <div>
          <label htmlFor="notes-input" style={{ display: 'block', fontFamily: 'Raleway, sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gray)', marginBottom: 6 }}>
            Notes — optional
          </label>
          <textarea
            id="notes-input"
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            className="sgf-form-input"
            style={{ minHeight: 72 }}
            placeholder="How did training feel this week? Any wins, struggles, or things your coach should know?"
            aria-describedby="notes-hint"
          />
          <p id="notes-hint" style={{ margin: '4px 0 0', color: 'var(--gray)', fontSize: 12 }}>
            Share relevant observations with your coach for better feedback
          </p>
        </div>

        {error && <p role="alert" style={{ margin: 0, color: 'var(--error)', fontSize: 13 }}>{error}</p>}
        {saved && <p role="status" style={{ margin: 0, color: 'var(--success)', fontSize: 13 }}>Check-in saved ✓</p>}

        <button
          type="submit"
          disabled={saving}
          aria-label={existing ? 'Update check-in' : 'Submit check-in'}
          aria-busy={saving}
          style={{
            border: 0,
            background: saving ? 'var(--navy-lt)' : 'var(--gold)',
            color: '#0D1B2A',
            padding: '12px 20px',
            fontFamily: 'Bebas Neue, sans-serif',
            letterSpacing: '0.08em',
            fontSize: 17,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : existing ? 'Update Check-In' : 'Submit Check-In'}
        </button>
      </form>
    </div>
  )
}
