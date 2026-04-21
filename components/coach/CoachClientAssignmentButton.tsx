'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CoachClientAssignmentButtonProps {
  clientId: string
  mode: 'assign' | 'release'
}

export default function CoachClientAssignmentButton({ clientId, mode }: CoachClientAssignmentButtonProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function handleConfirm() {
    setBusy(true)
    setConfirming(false)
    setStatus(null)

    const res = await fetch(`/api/coach/clients/${clientId}/assignment`, {
      method: mode === 'assign' ? 'PATCH' : 'DELETE',
    })

    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      setStatus(payload.error ?? 'Request failed')
      setBusy(false)
      return
    }

    setBusy(false)
    router.refresh()
  }

  const isAssign = mode === 'assign'

  if (!isAssign && confirming) {
    return (
      <div className="coach-assignment-action" style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
        <p style={{ margin: 0, fontFamily: 'Raleway, sans-serif', fontSize: 12, color: 'var(--error)' }}>
          Release this client?
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              padding: '6px 12px',
              background: 'var(--error)',
              color: '#fff',
              border: 'none',
              borderRadius: 2,
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Yes, release
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              color: 'var(--gray)',
              border: '1px solid var(--navy-lt)',
              borderRadius: 2,
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="coach-assignment-action" style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
      <button
        className="coach-assignment-button"
        type="button"
        onClick={isAssign ? handleConfirm : () => setConfirming(true)}
        disabled={busy}
        style={{
          padding: '6px 10px',
          background: isAssign ? 'var(--gold)' : 'transparent',
          color: isAssign ? '#0D1B2A' : 'var(--gray)',
          border: isAssign ? 'none' : '1px solid var(--navy-lt)',
          borderRadius: 2,
          fontFamily: 'Raleway, sans-serif',
          fontWeight: 600,
          fontSize: 11,
          minHeight: 32,
          cursor: busy ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          opacity: isAssign ? 1 : 0.7,
        }}
      >
        {busy ? (isAssign ? 'Assigning...' : 'Releasing...') : isAssign ? 'Assign to Me' : 'Release'}
      </button>

      {status && (
        <p style={{ margin: 0, fontFamily: 'Raleway, sans-serif', fontSize: 12, color: 'var(--error)' }}>
          {status}
        </p>
      )}
    </div>
  )
}