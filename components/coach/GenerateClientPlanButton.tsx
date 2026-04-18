'use client'

import { useMemo, useState } from 'react'
import type { CoachProgramDraft } from '@/lib/coach-programs'

interface GenerateClientPlanButtonProps {
  clientId: string
  initialEquipmentAccess?: string[]
  libraryEquipmentNames?: string[]
  onDraftGenerated?: (draft: CoachProgramDraft) => void
}

const PHASE_OPTIONS = [
  { value: '1', label: 'Phase 1 - Stabilization Endurance' },
  { value: '2', label: 'Phase 2 - Strength Endurance' },
  { value: '3', label: 'Phase 3 - Muscular Development' },
  { value: '4', label: 'Phase 4 - Maximal Strength' },
  { value: '5', label: 'Phase 5 - Power' },
]

interface EquipmentOption {
  value: string
  label: string
  profileValue: string | null
  locked?: boolean
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function toEquipmentProfileValue(name: string): string | null {
  const normalized = normalizeText(name)

  if (!normalized || normalized === 'none') return null
  if (normalized.includes('body weight') || normalized.includes('bodyweight')) return 'bodyweight'
  if (normalized.includes('dumbbell')) return 'dumbbells'
  if (normalized.includes('barbell')) return 'barbell'
  if (normalized.includes('bench')) return 'bench'
  if (normalized.includes('cable')) return 'cable-machine'
  if (normalized.includes('machine') || normalized.includes('smith') || normalized.includes('lever') || normalized.includes('press')) return 'machines'
  if (normalized.includes('kettlebell')) return 'kettlebells'
  if (normalized.includes('band') || normalized.includes('tube') || normalized.includes('strap')) return 'bands'
  if (normalized.includes('trx') || normalized.includes('suspension')) return 'trx'
  if (normalized.includes('medicine ball') || normalized.includes('stability ball')) return 'medicine-ball'
  if (normalized.includes('pull-up bar')) return 'bodyweight'

  return null
}

export default function GenerateClientPlanButton({
  clientId,
  initialEquipmentAccess = [],
  libraryEquipmentNames = [],
  onDraftGenerated,
}: GenerateClientPlanButtonProps) {
  const availableEquipmentOptions = useMemo<EquipmentOption[]>(() => {
    const names = [...new Set(libraryEquipmentNames.map(item => String(item ?? '').trim()).filter(Boolean))]
      .filter(name => normalizeText(name) !== 'none')
      .sort((a, b) => a.localeCompare(b))

    const dynamicOptions = names.map(name => ({
      value: `library:${normalizeText(name)}`,
      label: name,
      profileValue: toEquipmentProfileValue(name),
    }))

    return [
      { value: 'bodyweight', label: 'Bodyweight', profileValue: 'bodyweight', locked: true },
      ...dynamicOptions,
    ]
  }, [libraryEquipmentNames])

  const [sessionsPerWeek, setSessionsPerWeek] = useState('4')
  const [nasmOptPhase, setNasmOptPhase] = useState('1')
  const [equipmentAccess, setEquipmentAccess] = useState<string[]>(() => {
    const initialProfiles = new Set(
      initialEquipmentAccess
        .map(item => String(item ?? '').trim().toLowerCase())
        .filter(Boolean)
    )

    initialProfiles.add('bodyweight')

    const selectedValues = availableEquipmentOptions
      .filter(option => option.profileValue && initialProfiles.has(option.profileValue))
      .map(option => option.value)

    if (!selectedValues.includes('bodyweight')) {
      selectedValues.unshift('bodyweight')
    }

    return [...new Set(selectedValues)]
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

    const equipmentProfiles = [
      ...new Set(
        availableEquipmentOptions
          .filter(option => equipmentAccess.includes(option.value))
          .map(option => option.profileValue)
          .filter((value): value is string => Boolean(value))
      ),
    ]

    if (!equipmentProfiles.includes('bodyweight')) {
      equipmentProfiles.unshift('bodyweight')
    }

    const res = await fetch('/api/coach/workouts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        sessionsPerWeek: Number(sessionsPerWeek),
        nasmOptPhase: Number(nasmOptPhase),
        equipmentAccess: equipmentProfiles,
      }),
    })

    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      setStatus(payload.error ?? 'Failed to generate plan')
      setBusy(false)
      return
    }

    const draft = payload?.draft as CoachProgramDraft | undefined
    const templateTitle = String(draft?.templateTitle ?? payload?.template?.title ?? '').trim()
    const selectedPhase = PHASE_OPTIONS.find(option => option.value === nasmOptPhase)?.label ?? `Phase ${nasmOptPhase}`
    if (draft) {
      onDraftGenerated?.(draft)
    }
    setStatus(templateTitle
      ? `Draft generated for ${selectedPhase} using ${templateTitle}. Review and accept below.`
      : 'Draft generated for client successfully. Review and accept below.')
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
          {availableEquipmentOptions.map(option => {
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
