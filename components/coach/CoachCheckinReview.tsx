'use client'

import { useState } from 'react'

interface Checkin {
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

interface CoachCheckinReviewProps {
  clientId: string
  initialCheckins: Checkin[]
}

function ratingBar(value: number | null, invert?: boolean) {
  if (value === null) return <span style={{ color: 'var(--gray)', fontSize: 12 }}>—</span>
  const pct = (value / 5) * 100
  const good = invert ? value <= 2 : value >= 4
  const bad = invert ? value >= 4 : value <= 2
  const color = good ? 'var(--success)' : bad ? 'var(--error)' : 'var(--gold)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 60, height: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
      <span style={{ fontSize: 13, color }}>{value}/5</span>
    </div>
  )
}

export default function CoachCheckinReview({ clientId, initialCheckins }: CoachCheckinReviewProps) {
  const [checkins, setCheckins] = useState<Checkin[]>(initialCheckins)
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  async function saveFeedback(checkin: Checkin) {
    setSaving(checkin.id)
    const res = await fetch(`/api/coach/clients/${clientId}/checkins`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checkin_id: checkin.id,
        coach_feedback: feedbackDrafts[checkin.id] ?? checkin.coach_feedback ?? '',
      }),
    })

    if (res.ok) {
      const updated = await res.json()
      setCheckins(prev => prev.map(c => c.id === checkin.id ? { ...c, coach_feedback: updated.coach_feedback } : c))
    }
    setSaving(null)
  }

  if (checkins.length === 0) {
    return <p style={{ color: 'var(--gray)', fontSize: 14, margin: 0 }}>No check-ins submitted yet.</p>
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {checkins.map(checkin => {
        const weekLabel = new Date(`${checkin.week_start}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        const draft = feedbackDrafts[checkin.id] ?? checkin.coach_feedback ?? ''

        return (
          <details key={checkin.id} style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)' }}>
            <summary style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', userSelect: 'none', listStyle: 'none' }}>
              <span style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--white)' }}>Week of {weekLabel}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {checkin.coach_feedback && (
                  <span style={{ fontSize: 11, padding: '2px 8px', border: '1px solid rgba(72,187,120,0.4)', color: 'var(--success)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Responded</span>
                )}
                <span style={{ fontSize: 11, color: 'var(--gray)' }}>
                  Sleep {checkin.sleep_quality ?? '?'} · Stress {checkin.stress_level ?? '?'} · Soreness {checkin.soreness_level ?? '?'} · Energy {checkin.energy_level ?? '?'}
                </span>
              </div>
            </summary>

            <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                <div><p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sleep Quality</p>{ratingBar(checkin.sleep_quality)}</div>
                <div><p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Stress Level</p>{ratingBar(checkin.stress_level, true)}</div>
                <div><p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Soreness</p>{ratingBar(checkin.soreness_level, true)}</div>
                <div><p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Energy</p>{ratingBar(checkin.energy_level)}</div>
                {checkin.weight_kg && (
                  <div><p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Weight</p><span style={{ fontSize: 13, color: 'var(--white)' }}>{checkin.weight_kg} kg</span></div>
                )}
              </div>

              {checkin.notes && (
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Client Notes</p>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--white)', lineHeight: 1.5 }}>{checkin.notes}</p>
                </div>
              )}

              <div>
                <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Your Feedback</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <textarea
                    value={draft}
                    onChange={e => setFeedbackDrafts(prev => ({ ...prev, [checkin.id]: e.target.value }))}
                    placeholder="Write feedback for this client — they will see this in their check-in section..."
                    rows={3}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      background: 'var(--navy)',
                      border: '1px solid var(--navy-lt)',
                      color: 'var(--white)',
                      fontFamily: 'Raleway, sans-serif',
                      fontSize: 14,
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void saveFeedback(checkin)}
                    disabled={saving === checkin.id}
                    style={{ padding: '8px 14px', background: 'var(--gold)', color: '#0D1B2A', border: 'none', fontFamily: 'Bebas Neue, sans-serif', fontSize: 14, letterSpacing: '0.06em', cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 40 }}
                  >
                    {saving === checkin.id ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </details>
        )
      })}
    </div>
  )
}
