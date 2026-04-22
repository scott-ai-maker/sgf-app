import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestAuthz, requireCoachAssignedClient, AuthzError } from '@/lib/authz'

export async function GET(req: NextRequest) {
  let authz
  try {
    authz = await getRequestAuthz()
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const role = authz.client.role
  const admin = supabaseAdmin()

  let clientId = ''
  let coachId = ''

  if (role === 'client') {
    clientId = authz.user.id
    coachId = authz.client.designated_coach_id ?? ''
    if (!coachId) {
      return NextResponse.json({ error: 'No designated trainer assigned yet.' }, { status: 400 })
    }
  } else {
    const targetClientId = req.nextUrl.searchParams.get('clientId') ?? ''
    if (!targetClientId) {
      return NextResponse.json({ error: 'clientId is required for coach message threads.' }, { status: 400 })
    }

    try {
      await requireCoachAssignedClient(authz.user.id, targetClientId)
    } catch (error) {
      const status = error instanceof AuthzError ? error.status : 500
      const message = error instanceof Error ? error.message : 'Forbidden'
      return NextResponse.json({ error: message }, { status })
    }

    clientId = targetClientId
    coachId = authz.user.id
  }

  const { data, error } = await admin
    .from('coach_client_messages')
    .select('id, client_id, coach_id, sender_id, message_body, read_at, created_at')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ messages: data ?? [] })
}

export async function POST(req: NextRequest) {
  let authz
  try {
    authz = await getRequestAuthz(req)
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const body = await req.json().catch(() => ({}))
  const messageBody = String(body.message ?? '').trim()
  if (!messageBody) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }
  if (messageBody.length > 2000) {
    return NextResponse.json({ error: 'message must be 2000 characters or fewer' }, { status: 400 })
  }

  let clientId = ''
  let coachId = ''

  if (authz.client.role === 'client') {
    clientId = authz.user.id
    coachId = authz.client.designated_coach_id ?? ''
    if (!coachId) {
      return NextResponse.json({ error: 'No designated trainer assigned yet.' }, { status: 400 })
    }
  } else {
    const targetClientId = String(body.clientId ?? '').trim()
    if (!targetClientId) {
      return NextResponse.json({ error: 'clientId is required for coach messages.' }, { status: 400 })
    }

    try {
      await requireCoachAssignedClient(authz.user.id, targetClientId)
    } catch (error) {
      const status = error instanceof AuthzError ? error.status : 500
      const message = error instanceof Error ? error.message : 'Forbidden'
      return NextResponse.json({ error: message }, { status })
    }

    clientId = targetClientId
    coachId = authz.user.id
  }

  const { data, error } = await supabaseAdmin()
    .from('coach_client_messages')
    .insert({
      client_id: clientId,
      coach_id: coachId,
      sender_id: authz.user.id,
      message_body: messageBody,
    })
    .select('id, client_id, coach_id, sender_id, message_body, read_at, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: data })
}
