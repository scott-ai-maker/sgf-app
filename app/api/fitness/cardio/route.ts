import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  let userId = ''
  try {
    const authz = await getRequestAuthz()
    userId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('cardio_logs')
    .select('*')
    .eq('user_id', userId)
    .order('session_date', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: 'Failed to load cardio logs' }, { status: 500 })
  }

  return NextResponse.json({ logs: data ?? [] })
}

export async function POST(req: NextRequest) {
  let userId = ''
  try {
    const authz = await getRequestAuthz()
    userId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const body = await req.json()

  const sessionDate = String(body.session_date ?? '').trim()
  if (!sessionDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return NextResponse.json({ error: 'session_date must be YYYY-MM-DD' }, { status: 400 })
  }

  const activityType = String(body.activity_type ?? '').trim()
  if (!activityType) {
    return NextResponse.json({ error: 'activity_type is required' }, { status: 400 })
  }

  const durationMins = Number(body.duration_mins)
  if (!Number.isFinite(durationMins) || durationMins < 1) {
    return NextResponse.json({ error: 'duration_mins must be a positive number' }, { status: 400 })
  }

  const perceivedEffort = body.perceived_effort !== undefined ? Number(body.perceived_effort) : null
  if (perceivedEffort !== null && (perceivedEffort < 1 || perceivedEffort > 10)) {
    return NextResponse.json({ error: 'perceived_effort must be 1-10' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('cardio_logs')
    .insert({
      user_id: userId,
      session_date: sessionDate,
      activity_type: activityType,
      duration_mins: durationMins,
      distance_km: body.distance_km !== undefined && body.distance_km !== '' ? Number(body.distance_km) : null,
      avg_heart_rate: body.avg_heart_rate !== undefined && body.avg_heart_rate !== '' ? Number(body.avg_heart_rate) : null,
      calories: body.calories !== undefined && body.calories !== '' ? Number(body.calories) : null,
      perceived_effort: perceivedEffort,
      notes: body.notes !== undefined ? String(body.notes).trim() : null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to log cardio session' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
