import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const nextParam = searchParams.get('next') ?? '/dashboard'
  const next = nextParam.startsWith('/') ? nextParam : '/dashboard'

  // Create the redirect response first so we can write session cookies directly onto it.
  // cookies() from next/headers does NOT merge into NextResponse objects returned from
  // Route Handlers, so any session set via that path would be silently dropped.
  const response = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

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

  return response
}
