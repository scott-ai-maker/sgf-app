import { NextRequest, NextResponse } from 'next/server'

import { sendWeeklyCheckinNudges } from '@/lib/push-notifications'

function isAuthorized(req: NextRequest) {
  const expected = process.env.INTERNAL_CRON_SECRET?.trim()
  if (!expected) {
    return false
  }

  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  return bearer === expected
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendWeeklyCheckinNudges()
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send weekly check-in nudges'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}