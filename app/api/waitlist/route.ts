import { NextRequest, NextResponse } from 'next/server'
import {
  enforceRateLimit,
  getClientIp,
  getPositiveIntEnv,
} from '@/lib/rate-limit'

function retryAfterSeconds(resetAt: string) {
  const ms = new Date(resetAt).getTime() - Date.now()
  return Math.max(1, Math.ceil(ms / 1000))
}

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  try {
    const { supabaseAdmin } = await import('@/lib/supabase')
    const { triggerLeadEmailAutomation } = await import('@/lib/marketing-email')
    const { email } = await req.json()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const ipLimit = getPositiveIntEnv('RATE_LIMIT_WAITLIST_IP_LIMIT', 20)
    const ipWindowSeconds = getPositiveIntEnv('RATE_LIMIT_WAITLIST_IP_WINDOW_SECONDS', 60 * 60)
    const emailLimit = getPositiveIntEnv('RATE_LIMIT_WAITLIST_EMAIL_LIMIT', 3)
    const emailWindowSeconds = getPositiveIntEnv('RATE_LIMIT_WAITLIST_EMAIL_WINDOW_SECONDS', 24 * 60 * 60)

    const ip = getClientIp(req)
    const ipResult = await enforceRateLimit({
      key: `waitlist:ip:${ip}`,
      limit: ipLimit,
      windowSeconds: ipWindowSeconds,
      route: '/api/waitlist',
      dimension: 'ip',
    })

    if (!ipResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds(ipResult.resetAt)),
          },
        }
      )
    }

    const emailResult = await enforceRateLimit({
      key: `waitlist:email:${normalizedEmail}`,
      limit: emailLimit,
      windowSeconds: emailWindowSeconds,
      route: '/api/waitlist',
      dimension: 'email',
    })

    if (!emailResult.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts for this email. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfterSeconds(emailResult.resetAt)),
          },
        }
      )
    }

    const supabase = supabaseAdmin()

    const { error } = await supabase
      .from('waitlist')
      .insert({ email: normalizedEmail })

    if (error && error.code !== '23505') throw error

    // Avoid repeated confirmation/sequence spam for duplicate waitlist submissions.
    if (!error) {
      await triggerLeadEmailAutomation(supabase, {
        email: normalizedEmail,
        source: 'waitlist',
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Waitlist error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
