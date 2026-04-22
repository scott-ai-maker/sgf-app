'use client'

import { useMemo, useState } from 'react'
import type { CoachProgramDraft } from '@/lib/coach-programs'

interface GenerateClientPlanButtonProps {
  clientId: string
  initialEquipmentAccess?: string[]
  libraryEquipmentNames?: string[]
  initialSessionsPerWeek?: number | null
  preferredTrainingDays?: string[]
  onDraftGenerated?: (draft: CoachProgramDraft) => void
}

const PHASE_OPTIONS = [
  { value: '1', label: 'Phase 1 - Stabilization Endurance' },
  { value: '2', label: 'Phase 2 - Strength Endurance' },
  { value: '3', label: 'Phase 3 - Muscular Development' },
  { value: '4', label: 'Phase 4 - Maximal Strength' },
  { value: '5', label: 'Phase 5 - Power' },
]

const EXPERIENCE_OPTIONS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

interface EquipmentOption {
  value: string
  label: string
  locked?: boolean
}

interface GenerationRecommendation {
  recommendedDaysPerWeek: number
  rationale: string
  caution: string
  coachSelectedDaysPerWeek: number
  cautionRequired: boolean
  recommendedSessionDurationMins: number
  volumeGuardrailApplied?: boolean
  volumeGuardrailNotes?: string[]
  maxSetsPerSession?: number
  maxSetsPerWeek?: number
  resultingWeeklySets?: number
}

interface StrictVolumeBlockRecommendation {
  recommendedDaysPerWeek: number
  maxSetsPerWeek: number
  projectedWeeklySets: number
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function mapLegacyEquipmentValueToLabel(value: string, optionLabel: string) {
  const normalizedValue = normalizeText(value)
  const normalizedLabel = normalizeText(optionLabel)

  if (!normalizedValue || !normalizedLabel) return false
  if (normalizedValue === normalizedLabel) return true
  if (normalizedValue === 'bodyweight') return normalizedLabel.includes('bodyweight')
  if (normalizedValue === 'dumbbells') return normalizedLabel.includes('dumbbell')
  if (normalizedValue === 'barbell') return normalizedLabel.includes('barbell')
  if (normalizedValue === 'bench') return normalizedLabel.includes('bench')
  if (normalizedValue === 'cable-machine') return normalizedLabel.includes('cable')
  if (normalizedValue === 'machines') return normalizedLabel.includes('machine') || normalizedLabel.includes('smith')
  if (normalizedValue === 'kettlebells') return normalizedLabel.includes('kettlebell')
  if (normalizedValue === 'bands') return normalizedLabel.includes('band') || normalizedLabel.includes('resistance')
  if (normalizedValue === 'trx') return normalizedLabel.includes('trx') || normalizedLabel.includes('suspension')
  if (normalizedValue === 'medicine-ball') return normalizedLabel.includes('medicine ball') || normalizedLabel.includes('stability ball')

  return false
}

export default function GenerateClientPlanButton({
  clientId,
  initialEquipmentAccess = [],
  libraryEquipmentNames = [],
  initialSessionsPerWeek = null,
  preferredTrainingDays = [],
  onDraftGenerated,
}: GenerateClientPlanButtonProps) {
  const availableEquipmentOptions = useMemo<EquipmentOption[]>(() => {
    const names = [...new Set(libraryEquipmentNames.map(item => String(item ?? '').trim()).filter(Boolean))]
      .filter(name => normalizeText(name) !== 'none')
      .sort((a, b) => a.localeCompare(b))

    const dynamicOptions = names.map(name => ({
      value: normalizeText(name),
      label: name,
    }))

    return [
      { value: 'bodyweight', label: 'Bodyweight', locked: true },
      ...dynamicOptions,
    ]
  }, [libraryEquipmentNames])

  const [sessionsPerWeek, setSessionsPerWeek] = useState(String(
    Math.max(2, Math.min(7, Number(initialSessionsPerWeek) || preferredTrainingDays.length || 4))
  ))
  const [nasmOptPhase, setNasmOptPhase] = useState('1')
  const [experienceLevel, setExperienceLevel] = useState('beginner')
  const [equipmentAccess, setEquipmentAccess] = useState<string[]>(() => {
    const initialProfiles = new Set(
      initialEquipmentAccess
        .map(item => String(item ?? '').trim().toLowerCase())
        .filter(Boolean)
    )

    initialProfiles.add('bodyweight')

    const selectedValues = availableEquipmentOptions
      .filter(option => initialProfiles.has(option.value) || [...initialProfiles].some(value => mapLegacyEquipmentValueToLabel(value, option.label)))
      .map(option => option.value)

    if (!selectedValues.includes('bodyweight')) {
      selectedValues.unshift('bodyweight')
    }

    return [...new Set(selectedValues)]
  })
  const [startDate, setStartDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [recommendation, setRecommendation] = useState<GenerationRecommendation | null>(null)
  const [strictVolumeBlock, setStrictVolumeBlock] = useState<StrictVolumeBlockRecommendation | null>(null)
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false)

  function toggleEquipment(value: string) {
    setEquipmentAccess(current => {
      if (value === 'bodyweight') return current
      if (current.includes(value)) return current.filter(item => item !== value)
      return [...current, value]
    })
  }

  async function runGenerate() {
    setBusy(true)
    setStatus(null)

    const selectedEquipment = [
      ...new Set(
        availableEquipmentOptions
          .filter(option => equipmentAccess.includes(option.value))
          .map(option => option.value)
          .filter(Boolean)
      ),
    ]

    if (!selectedEquipment.includes('bodyweight')) {
      selectedEquipment.unshift('bodyweight')
    }

    const res = await fetch('/api/coach/workouts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        sessionsPerWeek: Number(sessionsPerWeek),
        nasmOptPhase: Number(nasmOptPhase),
        equipmentAccess: selectedEquipment,
        experienceLevel,
        startDate: startDate || null,
      }),
    })

    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      const strictRecommendation = payload?.recommendation as Partial<StrictVolumeBlockRecommendation> | undefined
      if (
        strictRecommendation
        && typeof strictRecommendation.recommendedDaysPerWeek === 'number'
        && typeof strictRecommendation.maxSetsPerWeek === 'number'
        && typeof strictRecommendation.projectedWeeklySets === 'number'
      ) {
        setStrictVolumeBlock({
          recommendedDaysPerWeek: strictRecommendation.recommendedDaysPerWeek,
          maxSetsPerWeek: strictRecommendation.maxSetsPerWeek,
          projectedWeeklySets: strictRecommendation.projectedWeeklySets,
        })
      } else {
        setStrictVolumeBlock(null)
      }
      setStatus(payload.error ?? 'Failed to generate plan')
      setBusy(false)
      return
    }

    const nextRecommendation = payload?.recommendation as GenerationRecommendation | undefined
    setRecommendation(nextRecommendation ?? null)
    setStrictVolumeBlock(null)

    const draft = payload?.draft as CoachProgramDraft | undefined
    const templateTitle = String(draft?.templateTitle ?? payload?.template?.title ?? '').trim()
    const selectedPhase = PHASE_OPTIONS.find(option => option.value === nasmOptPhase)?.label ?? `Phase ${nasmOptPhase}`
    if (draft) {
      onDraftGenerated?.(draft)
    }
    setStatus(templateTitle
      ? `Monthly draft generated for ${selectedPhase} using ${templateTitle}. Review and accept below.`
      : 'Monthly draft generated for client successfully. Review and accept below.')
    setBusy(false)
  }

  function handleGenerateClick() {
    if (!recommendation) {
      void runGenerate()
      return
    }

    const requested = Number(sessionsPerWeek)
    if (requested > recommendation.recommendedDaysPerWeek) {
      setShowOverrideConfirm(true)
      return
    }

    void runGenerate()
  }

  const requestedSessions = Number(sessionsPerWeek)
  const preflightCaution = recommendation
    ? (requestedSessions > recommendation.recommendedDaysPerWeek
      ? `${recommendation.caution} (Selected ${requestedSessions}/week vs recommended ${recommendation.recommendedDaysPerWeek}/week.)`
      : null)
    : null

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
        Experience
      </label>
      <select
        value={experienceLevel}
        onChange={e => setExperienceLevel(e.target.value)}
        style={{
          minWidth: 140,
          padding: '8px 10px',
          border: '1px solid var(--navy-lt)',
          background: 'var(--navy-mid)',
          color: 'var(--white)',
          fontFamily: 'Raleway, sans-serif',
        }}
      >
        {EXPERIENCE_OPTIONS.map(option => (
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

      {recommendation && (
        <button
          type="button"
          onClick={() => setSessionsPerWeek(String(recommendation.recommendedDaysPerWeek))}
          style={{
            border: '1px solid rgba(212,160,23,0.35)',
            background: 'rgba(212,160,23,0.1)',
            color: 'var(--gold-lt)',
            padding: '8px 10px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Use AI Recommendation ({recommendation.recommendedDaysPerWeek}/wk)
        </button>
      )}

      <label style={{ fontFamily: 'Raleway, sans-serif', color: 'var(--gray)', fontSize: 13 }}>
        Start date
      </label>
      <input
        value={startDate}
        onChange={e => setStartDate(e.target.value)}
        type="date"
        min={new Date().toISOString().slice(0, 10)}
        style={{
          padding: '8px 10px',
          border: '1px solid var(--navy-lt)',
          background: 'var(--navy-mid)',
          color: startDate ? 'var(--white)' : 'var(--gray)',
          fontFamily: 'Raleway, sans-serif',
          colorScheme: 'dark',
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

      {preferredTrainingDays.length > 0 && (
        <div style={{ display: 'grid', gap: 8, width: '100%' }}>
          <span style={{ fontFamily: 'Raleway, sans-serif', color: 'var(--gray)', fontSize: 13 }}>
            Preferred training days used for month scheduling
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {preferredTrainingDays.map(day => (
              <span
                key={day}
                style={{
                  border: '1px solid rgba(212,160,23,0.35)',
                  background: 'rgba(212,160,23,0.1)',
                  color: 'var(--gold-lt)',
                  padding: '4px 8px',
                  fontSize: 12,
                  textTransform: 'capitalize',
                }}
              >
                {day}
              </span>
            ))}
          </div>
        </div>
      )}

      {recommendation && (
        <div style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(74,144,226,0.28)', background: 'rgba(74,144,226,0.08)' }}>
          <p style={{ margin: 0, color: 'rgba(144,190,255,0.9)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
            Coach Persona Recommendation
          </p>
          <p style={{ margin: '6px 0 0', color: 'var(--white)', fontSize: 13 }}>
            {recommendation.recommendedDaysPerWeek} sessions/week suggested. Session length adjusted to {recommendation.recommendedSessionDurationMins} min (max 60 min).
          </p>
          {typeof recommendation.resultingWeeklySets === 'number' && (
            <p style={{ margin: '6px 0 0', color: 'var(--white)', fontSize: 13 }}>
              Weekly programmed volume: {recommendation.resultingWeeklySets} sets (NASM guardrails: max {recommendation.maxSetsPerSession ?? '-'} per session, {recommendation.maxSetsPerWeek ?? '-'} per week).
            </p>
          )}
          <p style={{ margin: '6px 0 0', color: 'var(--gray)', fontSize: 12 }}>
            {recommendation.rationale}
          </p>
          {recommendation.volumeGuardrailApplied && Array.isArray(recommendation.volumeGuardrailNotes) && recommendation.volumeGuardrailNotes.length > 0 && (
            <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
              {recommendation.volumeGuardrailNotes.slice(0, 3).map((note, index) => (
                <p key={`${note}-${index}`} style={{ margin: 0, color: 'var(--gold-lt)', fontSize: 12 }}>
                  {note}
                </p>
              ))}
            </div>
          )}
          {preflightCaution && (
            <p style={{ margin: '8px 0 0', color: 'var(--error)', fontSize: 12 }}>
              {preflightCaution}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={handleGenerateClick}
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

      {strictVolumeBlock && (
        <div style={{ width: '100%', padding: '10px 12px', border: '1px solid rgba(245,101,101,0.35)', background: 'rgba(245,101,101,0.08)', display: 'grid', gap: 8 }}>
          <p style={{ margin: 0, color: 'var(--error)', fontSize: 13 }}>
            Strict NASM guardrail blocked this override: projected weekly volume is {strictVolumeBlock.projectedWeeklySets} sets, above the cap of {strictVolumeBlock.maxSetsPerWeek}.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setSessionsPerWeek(String(strictVolumeBlock.recommendedDaysPerWeek))
                setStrictVolumeBlock(null)
                setStatus(null)
              }}
              style={{
                border: '1px solid rgba(72,187,120,0.4)',
                background: 'rgba(72,187,120,0.1)',
                color: 'var(--success)',
                padding: '8px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Use Safe Recommendation ({strictVolumeBlock.recommendedDaysPerWeek}/wk)
            </button>
          </div>
        </div>
      )}

      {showOverrideConfirm && recommendation && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5,10,20,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 520,
              border: '1px solid rgba(255,255,255,0.16)',
              background: 'var(--navy-mid)',
              padding: 18,
              display: 'grid',
              gap: 12,
            }}
          >
            <p style={{ margin: 0, color: 'var(--gold-lt)', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.08em', fontSize: 24 }}>
              Confirm Higher Training Frequency
            </p>
            <p style={{ margin: 0, color: 'var(--white)', fontSize: 14, lineHeight: 1.5 }}>
              You selected {sessionsPerWeek} sessions/week. The coach persona recommends {recommendation.recommendedDaysPerWeek} sessions/week for this client profile.
            </p>
            <p style={{ margin: 0, color: 'var(--error)', fontSize: 13, lineHeight: 1.5 }}>
              {recommendation.caution}
            </p>
            <p style={{ margin: 0, color: 'var(--gray)', fontSize: 12 }}>
              Sessions will remain capped at 60 minutes and adjusted downward for phase intensity.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowOverrideConfirm(false)}
                style={{
                  border: '1px solid rgba(255,255,255,0.16)',
                  background: 'var(--navy)',
                  color: 'var(--white)',
                  padding: '8px 12px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOverrideConfirm(false)
                  void runGenerate()
                }}
                style={{
                  border: 0,
                  background: 'var(--gold)',
                  color: '#0D1B2A',
                  padding: '8px 12px',
                  cursor: 'pointer',
                }}
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
