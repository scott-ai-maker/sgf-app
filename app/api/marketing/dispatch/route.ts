import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const secret = process.env.MARKETING_CRON_SECRET
  const headerSecret = req.headers.get('x-marketing-cron-secret')

  if (!secret || headerSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { supabaseAdmin } = await import('@/lib/supabase')
    const { dispatchPendingSequenceEmails } = await import('@/lib/marketing-email')

    const result = await dispatchPendingSequenceEmails(supabaseAdmin())

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Marketing dispatch error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
