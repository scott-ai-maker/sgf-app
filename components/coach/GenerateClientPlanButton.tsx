'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface GenerateClientPlanButtonProps {
  clientId: string
  initialEquipmentAccess?: string[]
}

const PHASE_OPTIONS = [
  { value: '1', label: 'Phase 1 - Stabilization Endurance' },
  { value: '2', label: 'Phase 2 - Strength Endurance' },
  { value: '3', label: 'Phase 3 - Muscular Development' },
  { value: '4', label: 'Phase 4 - Maximal Strength' },
  { value: '5', label: 'Phase 5 - Power' },
]

const EQUIPMENT_OPTIONS = [
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'bench', label: 'Bench' },
  { value: 'cable-machine', label: 'Cable Machine' },
  { value: 'machines', label: 'Machines' },
  { value: 'kettlebells', label: 'Kettlebells' },
  { value: 'bands', label: 'Bands' },
  { value: 'trx', label: 'TRX' },
  { value: 'medicine-ball', label: 'Medicine Ball' },
]

export default function GenerateClientPlanButton({ clientId, initialEquipmentAccess = [] }: GenerateClientPlanButtonProps) {
  const router = useRouter()
  const [sessionsPerWeek, setSessionsPerWeek] = useState('4')
  const [nasmOptPhase, setNasmOptPhase] = useState('1')
  const [equipmentAccess, setEquipmentAccess] = useState<string[]>(() => {
    const normalized = [...new Set(initialEquipmentAccess.map(item => String(item).trim().toLowerCase()).filter(Boolean))]
    if (!normalized.includes('bodyweight')) normalized.unshift('bodyweight')
    return normalized
  })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  function toggleEquipment(value: string) {
    setEquipmentAccess(current => {
      if (value === 'bodyweight') return current
      if (current.includes(value)) return current.filter(item => item !== value)
      return [...current, value]
    })
  }

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
        equipmentAccess,
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
    router.refresh()
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

      <div style={{ display: 'grid', gap: 8, width: '100%', minWidth: 240 }}>
        <span style={{ fontFamily: 'Raleway, sans-serif', color: 'var(--gray)', fontSize: 13 }}>
          Equipment (bodyweight always included)
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {EQUIPMENT_OPTIONS.map(option => {
            const active = equipmentAccess.includes(option.value)
            const locked = option.value === 'bodyweight'

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleEquipment(option.value)}
                disabled={locked}
                style={{
                  border: active ? '1px solid rgba(212,160,23,0.5)' : '1px solid rgba(255,255,255,0.12)',
                  background: active ? 'rgba(212,160,23,0.14)' : 'var(--navy-mid)',
                  color: active ? 'var(--gold-lt)' : 'var(--white)',
                  padding: '6px 10px',
                  fontSize: 12,
                  cursor: locked ? 'default' : 'pointer',
                  opacity: locked ? 0.8 : 1,
                }}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

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
