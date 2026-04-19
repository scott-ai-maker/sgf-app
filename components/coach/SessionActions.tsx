'use client'

import { useState } from 'react'

interface SessionActionsProps {
  sessionId: string
  currentStatus: string
  currentNotes: string | null
  checkedInAt?: string | null
  checkedOutAt?: string | null
  onUpdate: () => void
}

export default function SessionActions({
  sessionId,
  currentStatus,
  currentNotes,
  checkedInAt,
  checkedOutAt,
  onUpdate,
}: SessionActionsProps) {
  const [notes, setNotes] = useState(currentNotes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function updateSession(patch: { status?: string; notes?: string; checked_in_at?: string | null; checked_out_at?: string | null }) {
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
  const canCheckIn = currentStatus === 'scheduled' && !checkedInAt
  const canCheckOut = currentStatus === 'scheduled' && Boolean(checkedInAt) && !checkedOutAt

  const btnBase: React.CSSProperties = {
    padding: '6px 12px',
    border: 'none',
    borderRadius: 2,
    fontFamily: 'Raleway, sans-serif',
    fontWeight: 600,
    fontSize: 13,
    minHeight: 40,
    cursor: loading ? 'not-allowed' : 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(canCheckIn || canCheckOut || canMark) && (
        <div className="coach-session-action-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canCheckIn && (
            <button
              onClick={() => updateSession({ checked_in_at: new Date().toISOString() })}
              disabled={loading}
              style={{ ...btnBase, background: 'rgba(74,144,226,0.85)', color: '#fff' }}
            >
              Check In
            </button>
          )}
          {canCheckOut && (
            <button
              onClick={() => updateSession({ checked_out_at: new Date().toISOString() })}
              disabled={loading}
              style={{ ...btnBase, background: 'rgba(74,144,226,0.55)', color: '#fff' }}
            >
              Check Out
            </button>
          )}
          {canMark && (
            <button
              onClick={() => updateSession({ status: 'completed' })}
              disabled={loading}
              style={{ ...btnBase, background: 'var(--success)', color: '#fff' }}
            >
              Mark Complete
            </button>
          )}
          {canMark && (
            <button
              onClick={() => updateSession({ status: 'no_show' })}
              disabled={loading}
              style={{ ...btnBase, background: 'transparent', color: 'var(--error)', border: '1px solid var(--error)' }}
            >
              No Show
            </button>
          )}
          {canMark && (
            <button
              onClick={() => updateSession({ status: 'cancelled' })}
              disabled={loading}
              style={{ ...btnBase, background: 'transparent', color: 'var(--gray)', border: '1px solid var(--navy-lt)' }}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {checkedInAt && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--gray)', fontFamily: 'Raleway, sans-serif' }}>
          Checked in: {new Date(checkedInAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          {checkedOutAt && ` · Checked out: ${new Date(checkedOutAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
        </p>
      )}

      <div className="coach-session-notes-row" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Session notes (what was worked, performance, cues used)..."
          rows={3}
          style={{
            flex: 1,
            padding: '8px 10px',
            background: 'var(--navy)',
            border: '1px solid var(--navy-lt)',
            borderRadius: 2,
            color: 'var(--white)',
            fontFamily: 'Raleway, sans-serif',
            fontWeight: 300,
            fontSize: 16,
            resize: 'vertical',
            outline: 'none',
            minHeight: 56,
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
            minHeight: 40,
          }}
        >
          Save Notes
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
