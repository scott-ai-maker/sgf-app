import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

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
  }

  return NextResponse.redirect(`${origin}${next}`)
}
