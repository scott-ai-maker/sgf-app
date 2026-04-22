import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'

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

  const exerciseName = String(body.exercise_name ?? '').trim()
  if (!exerciseName) {
    return NextResponse.json({ error: 'exercise_name is required' }, { status: 400 })
  }

  const sessionDate = String(body.session_date ?? '').trim()
  if (!sessionDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return NextResponse.json({ error: 'session_date must be YYYY-MM-DD' }, { status: 400 })
  }

  const validReasons = ['no_equipment', 'injury', 'time', 'other']
  const reason = body.reason ? String(body.reason).trim() : 'other'
  if (!validReasons.includes(reason)) {
    return NextResponse.json({ error: 'reason must be one of: no_equipment, injury, time, other' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('exercise_skips')
    .insert({
      user_id: userId,
      session_date: sessionDate,
      exercise_name: exerciseName,
      workout_day: body.workout_day !== undefined ? Number(body.workout_day) : null,
      reason,
      notes: body.notes !== undefined ? String(body.notes).trim() : null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to log exercise skip' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
