'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

type Mode = 'login' | 'signup'

interface AuthFormProps {
  mode: Mode
  redirectPath?: string
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

export default function AuthForm({ mode, redirectPath = '/dashboard' }: AuthFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

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
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={inputStyle}
            placeholder="••••••••"
          />
        </div>

        {mode === 'login' && (
          <div style={{ textAlign: 'right' }}>
            <a
              href="/auth/reset-password"
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
