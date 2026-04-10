'use client'

import { useState } from 'react'

interface PurchaseButtonProps {
  packageId: string
}

export default function PurchaseButton({ packageId }: PurchaseButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePurchase() {
    setLoading(true)
    setError(null)

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId }),
    })

    if (res.status === 401) {
      window.location.href = '/auth/login?next=/packages'
      return
    }

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setError(data?.error || 'Failed to start checkout. Please try again.')
      setLoading(false)
      return
    }

    const url = data?.url
    if (url) {
      window.location.href = url
      return
    }

    setError('Checkout session created but no redirect URL was returned.')
    setLoading(false)
  }

  return (
    <div>
      <button
        onClick={handlePurchase}
        disabled={loading}
        style={{
          width: '100%',
          padding: '13px',
          background: loading ? 'var(--navy-lt)' : 'var(--gold)',
          color: loading ? 'var(--gray)' : '#0D1B2A',
          border: 'none',
          borderRadius: 2,
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: 18,
          letterSpacing: '0.06em',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
      >
        {loading ? '...' : 'Get Started'}
      </button>
      {error && (
        <p
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontSize: 13,
            color: 'var(--error)',
            margin: '8px 0 0',
            textAlign: 'center',
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
