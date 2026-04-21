import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, requireRole, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/marketing-email'

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<'/api/coach/clients/[id]/welcome-email'>
) {
  try {
    const authz = await getRequestAuthz()
    requireRole(authz.client.role, ['coach'])
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const { id } = await ctx.params
  const admin = supabaseAdmin()

  const { data: client, error } = await admin
    .from('clients')
    .select('id, email, full_name')
    .eq('id', id)
    .maybeSingle()

  if (error || !client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  const firstName = client.full_name?.split(' ')[0] ?? null

  try {
    await sendWelcomeEmail({
      email: client.email,
      firstName,
      coachReplyToEmail: process.env.MARKETING_REPLY_TO_EMAIL,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send email'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ success: true, email: client.email })
}
