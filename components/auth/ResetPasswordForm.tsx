'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

function formatAuthErrorMessage(rawMessage: string) {
  const msg = rawMessage.toLowerCase()

  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('over_email_send_rate_limit')) {
    return 'Email rate limit reached. Please wait a minute and try again.'
  }

  if (msg.includes('invalid') || msg.includes('expired')) {
    return 'This password reset link is invalid or has expired. Please request a new one.'
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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'Raleway, sans-serif',
  fontWeight: 600,
  fontSize: 12,
  color: 'var(--gray)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
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
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSessionValid, setIsSessionValid] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const maxAttempts = 6

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const { data } = await supabase.auth.getUser()

        if (data.user) {
          setIsSessionValid(true)
          setIsChecking(false)
          return
        }

        await new Promise(resolve => setTimeout(resolve, 300))
      }

      if (!forceChange) {
        setError('No valid session. Please request a password reset from the login page.')
      }
      setIsChecking(false)
    }

    void checkSession()
  }, [forceChange])

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

    // Determine redirect path based on user's role
      let redirectPath = '/auth/login'
    try {
      const { data } = await supabase.auth.getUser()
      if (data.user?.user_metadata?.surface_role === 'coach') {
          redirectPath = '/coach'
        } else if (nextPath && nextPath !== '/dashboard' && nextPath.startsWith('/')) {
          // If explicit next path provided (and it's not default), use it
          redirectPath = nextPath
      }
    } catch {
        // If role detection fails, redirect to login
    }

    setSuccessMessage('✓ Password updated successfully. Redirecting...')
    setLoading(false)
    
    // Brief delay to show success message
    setTimeout(() => {
      router.push(redirectPath)
      router.refresh()
    }, 1000)
  }

  if (isChecking) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <p
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontSize: 14,
            color: 'var(--gray)',
            margin: 0,
          }}
        >
          Verifying your session...
        </p>
      </div>
    )
  }

  if (!isSessionValid && !forceChange) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
        <p
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontSize: 13,
            color: 'var(--error, #ff6b6b)',
            margin: 0,
          }}
        >
          {error}
        </p>
        <a
          href="/auth/login"
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontSize: 13,
            color: 'var(--gold)',
            textDecoration: 'none',
            display: 'inline-block',
            padding: '8px 16px',
            border: '1px solid var(--navy-lt)',
            borderRadius: 2,
          }}
        >
          Go to Login
        </a>
      </div>
    )
  }

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
        {forceChange
          ? 'Update your password to continue accessing your account.'
          : 'Enter your new password below. Make sure it\'s secure and different from your previous password.'}
      </p>

      <div>
        <label htmlFor="new-password" style={labelStyle}>
          New Password
        </label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          required
          style={inputStyle}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </div>

      <div>
        <label htmlFor="confirm-password" style={labelStyle}>
          Confirm Password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
          style={inputStyle}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </div>

      {newPassword && (
        <ul
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontSize: 12,
            color: 'var(--gray)',
            margin: '8px 0',
            paddingLeft: 20,
            listStyle: 'none',
          }}
        >
          <li style={{ marginBottom: 4 }}>
            {newPassword.length >= 8 ? '✓' : '○'} At least 8 characters
          </li>
          <li style={{ marginBottom: 4 }}>
            {/[A-Z]/.test(newPassword) ? '✓' : '○'} One uppercase letter
          </li>
          <li>
            {/[0-9]/.test(newPassword) ? '✓' : '○'} One number
          </li>
        </ul>
      )}

      {error && (
        <p
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontSize: 13,
            color: 'var(--error, #ff6b6b)',
            margin: 0,
            padding: '8px 12px',
            background: 'rgba(255, 107, 107, 0.1)',
            borderRadius: 2,
            border: '1px solid var(--error, #ff6b6b)',
          }}
        >
          {error}
        </p>
      )}

      {successMessage && (
        <p
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontSize: 13,
            color: 'var(--success, #2ecc71)',
            margin: 0,
            padding: '8px 12px',
            background: 'rgba(46, 204, 113, 0.1)',
            borderRadius: 2,
            border: '1px solid var(--success, #2ecc71)',
          }}
        >
          {successMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !newPassword || !confirmPassword}
        style={{
          padding: '13px',
          background:
            loading || !newPassword || !confirmPassword ? 'var(--navy-lt)' : 'var(--gold)',
          color: loading || !newPassword || !confirmPassword ? 'var(--gray)' : '#0D1B2A',
          border: 'none',
          borderRadius: 2,
          fontFamily: 'Bebas Neue, sans-serif',
          fontSize: 18,
          letterSpacing: '0.06em',
          cursor: loading || !newPassword || !confirmPassword ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
      >
        {loading ? '...' : 'Update Password'}
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
