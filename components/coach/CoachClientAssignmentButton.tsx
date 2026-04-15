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

  async function handleClick() {
    setBusy(true)
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

  return (
    <div style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        style={{
          padding: '8px 12px',
          background: isAssign ? 'var(--gold)' : 'transparent',
          color: isAssign ? '#0D1B2A' : 'var(--error)',
          border: isAssign ? 'none' : '1px solid var(--error)',
          borderRadius: 2,
          fontFamily: 'Raleway, sans-serif',
          fontWeight: 700,
          fontSize: 12,
          cursor: busy ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
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