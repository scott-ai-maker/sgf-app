import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, requireCoachAssignedClient, requireRole, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'

interface GrantCompSessionBody {
  sessions?: unknown
  note?: unknown
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<'/api/coach/clients/[id]/comp-sessions'>
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

  const { id: clientId } = await ctx.params

  try {
    await requireCoachAssignedClient(coachId, clientId)
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Forbidden'
    return NextResponse.json({ error: message }, { status })
  }

  const body = (await req.json().catch(() => ({}))) as GrantCompSessionBody
  const sessions = Number(body.sessions)
  const note = typeof body.note === 'string' ? body.note.trim() : ''

  if (!Number.isInteger(sessions) || sessions < 1 || sessions > 50) {
    return NextResponse.json({ error: 'sessions must be an integer between 1 and 50' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  const { data: packageRow, error: packageError } = await admin
    .from('client_packages')
    .insert({
      client_id: clientId,
      package_name: `Comp Session Credit (${sessions})`,
      sessions_total: sessions,
      sessions_remaining: sessions,
      source: 'comp',
      granted_by_coach_id: coachId,
      grant_note: note || null,
      discount_amount_cents: 0,
    })
    .select('id, client_id, package_name, sessions_total, sessions_remaining, source, granted_by_coach_id, grant_note, purchased_at')
    .single()

  if (packageError || !packageRow) {
    return NextResponse.json({ error: 'Failed to create comp session credit' }, { status: 500 })
  }

  const { data: grantRow, error: grantError } = await admin
    .from('comp_session_grants')
    .insert({
      client_id: clientId,
      coach_id: coachId,
      sessions_granted: sessions,
      note: note || null,
      client_package_id: packageRow.id,
    })
    .select('id, client_id, coach_id, sessions_granted, note, created_at')
    .single()

  if (grantError || !grantRow) {
    return NextResponse.json({ error: 'Failed to record comp session grant' }, { status: 500 })
  }

  return NextResponse.json({
    package: packageRow,
    grant: grantRow,
  })
}
