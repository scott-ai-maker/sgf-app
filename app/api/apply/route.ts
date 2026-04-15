import { NextRequest, NextResponse } from 'next/server'
import {
  enforceRateLimit,
  getClientIp,
  getPositiveIntEnv,
} from '@/lib/rate-limit'

type ApplyPayload = {
  email?: string
  firstName?: string
  goal?: string
  timeline?: string
  trainingDays?: string
  supportLevel?: string
  primaryObstacle?: string
  coachingHistory?: string
  budgetBand?: string
  readiness?: string
  recommendedTier?: string
}

const REQUIRED_FIELDS: Array<keyof ApplyPayload> = [
  'email',
  'goal',
  'timeline',
  'trainingDays',
  'supportLevel',
  'primaryObstacle',
  'coachingHistory',
  'budgetBand',
  'readiness',
  'recommendedTier',
]

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function retryAfterSeconds(resetAt: string) {
  const ms = new Date(resetAt).getTime() - Date.now()
  return Math.max(1, Math.ceil(ms / 1000))
}

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  try {
    const payload = (await req.json()) as ApplyPayload

    for (const field of REQUIRED_FIELDS) {
      const value = payload[field]
      if (typeof value !== 'string' || value.trim().length === 0) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    const email = payload.email!.toLowerCase().trim()
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const ipLimit = getPositiveIntEnv('RATE_LIMIT_APPLY_IP_LIMIT', 15)
    const ipWindowSeconds = getPositiveIntEnv('RATE_LIMIT_APPLY_IP_WINDOW_SECONDS', 60 * 60)
    const emailLimit = getPositiveIntEnv('RATE_LIMIT_APPLY_EMAIL_LIMIT', 2)
    const emailWindowSeconds = getPositiveIntEnv('RATE_LIMIT_APPLY_EMAIL_WINDOW_SECONDS', 24 * 60 * 60)

    const ip = getClientIp(req)
    const ipResult = await enforceRateLimit({
      key: `apply:ip:${ip}`,
      limit: ipLimit,
      windowSeconds: ipWindowSeconds,
      route: '/api/apply',
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
      key: `apply:email:${email}`,
      limit: emailLimit,
      windowSeconds: emailWindowSeconds,
      route: '/api/apply',
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

    const { supabaseAdmin } = await import('@/lib/supabase')
    const supabase = supabaseAdmin()

    const { error } = await supabase
      .from('coaching_applications')
      .insert({
        email,
        first_name: (payload.firstName ?? '').trim() || null,
        goal: payload.goal,
        timeline: payload.timeline,
        training_days: payload.trainingDays,
        support_level: payload.supportLevel,
        primary_obstacle: payload.primaryObstacle,
        coaching_history: payload.coachingHistory,
        budget_band: payload.budgetBand,
        readiness: payload.readiness,
        recommended_tier: payload.recommendedTier,
        source: 'apply_quiz',
      })

    if (error) throw error

    const { triggerLeadEmailAutomation } = await import('@/lib/marketing-email')
    await triggerLeadEmailAutomation(supabase, {
      email,
      firstName: payload.firstName,
      source: 'apply',
      recommendedTier: payload.recommendedTier,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Apply route error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
