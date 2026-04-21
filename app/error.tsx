'use client'

import { useEffect } from 'react'
import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function RootError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to error reporting service in production
    console.error('Root error:', error)
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
          SOMETHING WENT WRONG
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
          An unexpected error occurred. We&apos;re working to fix it. Try refreshing the page, or go back to{' '}
          <Link href="/" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>
            home
          </Link>
          .
        </p>
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
      </div>
    </main>
  )
}
