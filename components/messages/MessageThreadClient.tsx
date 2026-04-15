'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

interface Message {
  id: string
  client_id: string
  coach_id: string
  sender_id: string
  message_body: string
  created_at: string
}

interface MessageThreadClientProps {
  currentUserId: string
  role: 'client' | 'coach'
  clientId?: string
}

export default function MessageThreadClient({ currentUserId, role, clientId }: MessageThreadClientProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const query = useMemo(() => {
    if (role === 'coach' && clientId) return `?clientId=${encodeURIComponent(clientId)}`
    return ''
  }, [role, clientId])

  const loadMessages = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/messages${query}`)
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus(payload.error ?? 'Failed to load messages')
        return
      }
      setMessages(payload.messages ?? [])
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return

    setStatus(null)
    const body = role === 'coach' ? { message, clientId } : { message }

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      setStatus(payload.error ?? 'Failed to send message')
      return
    }

    setMessage('')
    setMessages(prev => [...prev, payload.message])
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div
        style={{
          border: '1px solid var(--navy-lt)',
          background: 'var(--navy-mid)',
          minHeight: 260,
          maxHeight: 420,
          overflowY: 'auto',
          padding: 12,
          display: 'grid',
          gap: 8,
        }}
      >
        {loading && messages.length === 0 && (
          <p style={{ margin: 0, color: 'var(--gray)', fontFamily: 'Raleway, sans-serif' }}>Loading messages...</p>
        )}

        {!loading && messages.length === 0 && (
          <p style={{ margin: 0, color: 'var(--gray)', fontFamily: 'Raleway, sans-serif' }}>
            No messages yet. Start the conversation.
          </p>
        )}

        {messages.map(msg => {
          const mine = msg.sender_id === currentUserId
          return (
            <div
              key={msg.id}
              style={{
                justifySelf: mine ? 'end' : 'start',
                maxWidth: '80%',
                background: mine ? 'var(--gold)' : 'var(--navy)',
                color: mine ? '#0D1B2A' : 'var(--white)',
                border: '1px solid var(--navy-lt)',
                padding: '8px 10px',
              }}
            >
              <p style={{ margin: 0, fontFamily: 'Raleway, sans-serif', fontSize: 14 }}>{msg.message_body}</p>
              <p style={{ margin: '4px 0 0 0', fontFamily: 'Raleway, sans-serif', fontSize: 11, opacity: 0.75 }}>
                {new Date(msg.created_at).toLocaleString()}
              </p>
            </div>
          )
        })}
      </div>

      <form onSubmit={sendMessage} style={{ display: 'grid', gap: 8 }}>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={role === 'coach' ? 'Message your client...' : 'Message your trainer...'}
          style={{
            width: '100%',
            minHeight: 86,
            padding: '10px 12px',
            border: '1px solid var(--navy-lt)',
            background: 'var(--navy-mid)',
            color: 'var(--white)',
            fontFamily: 'Raleway, sans-serif',
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          style={{
            border: 0,
            background: 'var(--gold)',
            color: '#0D1B2A',
            padding: '10px 14px',
            fontFamily: 'Bebas Neue, sans-serif',
            letterSpacing: '0.08em',
            fontSize: 18,
            cursor: 'pointer',
            justifySelf: 'start',
          }}
        >
          Send
        </button>
      </form>

      {status && <p style={{ margin: 0, color: 'var(--error)' }}>{status}</p>}
    </section>
  )
}
