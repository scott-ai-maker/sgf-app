import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, requireRole, AuthzError } from '@/lib/authz'

// Returns available 1-hour slots for the next 14 days.
// Business hours (America/New_York):
//   Mon–Fri: 6am–7pm  (slots start on the hour from 6am through 6pm)
//   Saturday: 8am–2pm (slots start on the hour from 8am through 1pm)
//   Sunday: closed

function generateSlots(now: Date): { date: string; time: string; datetime: string }[] {
  const slots: { date: string; time: string; datetime: string }[] = []

  const nyWeekdayFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
  })
  const nyHourFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    hour12: false,
  })
  const nyDateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  // Start from the next whole hour
  const cursor = new Date(now)
  cursor.setMinutes(0, 0, 0)
  cursor.setTime(cursor.getTime() + 3_600_000)

  const limit = new Date(now)
  limit.setDate(limit.getDate() + 14)

  const dayIndex: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  while (cursor <= limit) {
    const weekday = nyWeekdayFmt.format(cursor)
    const dayNum = dayIndex[weekday] ?? -1
    const nyHour = parseInt(nyHourFmt.format(cursor), 10)

    let valid = false
    if (dayNum >= 1 && dayNum <= 5) {
      valid = nyHour >= 6 && nyHour < 19 // 6am–6pm start (ends by 7pm)
    } else if (dayNum === 6) {
      valid = nyHour >= 8 && nyHour < 14 // 8am–1pm start (ends by 2pm)
    }

    if (valid) {
      const dateStr = nyDateFmt.format(cursor) // YYYY-MM-DD
      const h = nyHour % 12 || 12
      const ampm = nyHour < 12 ? 'AM' : 'PM'
      slots.push({
        date: dateStr,
        time: `${h}:00 ${ampm}`,
        datetime: cursor.toISOString(),
      })
    }

    cursor.setTime(cursor.getTime() + 3_600_000)
  }

  return slots
}

export async function GET(req: NextRequest) {
  try {
    const authz = await getRequestAuthz(req)
    requireRole(authz.client.role, ['client'])
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const { supabaseAdmin } = await import('@/lib/supabase')

  const now = new Date()
  const twoWeeksOut = new Date(now)
  twoWeeksOut.setDate(twoWeeksOut.getDate() + 14)

  const { data: booked } = await supabaseAdmin()
    .from('sessions')
    .select('scheduled_at')
    .eq('status', 'scheduled')
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', twoWeeksOut.toISOString())

  // Normalize booked times to "YYYY-MM-DDTHH:MM" for comparison
  const bookedTimes = new Set(
    (booked ?? []).map(s => s.scheduled_at.substring(0, 16))
  )

  const slots = generateSlots(now).filter(
    s => !bookedTimes.has(s.datetime.substring(0, 16))
  )

  return NextResponse.json(slots)
}
