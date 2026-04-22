import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase'
import type { EmailOtpType } from '@supabase/supabase-js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeCoachId(value: string | null) {
  if (!value) return null
  return UUID_PATTERN.test(value) ? value : null
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const requestedCoachId = normalizeCoachId(searchParams.get('coach'))
  const nextParam = searchParams.get('next') ?? '/dashboard'
  const next = nextParam.startsWith('/') ? nextParam : '/dashboard'

  const redirectUrl = new URL(next, origin)
  const isRecoveryResetRedirect = Boolean(tokenHash && type === 'recovery' && redirectUrl.pathname === '/auth/reset-password')
  let keepRecoveryTokenOnRedirect = false

  // Create the redirect response first so we can write session cookies directly onto it.
  // cookies() from next/headers does NOT merge into NextResponse objects returned from
  // Route Handlers, so any session set via that path would be silently dropped.
  const response = NextResponse.redirect(redirectUrl.toString())

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
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    })

    // Only preserve token params for client-side retry when server-side verification fails.
    if (error && isRecoveryResetRedirect) {
      keepRecoveryTokenOnRedirect = true
    }
  }

  if (keepRecoveryTokenOnRedirect && tokenHash && type) {
    redirectUrl.searchParams.set('token_hash', tokenHash)
    redirectUrl.searchParams.set('type', type)
  }

  if (type === 'email_change') {
    redirectUrl.searchParams.set('email_updated', '1')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const admin = supabaseAdmin()
    const displayName = (user.user_metadata?.full_name || user.user_metadata?.name || '').toString().trim() || null
    const { data: existingProfile } = await admin
      .from('clients')
      .select('id, avatar_path')
      .eq('id', user.id)
      .maybeSingle()

    if (existingProfile) {
      // Never change role here; only refresh profile fields for existing accounts.
      await admin
        .from('clients')
        .update({
          email: user.email ?? '',
          full_name: displayName,
        })
        .eq('id', user.id)
    } else {
      // Create first-time profiles as clients without mutating pre-existing rows.
      await admin
        .from('clients')
        .upsert(
          {
            id: user.id,
            email: user.email ?? '',
            full_name: displayName,
            avatar_path: null,
            role: 'client',
          },
          { onConflict: 'id', ignoreDuplicates: true }
        )
    }

    if (requestedCoachId) {
      const { data: coach } = await admin
        .from('clients')
        .select('id')
        .eq('id', requestedCoachId)
        .eq('role', 'coach')
        .maybeSingle()

      if (coach) {
        await admin
          .from('clients')
          .update({ designated_coach_id: coach.id })
          .eq('id', user.id)
          .eq('role', 'client')
          .is('designated_coach_id', null)
      }
    }
  }

  return response
}
