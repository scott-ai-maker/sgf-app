'use client'

import { useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'

interface CoachCommerceToolsProps {
  clientId: string
}

export default function CoachCommerceTools({ clientId }: CoachCommerceToolsProps) {
  const router = useRouter()

  const [grantSessions, setGrantSessions] = useState('1')
  const [grantNote, setGrantNote] = useState('')
  const [grantLoading, setGrantLoading] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null)

  const [discountType, setDiscountType] = useState<'percent' | 'fixed_amount'>('percent')
  const [discountValue, setDiscountValue] = useState('15')
  const [maxRedemptions, setMaxRedemptions] = useState('1')
  const [expiresDays, setExpiresDays] = useState('30')
  const [discountDescription, setDiscountDescription] = useState('')
  const [restrictToClient, setRestrictToClient] = useState(true)
  const [discountLoading, setDiscountLoading] = useState(false)
  const [discountError, setDiscountError] = useState<string | null>(null)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)

  async function handleGrantCompSessions() {
    setGrantLoading(true)
    setGrantError(null)
    setGrantSuccess(null)

    const sessions = Number(grantSessions)

    const res = await fetch(`/api/coach/clients/${clientId}/comp-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessions,
        note: grantNote.trim() || undefined,
      }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setGrantError(data?.error ?? 'Failed to grant comp sessions')
      setGrantLoading(false)
      return
    }

    setGrantSuccess(`Granted ${sessions} comp session${sessions === 1 ? '' : 's'}.`)
    setGrantNote('')
    setGrantLoading(false)
    router.refresh()
  }

  async function handleCreateDiscountCode() {
    setDiscountLoading(true)
    setDiscountError(null)
    setGeneratedCode(null)

    const days = Number(expiresDays)
    const expiresAt = Number.isFinite(days) && days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : null

    const parsedMaxRedemptions = Number(maxRedemptions)

    const res = await fetch('/api/coach/discount-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: discountDescription.trim() || undefined,
        discountType,
        discountValue: Number(discountValue),
        maxRedemptions: Number.isFinite(parsedMaxRedemptions) && parsedMaxRedemptions > 0
          ? parsedMaxRedemptions
          : undefined,
        expiresAt,
        restrictedClientId: restrictToClient ? clientId : undefined,
      }),
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      setDiscountError(data?.error ?? 'Failed to create discount code')
      setDiscountLoading(false)
      return
    }

    setGeneratedCode(data?.code?.code ?? null)
    setDiscountLoading(false)
  }

  const sectionTitleStyle: CSSProperties = {
    fontFamily: 'Bebas Neue, sans-serif',
    fontSize: 20,
    color: 'var(--white)',
    letterSpacing: '0.06em',
    margin: '0 0 10px',
  }

  const labelStyle: CSSProperties = {
    fontFamily: 'Raleway, sans-serif',
    fontWeight: 600,
    fontSize: 11,
    color: 'var(--gray)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 6,
    display: 'block',
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--navy)',
    border: '1px solid var(--navy-lt)',
    borderRadius: 2,
    color: 'var(--white)',
    fontFamily: 'Raleway, sans-serif',
    fontSize: 16,
    outline: 'none',
    minHeight: 44,
  }

  return (
    <div
      className="coach-commerce-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
        gap: 18,
        marginBottom: 36,
      }}
    >
      <section
        style={{
          background: 'var(--navy-mid)',
          border: '1px solid var(--navy-lt)',
          padding: '18px 20px',
        }}
      >
        <h3 style={sectionTitleStyle}>Comp Sessions</h3>
        <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 13, color: 'var(--gray)', margin: '0 0 14px' }}>
          Add free session credits directly to this client account.
        </p>

        <label htmlFor="comp-sessions-count" style={labelStyle}>Sessions to grant</label>
        <input
          id="comp-sessions-count"
          type="number"
          min={1}
          max={50}
          value={grantSessions}
          onChange={e => setGrantSessions(e.target.value)}
          style={{ ...inputStyle, marginBottom: 12 }}
        />

        <label htmlFor="comp-sessions-note" style={labelStyle}>Internal note (optional)</label>
        <textarea
          id="comp-sessions-note"
          value={grantNote}
          onChange={e => setGrantNote(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: 'vertical', marginBottom: 12 }}
        />

        <button
          onClick={handleGrantCompSessions}
          disabled={grantLoading}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: 'none',
            borderRadius: 2,
            background: grantLoading ? 'var(--navy-lt)' : 'var(--gold)',
            color: grantLoading ? 'var(--gray)' : '#0D1B2A',
            fontFamily: 'Bebas Neue, sans-serif',
            letterSpacing: '0.06em',
            fontSize: 16,
            minHeight: 44,
            cursor: grantLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {grantLoading ? '...' : 'Grant Comp Sessions'}
        </button>

        {grantError && <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 12, color: 'var(--error)', margin: '10px 0 0' }}>{grantError}</p>}
        {grantSuccess && <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 12, color: 'var(--success)', margin: '10px 0 0' }}>{grantSuccess}</p>}
      </section>

      <section
        style={{
          background: 'var(--navy-mid)',
          border: '1px solid var(--navy-lt)',
          padding: '18px 20px',
        }}
      >
        <h3 style={sectionTitleStyle}>Discount Code</h3>
        <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 13, color: 'var(--gray)', margin: '0 0 14px' }}>
          Generate a reusable code for package checkout.
        </p>

        <div className="coach-commerce-pair-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label htmlFor="discount-type" style={labelStyle}>Type</label>
            <select
              id="discount-type"
              value={discountType}
              onChange={e => setDiscountType(e.target.value === 'fixed_amount' ? 'fixed_amount' : 'percent')}
              style={inputStyle}
            >
              <option value="percent">Percent</option>
              <option value="fixed_amount">Fixed ($ cents)</option>
            </select>
          </div>
          <div>
            <label htmlFor="discount-value" style={labelStyle}>Value</label>
            <input
              id="discount-value"
              type="number"
              min={1}
              value={discountValue}
              onChange={e => setDiscountValue(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div className="coach-commerce-pair-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label htmlFor="discount-max-redemptions" style={labelStyle}>Max redemptions</label>
            <input
              id="discount-max-redemptions"
              type="number"
              min={1}
              value={maxRedemptions}
              onChange={e => setMaxRedemptions(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="discount-exp-days" style={labelStyle}>Expires in (days)</label>
            <input
              id="discount-exp-days"
              type="number"
              min={1}
              value={expiresDays}
              onChange={e => setExpiresDays(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <label htmlFor="discount-description" style={labelStyle}>Description (optional)</label>
        <input
          id="discount-description"
          type="text"
          value={discountDescription}
          onChange={e => setDiscountDescription(e.target.value)}
          placeholder="Example: make-good for missed call"
          style={{ ...inputStyle, marginBottom: 10 }}
        />

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={restrictToClient}
            onChange={e => setRestrictToClient(e.target.checked)}
          />
          <span style={{ fontFamily: 'Raleway, sans-serif', fontSize: 12, color: 'var(--gray)' }}>
            Restrict to this client only
          </span>
        </label>

        <button
          onClick={handleCreateDiscountCode}
          disabled={discountLoading}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid var(--gold)',
            borderRadius: 2,
            background: discountLoading ? 'var(--navy-lt)' : 'transparent',
            color: 'var(--gold)',
            fontFamily: 'Bebas Neue, sans-serif',
            letterSpacing: '0.06em',
            fontSize: 16,
            minHeight: 44,
            cursor: discountLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {discountLoading ? '...' : 'Generate Discount Code'}
        </button>

        {discountError && <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 12, color: 'var(--error)', margin: '10px 0 0' }}>{discountError}</p>}
        {generatedCode && (
          <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 13, color: 'var(--success)', margin: '10px 0 0' }}>
            New code: <strong>{generatedCode}</strong>
          </p>
        )}
      </section>
    </div>
  )
}
