'use client'
import { useState } from 'react'

export default function WaitlistForm({ id = 'default' }: { id?: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  async function submit() {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2000)
      return
    }
    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) setStatus('success')
      else setStatus('error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="waitlist-success" style={{
        borderLeft: '3px solid var(--success)',
        background: 'rgba(72,187,120,0.07)',
        padding: '1.25rem 1.5rem',
        maxWidth: 480,
      }}>
        <p style={{ fontSize: '0.9rem', color: 'var(--white)', lineHeight: 1.6 }}>
          <span style={{ color: 'var(--success)', fontWeight: 600 }}>You&apos;re on the list.</span>
          {' '}I&apos;ll be in touch personally when spots open. - Scott
        </p>
      </div>
    )
  }

  return (
    <div id={`waitlist-${id}`} className="waitlist-form" style={{ display: 'flex', gap: 0, maxWidth: 480, width: '100%' }}>
      <label htmlFor={`waitlist-email-${id}`} style={{ position: 'absolute', left: '-9999px' }}>
        Email address
      </label>
      <input
        id={`waitlist-email-${id}`}
        className="waitlist-form-input"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="your@email.com"
        autoComplete="email"
        style={{
          flex: 1,
          background: 'var(--navy-mid)',
          border: `1px solid ${status === 'error' ? 'var(--error)' : 'var(--navy-lt)'}`,
          borderRight: 'none',
          color: 'var(--white)',
          fontFamily: 'Raleway, sans-serif',
          fontSize: '0.9rem',
          padding: '1rem 1.25rem',
          outline: 'none',
          borderRadius: '2px 0 0 2px',
        }}
      />
      <button
        type="button"
        className="waitlist-form-button"
        onClick={submit}
        disabled={status === 'loading'}
        style={{
          background: 'var(--gold)',
          color: 'var(--navy)',
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: '1rem',
          letterSpacing: '0.15em',
          padding: '1rem 1.75rem',
          border: 'none',
          borderRadius: '0 2px 2px 0',
          cursor: status === 'loading' ? 'wait' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {status === 'loading' ? '...' : 'Join Waitlist'}
      </button>
    </div>
  )
}
