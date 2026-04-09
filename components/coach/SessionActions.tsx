'use client'

import { useState } from 'react'

interface SessionActionsProps {
  sessionId: string
  currentStatus: string
  currentNotes: string | null
  onUpdate: () => void
}

export default function SessionActions({
  sessionId,
  currentStatus,
  currentNotes,
  onUpdate,
}: SessionActionsProps) {
  const [notes, setNotes] = useState(currentNotes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function updateSession(patch: { status?: string; notes?: string }) {
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/coach/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Update failed')
    } else {
      onUpdate()
    }
    setLoading(false)
  }

  const canMark = currentStatus === 'scheduled'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {canMark && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => updateSession({ status: 'completed' })}
            disabled={loading}
            style={{
              padding: '6px 12px',
              background: 'var(--success)',
              color: '#fff',
              border: 'none',
              borderRadius: 2,
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 600,
              fontSize: 12,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Mark Complete
          </button>
          <button
            onClick={() => updateSession({ status: 'no_show' })}
            disabled={loading}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              color: 'var(--error)',
              border: '1px solid var(--error)',
              borderRadius: 2,
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 600,
              fontSize: 12,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            No Show
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add notes..."
          rows={2}
          style={{
            flex: 1,
            padding: '8px 10px',
            background: 'var(--navy)',
            border: '1px solid var(--navy-lt)',
            borderRadius: 2,
            color: 'var(--white)',
            fontFamily: 'Raleway, sans-serif',
            fontWeight: 300,
            fontSize: 13,
            resize: 'vertical',
            outline: 'none',
          }}
        />
        <button
          onClick={() => updateSession({ notes })}
          disabled={loading}
          style={{
            padding: '8px 14px',
            background: 'var(--gold)',
            color: '#0D1B2A',
            border: 'none',
            borderRadius: 2,
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 14,
            letterSpacing: '0.06em',
            cursor: loading ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Save
        </button>
      </div>

      {error && (
        <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 12, color: 'var(--error)', margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  )
}
