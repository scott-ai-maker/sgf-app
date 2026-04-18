'use client'

import { useState } from 'react'

interface GenerateClientPlanButtonProps {
  clientId: string
}

const PHASE_OPTIONS = [
  { value: '1', label: 'Phase 1 - Stabilization Endurance' },
  { value: '2', label: 'Phase 2 - Strength Endurance' },
  { value: '3', label: 'Phase 3 - Muscular Development' },
  { value: '4', label: 'Phase 4 - Maximal Strength' },
  { value: '5', label: 'Phase 5 - Power' },
]

export default function GenerateClientPlanButton({ clientId }: GenerateClientPlanButtonProps) {
  const [sessionsPerWeek, setSessionsPerWeek] = useState('4')
  const [nasmOptPhase, setNasmOptPhase] = useState('1')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function handleGenerate() {
    setBusy(true)
    setStatus(null)

    const res = await fetch('/api/coach/workouts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        sessionsPerWeek: Number(sessionsPerWeek),
        nasmOptPhase: Number(nasmOptPhase),
      }),
    })

    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      setStatus(payload.error ?? 'Failed to generate plan')
      setBusy(false)
      return
    }

    const templateTitle = String(payload?.template?.title ?? '').trim()
    const selectedPhase = PHASE_OPTIONS.find(option => option.value === nasmOptPhase)?.label ?? `Phase ${nasmOptPhase}`
    setStatus(templateTitle
      ? `Workout plan generated for ${selectedPhase} using ${templateTitle}.`
      : 'Workout plan generated for client successfully.')
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <label style={{ fontFamily: 'Raleway, sans-serif', color: 'var(--gray)', fontSize: 13 }}>
        Phase
      </label>
      <select
        value={nasmOptPhase}
        onChange={e => setNasmOptPhase(e.target.value)}
        style={{
          minWidth: 220,
          padding: '8px 10px',
          border: '1px solid var(--navy-lt)',
          background: 'var(--navy-mid)',
          color: 'var(--white)',
          fontFamily: 'Raleway, sans-serif',
        }}
      >
        {PHASE_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label style={{ fontFamily: 'Raleway, sans-serif', color: 'var(--gray)', fontSize: 13 }}>
        Sessions/week
      </label>
      <input
        value={sessionsPerWeek}
        onChange={e => setSessionsPerWeek(e.target.value)}
        type="number"
        min={2}
        max={7}
        style={{
          width: 90,
          padding: '8px 10px',
          border: '1px solid var(--navy-lt)',
          background: 'var(--navy-mid)',
          color: 'var(--white)',
          fontFamily: 'Raleway, sans-serif',
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={handleGenerate}
        style={{
          border: 0,
          background: busy ? 'var(--navy-lt)' : 'var(--gold)',
          color: '#0D1B2A',
          padding: '10px 14px',
          fontFamily: 'Bebas Neue, sans-serif',
          letterSpacing: '0.08em',
          fontSize: 18,
          cursor: busy ? 'not-allowed' : 'pointer',
        }}
      >
        {busy ? 'Generating...' : 'Quick Generate Plan'}
      </button>

      {status && (
        <span style={{ fontFamily: 'Raleway, sans-serif', color: status.includes('Failed') ? 'var(--error)' : 'var(--success)', fontSize: 13 }}>
          {status}
        </span>
      )}
    </div>
  )
}
