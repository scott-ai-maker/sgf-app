import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, requireRole, AuthzError } from '@/lib/authz'

export async function POST(req: NextRequest) {
  let userId = ''
  try {
    const authz = await getRequestAuthz()
    requireRole(authz.client.role, ['client'])
    userId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const body = await req.json()
  const { packageId, scheduledAt } = body ?? {}

  if (!packageId || !scheduledAt) {
    return NextResponse.json({ error: 'packageId and scheduledAt are required' }, { status: 400 })
  }

  const { supabaseAdmin } = await import('@/lib/supabase')
  const admin = supabaseAdmin()

  // Verify package belongs to this user and has sessions remaining
  const { data: pkg, error: pkgError } = await admin
    .from('client_packages')
    .select('id, sessions_remaining')
    .eq('id', packageId)
    .eq('client_id', userId)
    .single()

  if (pkgError || !pkg) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 })
  }

  if (pkg.sessions_remaining <= 0) {
    return NextResponse.json({ error: 'No sessions remaining in this package' }, { status: 400 })
  }

  // Check the slot is available (not already booked)
  const slotStart = new Date(scheduledAt)
  const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000)

  const { data: conflict } = await admin
    .from('sessions')
    .select('id')
    .eq('status', 'scheduled')
    .gte('scheduled_at', slotStart.toISOString())
    .lt('scheduled_at', slotEnd.toISOString())
    .maybeSingle()

  if (conflict) {
    return NextResponse.json({ error: 'This slot is already booked' }, { status: 409 })
  }

  // Insert session
  const { data: session, error: insertError } = await admin
    .from('sessions')
    .insert({
      client_id: userId,
      package_id: packageId,
      scheduled_at: slotStart.toISOString(),
      status: 'scheduled',
    })
    .select()
    .single()

  if (insertError) {
    console.error('Session insert error:', insertError)
    return NextResponse.json({ error: 'Failed to book session' }, { status: 500 })
  }

  // Decrement sessions_remaining (atomic: only if still > 0)
  await admin
    .from('client_packages')
    .update({ sessions_remaining: pkg.sessions_remaining - 1 })
    .eq('id', packageId)
    .gt('sessions_remaining', 0)

  return NextResponse.json({ success: true, session })
}
