import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  try {
    const { supabaseAdmin } = await import('@/lib/supabase')
    const { triggerLeadEmailAutomation } = await import('@/lib/marketing-email')
    const { email } = await req.json()

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const supabase = supabaseAdmin()

    const { error } = await supabase
      .from('waitlist')
      .insert({ email: normalizedEmail })

    if (error && error.code !== '23505') throw error

    // Avoid repeated confirmation/sequence spam for duplicate waitlist submissions.
    if (!error) {
      await triggerLeadEmailAutomation(supabase, {
        email: normalizedEmail,
        source: 'waitlist',
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Waitlist error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
