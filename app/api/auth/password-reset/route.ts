import { NextRequest, NextResponse } from 'next/server'
import { sendPasswordResetEmail, getMissingEmailConfigKeys } from '@/lib/marketing-email'
import { supabaseAdmin } from '@/lib/supabase'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getBaseUrl(req: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.MARKETING_BASE_URL ||
    req.nextUrl.origin
  )
}

function parseEmail(body: unknown) {
  if (typeof body !== 'object' || body === null) return null
  const email = (body as Record<string, unknown>).email
  if (typeof email !== 'string') return null
  const normalized = email.trim().toLowerCase()
  return EMAIL_REGEX.test(normalized) ? normalized : null
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const email = parseEmail(body)

  // Return a generic success for invalid input to avoid account enumeration.
  if (!email) {
    return NextResponse.json({ success: true })
  }

  const admin = supabaseAdmin()
  const baseUrl = getBaseUrl(req)

  try {
    const { data: linkData, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${baseUrl}/auth/reset-password`,
      },
    })

    // Keep response generic regardless of existence or auth provider state.
    if (error || !linkData?.properties?.hashed_token) {
      return NextResponse.json({ success: true })
    }

    // Build a scanner-safe reset URL by putting token params in the URL fragment.
    // Most email link scanners only request the URL path/query and ignore fragments,
    // which prevents accidental one-time token consumption before the user clicks.
    const resetLink = `${baseUrl}/auth/reset-password#token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=recovery`

    const result = await sendPasswordResetEmail({
      email,
      resetLink,
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

    return NextResponse.json({ success: true })
  } catch {
    // Keep response generic to avoid exposing user existence.
    return NextResponse.json({ success: true })
  }
}
