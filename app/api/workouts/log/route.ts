import { NextRequest, NextResponse } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestAuthz, requireRole, AuthzError } from '@/lib/authz'

export async function GET(req: NextRequest) {
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

  const planId = req.nextUrl.searchParams.get('planId')

  let query = supabaseAdmin()
    .from('workout_logs')
    .select('*')
    .eq('user_id', userId)
    .order('session_date', { ascending: false })
    .limit(50)

  if (planId) {
    query = query.eq('workout_plan_id', planId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ logs: data ?? [] })
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

  const body = await req.json()

  if (!body.sessionDate || !body.sessionTitle) {
    return NextResponse.json({ error: 'sessionDate and sessionTitle are required' }, { status: 400 })
  }

  const insertPayload = {
    user_id: userId,
    workout_plan_id: body.workoutPlanId ?? null,
    session_date: body.sessionDate,
    session_title: body.sessionTitle,
    completed: Boolean(body.completed),
    exertion_rpe: body.exertionRpe ? Number(body.exertionRpe) : null,
    notes: body.notes ?? null,
  }

  const { data, error } = await supabaseAdmin()
    .from('workout_logs')
    .insert(insertPayload)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ log: data })
}
