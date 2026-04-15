import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

type RpcRow = {
  allowed: boolean
  remaining: number
  reset_at: string
  current_count: number
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: string
  currentCount: number
}

export function getPositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return parsed
}

export function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  return 'unknown'
}

export async function enforceRateLimit(params: {
  key: string
  limit: number
  windowSeconds: number
  route: string
  dimension: string
}): Promise<RateLimitResult> {
  const admin = supabaseAdmin()
  const { data, error } = await admin.rpc('check_rate_limit', {
    p_key: params.key,
    p_limit: params.limit,
    p_window_seconds: params.windowSeconds,
  })

  if (error || !Array.isArray(data) || data.length === 0) {
    console.error('[rate-limit] rpc failure', {
      route: params.route,
      dimension: params.dimension,
      error: error?.message ?? 'Missing rate limit RPC response',
    })
    return {
      allowed: true,
      remaining: params.limit,
      resetAt: new Date(Date.now() + params.windowSeconds * 1000).toISOString(),
      currentCount: 0,
    }
  }

  const row = data[0] as RpcRow
  if (!row.allowed) {
    console.warn('[rate-limit] blocked', {
      route: params.route,
      dimension: params.dimension,
      key: params.key,
      limit: params.limit,
      currentCount: row.current_count,
      resetAt: row.reset_at,
    })
  }

  return {
    allowed: Boolean(row.allowed),
    remaining: Number(row.remaining ?? 0),
    resetAt: row.reset_at,
    currentCount: Number(row.current_count ?? 0),
  }
}
