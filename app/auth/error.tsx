'use client'

import { useEffect } from 'react'
import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AuthError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Auth error:', error)
  }, [error])

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--navy)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: '500px', textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '48px',
            color: 'var(--gold)',
            letterSpacing: '0.05em',
            marginBottom: '16px',
          }}
        >
          AUTH ERROR
        </h1>
        <p
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontSize: '15px',
            color: 'var(--gray)',
            marginBottom: '32px',
            lineHeight: '1.6',
          }}
        >
          Something went wrong during authentication. Please try again or contact support.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              background: 'var(--gold)',
              color: '#0D1B2A',
              border: 'none',
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: '16px',
              letterSpacing: '0.05em',
              padding: '12px 24px',
              cursor: 'pointer',
              borderRadius: '2px',
            }}
          >
            Try Again
          </button>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              background: 'transparent',
              color: 'var(--gold)',
              border: '1px solid var(--gold)',
              textDecoration: 'none',
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: '16px',
              letterSpacing: '0.05em',
              padding: '12px 24px',
              borderRadius: '2px',
              cursor: 'pointer',
            }}
          >
            Back Home
          </Link>
        </div>
      </div>
    </main>
  )
}
