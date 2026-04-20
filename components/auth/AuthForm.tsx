'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

type Mode = 'login' | 'signup'

interface AuthFormProps {
  mode: Mode
  redirectPath?: string
}

interface ValidationErrors {
  email?: string
  password?: string
}

function formatAuthErrorMessage(rawMessage: string) {
  const msg = rawMessage.toLowerCase()

  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('over_email_send_rate_limit')) {
    return 'Email rate limit reached. Please wait a minute, then try again. You can also sign in with Google right now.'
  }

  if (msg.includes('unsupported provider') || msg.includes('provider is not enabled')) {
    return 'Google sign-in is not enabled in Supabase yet. Enable Google under Authentication -> Providers in Supabase, or use email/password for now.'
  }

  return rawMessage
}

function validateEmail(email: string): string | undefined {
  if (!email.trim()) {
    return 'Email is required'
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return 'Enter a valid email address'
  }
}

function validatePassword(password: string, mode: Mode): string | undefined {
  if (!password) {
    return 'Password is required'
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters'
  }
  if (mode === 'signup') {
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain an uppercase letter'
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain a number'
    }
  }
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

const errorStyle: React.CSSProperties = {
  border: '1px solid var(--error, #ff6b6b)',
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

const errorMessageStyle: React.CSSProperties = {
  fontFamily: 'Raleway, sans-serif',
  fontSize: 12,
  color: 'var(--error, #ff6b6b)',
  margin: '4px 0 0 0',
}

export default function AuthForm({ mode, redirectPath = '/dashboard' }: AuthFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({})

  function validateForm(): boolean {
    const newErrors: ValidationErrors = {}

    const emailError = validateEmail(email)
    if (emailError) newErrors.email = emailError

    const passwordError = validatePassword(password, mode)
    if (passwordError) newErrors.password = passwordError

    setFieldErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!validateForm()) {
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    setFieldErrors({})

    const supabase = createClient()

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setError(formatAuthErrorMessage(error.message))
        setLoading(false)
        return
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(formatAuthErrorMessage(error.message))
        setLoading(false)
        return
      }
    }

    router.push(redirectPath)
    router.refresh()
  }

  async function handleGoogle() {
    const supabase = createClient()
    setError(null)
    setFieldErrors({})

    const callbackUrl = new URL('/auth/callback', window.location.origin)
    callbackUrl.searchParams.set('next', redirectPath)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })

    if (error) {
      setError(formatAuthErrorMessage(error.message))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label htmlFor="email-input" style={labelStyle}>
            Email Address {fieldErrors.email && '*'}
          </label>
          <input
            id="email-input"
            type="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value)
              if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }))
            }}
            onBlur={() => {
              const error = validateEmail(email)
              if (error) setFieldErrors(prev => ({ ...prev, email: error }))
            }}
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            style={{
              ...inputStyle,
              ...(fieldErrors.email ? errorStyle : {}),
            }}
            placeholder="you@example.com"
          />
          {fieldErrors.email && (
            <div id="email-error" role="alert" style={errorMessageStyle}>
              {fieldErrors.email}
            </div>
          )}
        </div>

        <div>
          <label htmlFor="password-input" style={labelStyle}>
            Password {fieldErrors.password && '*'}
          </label>
          <input
            id="password-input"
            type="password"
            value={password}
            onChange={e => {
              setPassword(e.target.value)
              if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined }))
            }}
            onBlur={() => {
              const error = validatePassword(password, mode)
              if (error) setFieldErrors(prev => ({ ...prev, password: error }))
            }}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            style={{
              ...inputStyle,
              ...(fieldErrors.password ? errorStyle : {}),
            }}
            placeholder="••••••••"
          />
          {fieldErrors.password && (
            <div id="password-error" role="alert" style={errorMessageStyle}>
              {fieldErrors.password}
            </div>
          )}
          {mode === 'signup' && !fieldErrors.password && password && (
            <div style={{ ...errorMessageStyle, color: 'var(--gray)', marginTop: 4 }}>
              ✓ Password meets requirements
            </div>
          )}
        </div>

        {mode === 'login' && (
          <div style={{ textAlign: 'right' }}>
            <a
              href="/auth/login?next=/auth/reset-password"
              style={{
                fontFamily: 'Raleway, sans-serif',
                fontSize: 13,
                color: 'var(--gold)',
                textDecoration: 'none',
              }}
            >
              Forgot password?
            </a>
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              fontFamily: 'Raleway, sans-serif',
              fontSize: 13,
              color: 'var(--error, #ff6b6b)',
              margin: 0,
              padding: '12px',
              background: 'rgba(255, 107, 107, 0.1)',
              borderRadius: 2,
              border: '1px solid var(--error, #ff6b6b)',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || Object.keys(fieldErrors).length > 0}
          style={{
            padding: '13px',
            background: loading || Object.keys(fieldErrors).length > 0 ? 'var(--navy-lt)' : 'var(--gold)',
            color: loading || Object.keys(fieldErrors).length > 0 ? 'var(--gray)' : '#0D1B2A',
            border: 'none',
            borderRadius: 2,
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 18,
            letterSpacing: '0.06em',
            cursor: loading || Object.keys(fieldErrors).length > 0 ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--navy-lt)' }} />
        <span style={{ fontFamily: 'Raleway, sans-serif', fontSize: 12, color: 'var(--gray)' }}>or</span>
        <div style={{ flex: 1, height: 1, background: 'var(--navy-lt)' }} />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        style={{
          padding: '12px',
          background: 'transparent',
          border: '1px solid var(--navy-lt)',
          borderRadius: 2,
          color: 'var(--white)',
          fontFamily: 'Raleway, sans-serif',
          fontWeight: 600,
          fontSize: 14,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </button>

      <p style={{ textAlign: 'center', fontFamily: 'Raleway, sans-serif', fontSize: 14, color: 'var(--gray)', margin: 0 }}>
        {mode === 'login' ? (
          <>
            Don&apos;t have an account?{' '}
            <a href="/auth/signup" style={{ color: 'var(--gold)', textDecoration: 'none' }}>
              Sign up
            </a>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <a href="/auth/login" style={{ color: 'var(--gold)', textDecoration: 'none' }}>
              Sign in
            </a>
          </>
        )}
      </p>
    </div>
  )
}
