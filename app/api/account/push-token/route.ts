import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestAuthz, AuthzError } from '@/lib/authz'

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

  const body = await req.json().catch(() => ({}))
  const deviceToken = String(body.deviceToken ?? '').trim()
  const platform = String(body.platform ?? 'ios').trim()

  if (!deviceToken) {
    return NextResponse.json({ error: 'deviceToken is required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin()
    .from('push_tokens')
    .upsert(
      { user_id: userId, device_token: deviceToken, platform, updated_at: new Date().toISOString() },
      { onConflict: 'device_token' }
    )

  if (error) {
    return NextResponse.json({ error: 'Failed to register push token.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
