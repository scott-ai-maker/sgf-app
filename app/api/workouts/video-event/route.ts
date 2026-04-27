import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestAuthz, requireRole, AuthzError } from '@/lib/authz'

type EventType = 'started' | 'completed'

function isEventType(value: unknown): value is EventType {
  return value === 'started' || value === 'completed'
}

export async function POST(req: NextRequest) {
  let userId = ''
  try {
    const authz = await getRequestAuthz(req)
    requireRole(authz.client.role, ['client'])
    userId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const body = await req.json().catch(() => ({}))

  const eventType = body.eventType
  const exerciseName = String(body.exerciseName ?? '').trim()
  const videoUrl = String(body.videoUrl ?? '').trim()
  const workoutPlanId = String(body.workoutPlanId ?? '').trim() || null
  const watchSecondsValue = body.watchSeconds == null ? null : Number(body.watchSeconds)

  if (!exerciseName || !videoUrl || !isEventType(eventType)) {
    return NextResponse.json({ error: 'exerciseName, videoUrl, and valid eventType are required' }, { status: 400 })
  }

  if (watchSecondsValue != null && (!Number.isFinite(watchSecondsValue) || watchSecondsValue < 0)) {
    return NextResponse.json({ error: 'watchSeconds must be a non-negative number' }, { status: 400 })
  }

  if (workoutPlanId) {
    const { data: plan, error: planError } = await supabaseAdmin()
      .from('workout_plans')
      .select('id')
      .eq('id', workoutPlanId)
      .eq('user_id', userId)
      .maybeSingle()

    if (planError) {
      return NextResponse.json({ error: planError.message }, { status: 500 })
    }

    if (!plan) {
      return NextResponse.json({ error: 'Workout plan not found for this client' }, { status: 403 })
    }
  }

  const metadata =
    body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata
      : {}

  const payload = {
    user_id: userId,
    workout_plan_id: workoutPlanId,
    exercise_name: exerciseName,
    video_url: videoUrl,
    event_type: eventType,
    watch_seconds: watchSecondsValue,
    metadata_json: metadata,
  }

  const { data, error } = await supabaseAdmin()
    .from('workout_video_events')
    .insert(payload)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ event: data })
}
