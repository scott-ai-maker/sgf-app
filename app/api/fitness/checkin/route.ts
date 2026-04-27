import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  let userId = ''
  try {
    const authz = await getRequestAuthz(req)
    userId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('weekly_checkins')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(12)

  if (error) {
    return NextResponse.json({ error: 'Failed to load check-ins' }, { status: 500 })
  }

  return NextResponse.json({ checkins: data ?? [] })
}

export async function POST(req: NextRequest) {
  let userId = ''
  try {
    const authz = await getRequestAuthz(req)
    userId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const body = await req.json()

  const weekStart = String(body.week_start ?? '').trim()
  if (!weekStart.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return NextResponse.json({ error: 'week_start must be a date string (YYYY-MM-DD)' }, { status: 400 })
  }

  const sleepQuality = body.sleep_quality !== undefined ? Number(body.sleep_quality) : null
  const stressLevel = body.stress_level !== undefined ? Number(body.stress_level) : null
  const sorenessLevel = body.soreness_level !== undefined ? Number(body.soreness_level) : null
  const energyLevel = body.energy_level !== undefined ? Number(body.energy_level) : null
  const weightKg = body.weight_kg !== undefined && body.weight_kg !== '' ? Number(body.weight_kg) : null
  const waistCm = body.waist_cm !== undefined && body.waist_cm !== '' ? Number(body.waist_cm) : null
  const hipCm = body.hip_cm !== undefined && body.hip_cm !== '' ? Number(body.hip_cm) : null
  const neckCm = body.neck_cm !== undefined && body.neck_cm !== '' ? Number(body.neck_cm) : null
  const notes = body.notes !== undefined ? String(body.notes).trim() : null

  const payload = {
    user_id: userId,
    week_start: weekStart,
    sleep_quality: sleepQuality,
    stress_level: stressLevel,
    soreness_level: sorenessLevel,
    energy_level: energyLevel,
    weight_kg: weightKg,
    waist_cm: waistCm,
    hip_cm: hipCm,
    neck_cm: neckCm,
    notes,
    updated_at: new Date().toISOString(),
  }

  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('weekly_checkins')
    .upsert(payload, { onConflict: 'user_id,week_start' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save check-in' }, { status: 500 })
  }

  return NextResponse.json(data)
}
