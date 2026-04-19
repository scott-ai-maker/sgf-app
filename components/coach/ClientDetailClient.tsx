'use client'

import { useRouter } from 'next/navigation'
import SessionActions from '@/components/coach/SessionActions'

interface Session {
  id: string
  scheduled_at: string
  status: string
  notes: string | null
  duration_mins: number
  checked_in_at?: string | null
  checked_out_at?: string | null
}

interface ClientDetailClientProps {
  sessions: Session[]
}

export default function ClientDetailClient({ sessions }: ClientDetailClientProps) {
  const router = useRouter()

  function handleUpdate() {
    router.refresh()
  }

  function statusBadge(status: string) {
    const colors: Record<string, { bg: string; color: string }> = {
      scheduled: { bg: 'rgba(212,160,23,0.15)', color: 'var(--gold)' },
      completed: { bg: 'rgba(72,187,120,0.15)', color: 'var(--success)' },
      cancelled: { bg: 'rgba(138,153,170,0.15)', color: 'var(--gray)' },
      no_show: { bg: 'rgba(255,61,87,0.15)', color: 'var(--error)' },
    }
    const style = colors[status] ?? colors.scheduled
    return (
      <span
        style={{
          fontFamily: 'Raleway, sans-serif',
          fontWeight: 600,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          padding: '3px 8px',
          borderRadius: 2,
          background: style.bg,
          color: style.color,
        }}
      >
        {status.replace('_', ' ')}
      </span>
    )
  }

  if (sessions.length === 0) {
    return (
      <div
        style={{
          background: 'var(--navy-mid)',
          border: '1px solid var(--navy-lt)',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 15, color: 'var(--gray)', margin: 0 }}>
          No sessions yet.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(255,255,255,0.06)' }}>
      {sessions.map(session => (
        <div
          key={session.id}
          className="coach-session-card"
          style={{
            background: 'var(--navy-mid)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div
            className="coach-session-card-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 600,
                  fontSize: 15,
                  color: 'var(--white)',
                }}
              >
                {new Date(session.scheduled_at).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
              <div
                style={{
                  fontFamily: 'Raleway, sans-serif',
                  fontSize: 13,
                  color: 'var(--gray)',
                  marginTop: 2,
                  overflowWrap: 'anywhere',
                }}
              >
                {new Date(session.scheduled_at).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZoneName: 'short',
                })}{' '}
                · {session.duration_mins} min
              </div>
            </div>
            {statusBadge(session.status)}
          </div>

          <SessionActions
            sessionId={session.id}
            currentStatus={session.status}
            currentNotes={session.notes}
            checkedInAt={session.checked_in_at}
            checkedOutAt={session.checked_out_at}
            onUpdate={handleUpdate}
          />
        </div>
      ))}
    </div>
  )
}
