'use client'

import { useMemo, useState } from 'react'

export interface WorkoutCalendarEntry {
  date: string
  title: string
  subtitle?: string
}

interface WorkoutCalendarViewProps {
  entries: WorkoutCalendarEntry[]
  title: string
  subtitle?: string
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const [, year, month, day] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addMonths(date: Date, amount: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1))
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function dayNameLabel(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
}

function prettyDate(value: string) {
  const parsed = parseDateOnly(value)
  if (!parsed) return value
  return parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

export default function WorkoutCalendarView({ entries, title, subtitle }: WorkoutCalendarViewProps) {
  const normalizedEntries = useMemo(() => {
    return entries
      .map(entry => ({
        date: entry.date,
        title: String(entry.title ?? '').trim(),
        subtitle: String(entry.subtitle ?? '').trim(),
      }))
      .filter(entry => parseDateOnly(entry.date) && entry.title)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [entries])

  const initialMonth = useMemo(() => {
    const firstDate = normalizedEntries[0]?.date
    const parsed = firstDate ? parseDateOnly(firstDate) : null
    const now = new Date()
    return parsed ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  }, [normalizedEntries])

  const [monthCursor, setMonthCursor] = useState(initialMonth)
  const [selectedDate, setSelectedDate] = useState(normalizedEntries[0]?.date ?? formatDateOnly(initialMonth))

  const entriesByDate = useMemo(() => {
    const map = new Map<string, WorkoutCalendarEntry[]>()
    for (const entry of normalizedEntries) {
      const list = map.get(entry.date) ?? []
      list.push(entry)
      map.set(entry.date, list)
    }
    return map
  }, [normalizedEntries])

  const monthGrid = useMemo(() => {
    const year = monthCursor.getUTCFullYear()
    const month = monthCursor.getUTCMonth()
    const monthStart = new Date(Date.UTC(year, month, 1))
    const monthEnd = new Date(Date.UTC(year, month + 1, 0))

    const leading = (monthStart.getUTCDay() + 6) % 7
    const daysInMonth = monthEnd.getUTCDate()

    const cells: Array<{ date: string; dayNumber: number; inMonth: boolean }> = []

    for (let i = 0; i < leading; i += 1) {
      const prevDate = new Date(Date.UTC(year, month, i - leading + 1))
      cells.push({ date: formatDateOnly(prevDate), dayNumber: prevDate.getUTCDate(), inMonth: false })
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const current = new Date(Date.UTC(year, month, day))
      cells.push({ date: formatDateOnly(current), dayNumber: day, inMonth: true })
    }

    while (cells.length % 7 !== 0) {
      const nextIndex = cells.length - (leading + daysInMonth) + 1
      const nextDate = new Date(Date.UTC(year, month + 1, nextIndex))
      cells.push({ date: formatDateOnly(nextDate), dayNumber: nextDate.getUTCDate(), inMonth: false })
    }

    return cells
  }, [monthCursor])

  const selectedEntries = entriesByDate.get(selectedDate) ?? []

  return (
    <section style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 18 }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 28 }}>{title}</h2>
        {subtitle && <p style={{ color: 'var(--gray)', margin: '6px 0 0', fontSize: 14 }}>{subtitle}</p>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button type="button" onClick={() => setMonthCursor(prev => addMonths(prev, -1))} style={monthButtonStyle}>
          Prev
        </button>
        <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, letterSpacing: '0.05em' }}>{monthLabel(monthCursor)}</div>
        <button type="button" onClick={() => setMonthCursor(prev => addMonths(prev, 1))} style={monthButtonStyle}>
          Next
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
        {Array.from({ length: 7 }).map((_, index) => {
          const day = new Date(Date.UTC(2026, 0, index + 5))
          return (
            <div key={index} style={{ textAlign: 'center', color: 'var(--gray)', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {dayNameLabel(day)}
            </div>
          )
        })}

        {monthGrid.map(cell => {
          const count = entriesByDate.get(cell.date)?.length ?? 0
          const isSelected = selectedDate === cell.date

          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => setSelectedDate(cell.date)}
              style={{
                border: isSelected ? '1px solid var(--gold)' : '1px solid rgba(255,255,255,0.08)',
                background: cell.inMonth ? 'var(--navy)' : 'rgba(13,27,42,0.45)',
                color: cell.inMonth ? 'var(--white)' : 'var(--gray)',
                minHeight: 66,
                padding: '6px 6px 4px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600 }}>{cell.dayNumber}</div>
              {count > 0 && (
                <div style={{ marginTop: 6 }}>
                  <span style={{
                    border: '1px solid rgba(212,160,23,0.28)',
                    background: 'rgba(212,160,23,0.14)',
                    color: 'var(--gold)',
                    padding: '2px 6px',
                    fontSize: 11,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}>
                    {count} session{count > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
        <p style={{ margin: 0, color: 'var(--gray)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {prettyDate(selectedDate)}
        </p>
        {selectedEntries.length === 0 ? (
          <p style={{ margin: '8px 0 0', color: 'var(--gray)', fontSize: 14 }}>No scheduled workouts for this day.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {selectedEntries.map((entry, index) => (
              <div key={`${entry.date}-${entry.title}-${index}`} style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'var(--navy)', padding: '10px 12px' }}>
                <div style={{ color: 'var(--white)', fontWeight: 600 }}>{entry.title}</div>
                {entry.subtitle && <div style={{ color: 'var(--gray)', fontSize: 13, marginTop: 3 }}>{entry.subtitle}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

const monthButtonStyle: React.CSSProperties = {
  border: '1px solid var(--navy-lt)',
  background: 'transparent',
  color: 'var(--white)',
  padding: '7px 10px',
  fontSize: 12,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}