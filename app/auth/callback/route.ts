import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const nextParam = searchParams.get('next') ?? '/dashboard'
  const next = nextParam.startsWith('/') ? nextParam : '/dashboard'

  const supabase = await createClient()

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  } else if (tokenHash && type) {
    await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const displayName = (user.user_metadata?.full_name || user.user_metadata?.name || '').toString().trim() || null
    await supabaseAdmin()
      .from('clients')
      .upsert(
        {
          id: user.id,
          email: user.email ?? '',
          full_name: displayName,
          role: 'client',
        },
        { onConflict: 'id' }
      )
  }

  return NextResponse.redirect(`${origin}${next}`)
}
