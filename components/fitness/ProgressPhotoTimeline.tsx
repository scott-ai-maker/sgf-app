'use client'

import { useState } from 'react'
import Image from 'next/image'

interface ProgressPhoto {
  id: string
  photo_url: string
  taken_at: string
  notes?: string | null
  created_at?: string | null
}

interface ProgressPhotoTimelineProps {
  initialPhotos: ProgressPhoto[]
  canUpload?: boolean
  title?: string
  subtitle?: string
}

export default function ProgressPhotoTimeline({
  initialPhotos,
  canUpload = false,
  title = 'Progress Photos',
  subtitle = 'Keep a dated visual timeline so you and your coach can compare changes over time.',
}: ProgressPhotoTimelineProps) {
  const [photos, setPhotos] = useState<ProgressPhoto[]>(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [form, setForm] = useState({ takenAt: new Date().toISOString().slice(0, 10), notes: '', file: null as File | null })

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.file) {
      setStatus('Select a photo first.')
      return
    }

    setUploading(true)
    setStatus(null)

    const body = new FormData()
    body.append('photo', form.file)
    body.append('taken_at', form.takenAt)
    body.append('notes', form.notes)

    const res = await fetch('/api/fitness/progress-photos', {
      method: 'POST',
      body,
    })

    const payload = await res.json()
    setUploading(false)

    if (!res.ok) {
      setStatus(payload.error ?? 'Could not upload progress photo')
      return
    }

    setPhotos(prev => [payload.photo as ProgressPhoto, ...prev])
    setForm({ takenAt: new Date().toISOString().slice(0, 10), notes: '', file: null })
    setStatus('Progress photo saved.')
  }

  return (
    <section style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18 }}>
      <h2 style={{ margin: '0 0 8px', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 28 }}>{title}</h2>
      <p style={{ margin: '0 0 14px', color: 'var(--gray)', fontSize: 14 }}>{subtitle}</p>

      {canUpload && (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10, marginBottom: 16, border: '1px solid rgba(255,255,255,0.08)', padding: 12, background: 'rgba(13,27,42,0.55)' }}>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={event => setForm(prev => ({ ...prev, file: event.target.files?.[0] ?? null }))}
            style={{ color: 'var(--white)' }}
          />
          <input
            type="date"
            value={form.takenAt}
            onChange={event => setForm(prev => ({ ...prev, takenAt: event.target.value }))}
            style={inputStyle}
            required
          />
          <textarea
            value={form.notes}
            onChange={event => setForm(prev => ({ ...prev, notes: event.target.value }))}
            rows={2}
            placeholder="Optional notes: lighting, weight, how you felt, etc."
            style={{ ...inputStyle, minHeight: 70 }}
          />
          <button type="submit" disabled={uploading} style={buttonStyle}>
            {uploading ? 'Uploading...' : 'Save Progress Photo'}
          </button>
        </form>
      )}

      {status && <p style={{ margin: '0 0 12px', color: status.toLowerCase().includes('could') || status.toLowerCase().includes('select') ? 'var(--error)' : 'var(--success)' }}>{status}</p>}

      {photos.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--gray)' }}>No progress photos saved yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          {photos.map(photo => (
            <article key={photo.id} style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy)', padding: 10 }}>
              <Image
                src={photo.photo_url}
                alt={`Progress photo from ${photo.taken_at}`}
                width={360}
                height={480}
                unoptimized
                style={{ width: '100%', height: 'auto', border: '1px solid rgba(255,255,255,0.08)', display: 'block' }}
              />
              <p style={{ margin: '10px 0 4px', color: 'var(--gold)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{new Date(`${photo.taken_at}T12:00:00Z`).toLocaleDateString()}</p>
              <p style={{ margin: 0, color: 'var(--gray)', fontSize: 13, lineHeight: 1.5 }}>{photo.notes?.trim() ? photo.notes : 'No notes added.'}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--navy)',
  border: '1px solid var(--navy-lt)',
  color: 'var(--white)',
  fontFamily: 'Raleway, sans-serif',
  fontSize: 14,
  boxSizing: 'border-box',
}

const buttonStyle: React.CSSProperties = {
  padding: '10px 14px',
  background: 'var(--gold)',
  color: '#0D1B2A',
  border: 'none',
  fontFamily: 'Bebas Neue, sans-serif',
  fontSize: 16,
  letterSpacing: '0.06em',
  cursor: 'pointer',
}