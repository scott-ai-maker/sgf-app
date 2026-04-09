'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Slot {
  date: string
  time: string
  datetime: string
}

interface Package {
  id: string
  package_name: string
  sessions_remaining: number
}

interface SlotPickerProps {
  packages: Package[]
}

export default function SlotPicker({ packages }: SlotPickerProps) {
  const router = useRouter()
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [selectedPackageId, setSelectedPackageId] = useState(packages[0]?.id ?? '')
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSlots = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/sessions/available')
    if (res.ok) {
      const data = await res.json()
      setSlots(data)
      if (data.length > 0 && !selectedDate) {
        setSelectedDate(data[0].date)
      }
    }
    setLoading(false)
  }, [selectedDate])

  useEffect(() => {
    fetchSlots()
  }, [fetchSlots])

  const availableDates = [...new Set(slots.map(s => s.date))]
  const slotsForDate = selectedDate
    ? slots.filter(s => s.date === selectedDate)
    : []

  async function handleBook() {
    if (!selectedSlot || !selectedPackageId) return
    setBooking(true)
    setError(null)

    const res = await fetch('/api/sessions/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packageId: selectedPackageId,
        scheduledAt: selectedSlot.datetime,
      }),
    })

    if (res.ok) {
      router.push('/dashboard')
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to book session. Please try again.')
      setBooking(false)
    }
  }

  function formatDateLabel(dateStr: string) {
    const d = new Date(dateStr + 'T12:00:00') // noon to avoid TZ shift
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 15, color: 'var(--gray)' }}>
        Loading available slots...
      </p>
    )
  }

  if (slots.length === 0) {
    return (
      <div
        style={{
          background: 'var(--navy-mid)',
          border: '1px solid var(--navy-lt)',
          padding: 32,
          textAlign: 'center',
        }}
      >
        <p style={{ fontFamily: 'Raleway, sans-serif', fontSize: 15, color: 'var(--gray)', margin: 0 }}>
          No available slots in the next 14 days. Please check back soon.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Package selector */}
      {packages.length > 1 && (
        <div>
          <label
            style={{
              display: 'block',
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 600,
              fontSize: 12,
              color: 'var(--gray)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 10,
            }}
          >
            Use sessions from
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(255,255,255,0.06)' }}>
            {packages.map(pkg => (
              <button
                key={pkg.id}
                onClick={() => setSelectedPackageId(pkg.id)}
                style={{
                  background: selectedPackageId === pkg.id ? 'var(--navy-lt)' : 'var(--navy-mid)',
                  border: 'none',
                  padding: '14px 20px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Raleway, sans-serif',
                    fontWeight: 600,
                    fontSize: 14,
                    color: 'var(--white)',
                  }}
                >
                  {pkg.package_name}
                </span>
                <span
                  style={{
                    fontFamily: 'Raleway, sans-serif',
                    fontSize: 13,
                    color: 'var(--gray)',
                  }}
                >
                  {pkg.sessions_remaining} remaining
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date picker */}
      <div>
        <p
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontWeight: 600,
            fontSize: 12,
            color: 'var(--gray)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 10,
          }}
        >
          Select Date
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 1,
            background: 'rgba(255,255,255,0.06)',
          }}
        >
          {availableDates.map(date => (
            <button
              key={date}
              onClick={() => {
                setSelectedDate(date)
                setSelectedSlot(null)
              }}
              style={{
                background: selectedDate === date ? 'var(--gold)' : 'var(--navy-mid)',
                border: 'none',
                padding: '12px 6px',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 600,
                  fontSize: 12,
                  color: selectedDate === date ? '#0D1B2A' : 'var(--white)',
                  display: 'block',
                }}
              >
                {formatDateLabel(date)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div>
          <p
            style={{
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 600,
              fontSize: 12,
              color: 'var(--gray)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 10,
            }}
          >
            Select Time
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1,
              background: 'rgba(255,255,255,0.06)',
            }}
          >
            {slotsForDate.map(slot => (
              <button
                key={slot.datetime}
                onClick={() => setSelectedSlot(slot)}
                style={{
                  background: selectedSlot?.datetime === slot.datetime ? 'var(--gold)' : 'var(--navy-mid)',
                  border: 'none',
                  padding: '14px',
                  cursor: 'pointer',
                  fontFamily: 'Raleway, sans-serif',
                  fontWeight: 600,
                  fontSize: 14,
                  color: selectedSlot?.datetime === slot.datetime ? '#0D1B2A' : 'var(--white)',
                }}
              >
                {slot.time}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Confirm */}
      {selectedSlot && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              background: 'var(--navy-mid)',
              border: '1px solid var(--navy-lt)',
              padding: '16px 20px',
              borderLeft: '3px solid var(--gold)',
            }}
          >
            <p
              style={{
                fontFamily: 'Raleway, sans-serif',
                fontWeight: 600,
                fontSize: 14,
                color: 'var(--white)',
                margin: 0,
              }}
            >
              {formatDateLabel(selectedSlot.date)} at {selectedSlot.time} ET
            </p>
            <p
              style={{
                fontFamily: 'Raleway, sans-serif',
                fontSize: 13,
                color: 'var(--gray)',
                margin: '4px 0 0',
              }}
            >
              60-minute session
            </p>
          </div>

          {error && (
            <p
              style={{
                fontFamily: 'Raleway, sans-serif',
                fontSize: 13,
                color: 'var(--error)',
                margin: 0,
              }}
            >
              {error}
            </p>
          )}

          <button
            onClick={handleBook}
            disabled={booking}
            style={{
              padding: '14px',
              background: booking ? 'var(--navy-lt)' : 'var(--gold)',
              color: booking ? 'var(--gray)' : '#0D1B2A',
              border: 'none',
              borderRadius: 2,
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 20,
              letterSpacing: '0.06em',
              cursor: booking ? 'not-allowed' : 'pointer',
            }}
          >
            {booking ? '...' : 'Confirm Booking'}
          </button>
        </div>
      )}
    </div>
  )
}
