import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, requireRole, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'
import { getMissingEmailConfigKeys, sendWelcomeEmail } from '@/lib/marketing-email'

function extractErrorMessage(err: unknown) {
  if (typeof err === 'string' && err.trim()) return err
  if (err instanceof Error && err.message) return err.message

  if (typeof err === 'object' && err !== null) {
    const asRecord = err as Record<string, unknown>

    if (typeof asRecord.message === 'string' && asRecord.message.trim()) {
      return asRecord.message
    }

    const nestedError = asRecord.error
    if (typeof nestedError === 'object' && nestedError !== null) {
      const nestedRecord = nestedError as Record<string, unknown>
      if (typeof nestedRecord.message === 'string' && nestedRecord.message.trim()) {
        return nestedRecord.message
      }
    }
  }

  return 'Failed to send email'
}

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<'/api/coach/clients/[id]/welcome-email'>
) {
  try {
    const authz = await getRequestAuthz(_req)
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
    const result = await sendWelcomeEmail({
      email: client.email,
      firstName,
      coachReplyToEmail: process.env.MARKETING_REPLY_TO_EMAIL,
    })

    if (result.skipped) {
      const missing = getMissingEmailConfigKeys()
      return NextResponse.json(
        {
          error: `Email service is not configured on this environment. Missing: ${missing.join(', ') || 'unknown settings'}.`,
          missing,
        },
        { status: 503 }
      )
    }

    console.info('Welcome email sent', {
      clientId: client.id,
      email: client.email,
      providerMessageId: result.id,
    })

    return NextResponse.json({ success: true, email: client.email, providerMessageId: result.id })
  } catch (err) {
    const message = extractErrorMessage(err)
    console.error('Welcome email send failed', {
      clientId: client.id,
      email: client.email,
      error: err,
      message,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
