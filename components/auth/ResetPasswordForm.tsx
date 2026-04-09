'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'var(--navy)',
  border: '1px solid var(--navy-lt)',
  borderRadius: 2,
  color: 'var(--white)',
  fontFamily: 'Raleway, sans-serif',
  fontWeight: 300,
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
}

export default function ResetPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center' }}>
        <p
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontSize: 15,
            color: 'var(--success)',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Check your email — we sent a reset link to <strong>{email}</strong>.
        </p>
        <a
          href="/auth/login"
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontSize: 13,
            color: 'var(--gold)',
            textDecoration: 'none',
          }}
        >
          Back to Sign In
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p
        style={{
          fontFamily: 'Raleway, sans-serif',
          fontSize: 14,
          color: 'var(--gray)',
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        style={inputStyle}
        placeholder="you@example.com"
      />

      {error && (
        <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 13, color: 'var(--error)', margin: 0 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '13px',
          background: loading ? 'var(--navy-lt)' : 'var(--gold)',
          color: loading ? 'var(--gray)' : '#0D1B2A',
          border: 'none',
          borderRadius: 2,
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: 18,
          letterSpacing: '0.06em',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '...' : 'Send Reset Link'}
      </button>

      <a
        href="/auth/login"
        style={{
          textAlign: 'center',
          fontFamily: 'Raleway, sans-serif',
          fontSize: 13,
          color: 'var(--gold)',
          textDecoration: 'none',
        }}
      >
        Back to Sign In
      </a>
    </form>
  )
}
