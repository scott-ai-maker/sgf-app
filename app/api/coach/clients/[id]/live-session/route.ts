import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, requireRole, requireCoachAssignedClient, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'

// POST - log a set on behalf of a client during a live session
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let coachId = ''
  try {
    const authz = await getRequestAuthz(req)
    requireRole(authz.client.role, ['coach'])
    coachId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const { id: clientId } = await params

  try {
    await requireCoachAssignedClient(coachId, clientId)
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Forbidden'
    return NextResponse.json({ error: message }, { status })
  }

  const body = await req.json()

  const exerciseName = String(body.exercise_name ?? '').trim()
  if (!exerciseName) {
    return NextResponse.json({ error: 'exercise_name is required' }, { status: 400 })
  }

  const reps = Number(body.reps)
  if (!Number.isFinite(reps) || reps < 1) {
    return NextResponse.json({ error: 'reps must be a positive number' }, { status: 400 })
  }

  const sessionDate = String(body.session_date ?? new Date().toISOString().slice(0, 10)).trim()

  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('workout_set_logs')
    .insert({
      user_id: clientId,
      session_date: sessionDate,
      exercise_name: exerciseName,
      set_number: body.set_number !== undefined ? Number(body.set_number) : null,
      reps,
      weight_kg: body.weight_kg !== undefined && body.weight_kg !== '' ? Number(body.weight_kg) : null,
      rest_seconds: body.rest_seconds !== undefined ? Number(body.rest_seconds) : null,
      rpe: body.rpe !== undefined && body.rpe !== '' ? Number(body.rpe) : null,
      rir: body.rir !== undefined && body.rir !== '' ? Number(body.rir) : null,
      is_warmup: Boolean(body.is_warmup),
      notes: body.notes !== undefined ? String(body.notes).trim() : null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to log set' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// GET - fetch recent set logs for a client (for live session display)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let coachId = ''
  try {
    const authz = await getRequestAuthz(req)
    requireRole(authz.client.role, ['coach'])
    coachId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const { id: clientId } = await params

  try {
    await requireCoachAssignedClient(coachId, clientId)
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Forbidden'
    return NextResponse.json({ error: message }, { status })
  }

  const admin = supabaseAdmin()

  // Get today's set logs for this client
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await admin
    .from('workout_set_logs')
    .select('*')
    .eq('user_id', clientId)
    .eq('session_date', today)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to load sets' }, { status: 500 })
  }

  // Also get the client's active workout plan
  const { data: plan } = await admin
    .from('workout_plans')
    .select('id, name, plan_json')
    .eq('user_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ sets: data ?? [], plan })
}
