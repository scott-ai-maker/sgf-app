'use client'

import { useState } from 'react'

interface CoachInviteLinkCardProps {
  invitePath: string
}

export default function CoachInviteLinkCard({ invitePath }: CoachInviteLinkCardProps) {
  const [status, setStatus] = useState<string | null>(null)

  async function handleCopy() {
    const inviteUrl =
      typeof window === 'undefined' ? invitePath : new URL(invitePath, window.location.origin).toString()

    try {
      await navigator.clipboard.writeText(inviteUrl)
      setStatus('Invite link copied.')
    } catch {
      setStatus('Could not copy automatically. Use the link field below.')
    }
  }

  return (
    <section
      style={{
        display: 'grid',
        gap: 14,
        padding: 20,
        marginBottom: 24,
        border: '1px solid rgba(212,160,23,0.28)',
        background:
          'linear-gradient(135deg, rgba(212,160,23,0.12), rgba(28,52,80,0.52) 42%, rgba(13,27,42,0.95))',
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 24,
            letterSpacing: '0.06em',
            color: 'var(--gold-lt)',
          }}
        >
          NEW CLIENT INVITE
        </h2>
        <p
          style={{
            margin: 0,
            fontFamily: 'Raleway, sans-serif',
            fontSize: 13,
            color: 'var(--white)',
            lineHeight: 1.5,
            maxWidth: 680,
          }}
        >
          Use this signup link when a client is with you in person. Their new account will land in your roster automatically.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <input
          type="text"
          readOnly
          value={invitePath}
          aria-label="New client invitation link"
          style={{
            width: '100%',
            padding: '12px 14px',
            background: 'rgba(13,27,42,0.9)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--white)',
            fontFamily: 'Raleway, sans-serif',
            fontSize: 13,
          }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              padding: '10px 14px',
              border: 'none',
              background: 'var(--gold)',
              color: 'var(--navy)',
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 16,
              letterSpacing: '0.06em',
              cursor: 'pointer',
            }}
          >
            Copy Link
          </button>
          <a
            href={invitePath}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '10px 14px',
              border: '1px solid rgba(255,255,255,0.16)',
              color: 'var(--white)',
              textDecoration: 'none',
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Open Signup
          </a>
          <span style={{ fontFamily: 'Raleway, sans-serif', fontSize: 12, color: status ? 'var(--gold-lt)' : 'var(--gray)' }}>
            {status ?? 'Share by text, email, or open it directly during intake.'}
          </span>
        </div>
      </div>
    </section>
  )
}