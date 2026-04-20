'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

function formatAuthErrorMessage(rawMessage: string) {
  const msg = rawMessage.toLowerCase()

  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('over_email_send_rate_limit')) {
    return 'Email rate limit reached. Please wait a minute and try again.'
  }

  return rawMessage
}

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

interface ResetPasswordFormProps {
  forceChange?: boolean
  nextPath?: string
}

function validatePassword(password: string): string | undefined {
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter'
  if (!/[0-9]/.test(password)) return 'Password must contain a number'
}

export default function ResetPasswordForm({ forceChange = false, nextPath = '/dashboard' }: ResetPasswordFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [canChangePassword, setCanChangePassword] = useState(forceChange)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (forceChange) return

    const supabase = createClient()
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCanChangePassword(true)
      }
    })
  }, [forceChange])

  async function handleRequestResetSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    })

    if (error) {
      setError(formatAuthErrorMessage(error.message))
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  async function handleChangePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    const validationError = validatePassword(newPassword)
    if (validationError) {
      setError(validationError)
      setLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { must_reset_password: false },
    })

    if (error) {
      setError(formatAuthErrorMessage(error.message))
      setLoading(false)
      return
    }

    setSuccessMessage('Password updated successfully. Redirecting...')
    setLoading(false)
    router.push(nextPath)
    router.refresh()
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

  if (canChangePassword) {
    return (
      <form onSubmit={handleChangePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontSize: 14,
            color: 'var(--gray)',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Set a new password to continue.
        </p>

        <input
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          required
          style={inputStyle}
          placeholder="New password"
        />

        <input
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
          style={inputStyle}
          placeholder="Confirm new password"
        />

        {error && (
          <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 13, color: 'var(--error)', margin: 0 }}>
            {error}
          </p>
        )}

        {successMessage && (
          <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 13, color: 'var(--success)', margin: 0 }}>
            {successMessage}
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
          {loading ? '...' : 'Update Password'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleRequestResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
