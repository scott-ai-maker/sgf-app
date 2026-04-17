'use client'

import { useState } from 'react'

interface PurchaseButtonProps {
  packageId: string
}

export default function PurchaseButton({ packageId }: PurchaseButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [discountCode, setDiscountCode] = useState('')

  async function handlePurchase() {
    setLoading(true)
    setError(null)

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packageId,
        discountCode: discountCode.trim() || undefined,
      }),
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
      <label
        htmlFor={`discount-${packageId}`}
        style={{
          display: 'block',
          fontFamily: 'Raleway, sans-serif',
          fontWeight: 600,
          fontSize: 11,
          color: 'var(--gray)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 6,
        }}
      >
        Discount Code (Optional)
      </label>
      <input
        id={`discount-${packageId}`}
        type="text"
        value={discountCode}
        onChange={e => setDiscountCode(e.target.value.toUpperCase())}
        placeholder="COACH-XXXXXX"
        style={{
          width: '100%',
          marginBottom: 12,
          padding: '10px 12px',
          background: 'var(--navy)',
          border: '1px solid var(--navy-lt)',
          borderRadius: 2,
          color: 'var(--white)',
          fontFamily: 'Raleway, sans-serif',
          fontSize: 13,
          outline: 'none',
        }}
      />
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
