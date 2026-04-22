import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, requireRole, requireCoachAssignedClient, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(
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

  const admin = supabaseAdmin()

  const { id } = await params
  const body = await req.json()
  const patch: { status?: string; notes?: string; checked_in_at?: string | null; checked_out_at?: string | null } = {}

  const validStatuses = ['scheduled', 'completed', 'cancelled', 'no_show']
  if (body.status !== undefined) {
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    patch.status = body.status
  }

  if (body.notes !== undefined) {
    patch.notes = body.notes
  }

  if (body.checked_in_at !== undefined) {
    patch.checked_in_at = body.checked_in_at
  }

  if (body.checked_out_at !== undefined) {
    patch.checked_out_at = body.checked_out_at
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: targetSession } = await admin
    .from('sessions')
    .select('id, client_id, status, package_id')
    .eq('id', id)
    .maybeSingle()

  if (!targetSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  try {
    await requireCoachAssignedClient(coachId, targetSession.client_id)
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Forbidden'
    return NextResponse.json({ error: message }, { status })
  }

  const { data, error } = await admin
    .from('sessions')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }

  // Deduct session credit when marking completed (only if transitioning from non-completed)
  if (patch.status === 'completed' && targetSession.status !== 'completed') {
    const pkgId = targetSession.package_id
    if (pkgId) {
      const { data: pkg } = await admin
        .from('client_packages')
        .select('sessions_remaining')
        .eq('id', pkgId)
        .maybeSingle()

      if (pkg && typeof pkg.sessions_remaining === 'number' && pkg.sessions_remaining > 0) {
        await admin
          .from('client_packages')
          .update({ sessions_remaining: pkg.sessions_remaining - 1 })
          .eq('id', pkgId)
      }
    }
  }

  return NextResponse.json(data)
}
