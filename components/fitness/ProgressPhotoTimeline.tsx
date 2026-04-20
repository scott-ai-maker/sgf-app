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
  bodyFatInputs?: {
    sex?: 'male' | 'female' | 'other'
    heightCm?: number
    weightKg?: number
    waistCm?: number
    neckCm?: number
    hipCm?: number
  }
  onEstimatedBodyfat?: (value: number) => void
  estimatedBodyfat?: string | null
}

export default function ProgressPhotoTimeline({
  initialPhotos,
  canUpload = false,
  title = 'Progress Photos',
  subtitle = 'Keep a dated visual timeline so you and your coach can compare changes over time.',
  bodyFatInputs,
  onEstimatedBodyfat,
  estimatedBodyfat,
}: ProgressPhotoTimelineProps) {
  const [photos, setPhotos] = useState<ProgressPhoto[]>(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [bodyFatStatus, setBodyFatStatus] = useState<string | null>(null)
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

  async function handleEstimateBodyFat() {
    if (!bodyFatInputs) return

    setEstimating(true)
    setBodyFatStatus(null)

    let photoDataUrl: string | undefined
    if (form.file) {
      photoDataUrl = await fileToDataUrl(form.file)
    }

    const res = await fetch('/api/fitness/bodyfat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sex: bodyFatInputs.sex,
        heightCm: bodyFatInputs.heightCm,
        weightKg: bodyFatInputs.weightKg,
        waistCm: bodyFatInputs.waistCm,
        neckCm: bodyFatInputs.neckCm,
        hipCm: bodyFatInputs.hipCm,
        photoDataUrl,
      }),
    })

    const payload = await res.json()
    setEstimating(false)

    if (!res.ok) {
      setBodyFatStatus(payload.error ?? 'Could not estimate body fat')
      return
    }

    const estimated = Number(payload.analysis?.estimated_bodyfat_percent)
    if (Number.isFinite(estimated)) {
      onEstimatedBodyfat?.(estimated)
      setBodyFatStatus(`Approximate estimate: ${estimated}% body fat`)
      return
    }

    setBodyFatStatus('Body-fat estimate returned, but value was invalid.')
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

          {bodyFatInputs && (
            <>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, marginTop: 2 }}>
                <p style={{ margin: '0 0 8px', color: 'var(--gray)', fontSize: 12, lineHeight: 1.5 }}>
                  Body-fat check is an approximation, not a diagnostic measurement.
                </p>
                <button type="button" onClick={() => void handleEstimateBodyFat()} disabled={estimating} style={buttonStyle}>
                  {estimating ? 'Estimating...' : 'Estimate Body Fat (Approx)'}
                </button>
                <p style={{ margin: '8px 0 0', color: 'var(--gray)', fontSize: 12 }}>
                  {estimatedBodyfat ? `Current approximate estimate: ${estimatedBodyfat}%` : 'No estimate yet.'}
                </p>
                {bodyFatStatus && (
                  <p style={{ margin: '8px 0 0', color: bodyFatStatus.toLowerCase().includes('could not') || bodyFatStatus.toLowerCase().includes('invalid') ? 'var(--error)' : 'var(--success)' }}>
                    {bodyFatStatus}
                  </p>
                )}
              </div>
            </>
          )}
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

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
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