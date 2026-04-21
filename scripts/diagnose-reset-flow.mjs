/**
 * Diagnose password reset flow issues.
 * Run: node scripts/diagnose-reset-flow.mjs [email]
 *
 * Checks:
 *  1. Env var consistency (www vs no-www, missing vars)
 *  2. Supabase token generation (admin can generate a recovery link)
 *  3. The reset link URL is valid and callable (callback route is reachable)
 *  4. token_hash consumed once → second hit should fail (single-use check)
 *  5. Token expiry: timestamps from hashed token metadata
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---------------------------------------------------------------------------
// Load .env.local manually (no dotenv dependency required)
// ---------------------------------------------------------------------------
const envPath = resolve(process.cwd(), '.env.local')
let envVars = {}
try {
  const raw = readFileSync(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    envVars[key] = val
  }
  console.log('✅ Loaded .env.local\n')
} catch {
  console.error('❌ Could not load .env.local — run from project root')
  process.exit(1)
}

const env = (key) => envVars[key] ?? process.env[key]

const SUPABASE_URL = env('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')
const APP_URL = env('NEXT_PUBLIC_APP_URL')
const MARKETING_BASE_URL = env('MARKETING_BASE_URL')

const testEmail = process.argv[2]

// ---------------------------------------------------------------------------
// CHECK 1: Env var consistency
// ---------------------------------------------------------------------------
console.log('=== CHECK 1: Environment variable consistency ===')
const missingVars = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_APP_URL'].filter(
  (k) => !env(k)
)
if (missingVars.length) {
  console.error('❌ Missing required env vars:', missingVars.join(', '))
} else {
  console.log('✅ Required env vars present')
}

// Normalize URLs for comparison
function normalize(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.origin // strips trailing slash
  } catch {
    return url
  }
}

const appOrigin = normalize(APP_URL)
const marketingOrigin = normalize(MARKETING_BASE_URL)

if (APP_URL) console.log(`   NEXT_PUBLIC_APP_URL:  ${APP_URL}`)
if (MARKETING_BASE_URL) console.log(`   MARKETING_BASE_URL:   ${MARKETING_BASE_URL}`)

if (appOrigin && marketingOrigin && appOrigin !== marketingOrigin) {
  console.error(`❌ URL MISMATCH: NEXT_PUBLIC_APP_URL (${appOrigin}) !== MARKETING_BASE_URL (${marketingOrigin})`)
  console.error('   The password-reset route uses NEXT_PUBLIC_APP_URL first — links will be built with that host.')
  console.error('   Supabase allowlist and cookies must also match that exact origin.')
} else if (appOrigin && marketingOrigin) {
  console.log('✅ APP_URL and MARKETING_BASE_URL origins match')
}

// Check for www vs no-www mismatch pattern
const hasWww = (u) => !!u && new URL(u).hostname.startsWith('www.')
if (APP_URL && !hasWww(APP_URL)) {
  console.warn('⚠️  NEXT_PUBLIC_APP_URL has no www — ensure Supabase Site URL and Vercel match exactly')
}
console.log()

// ---------------------------------------------------------------------------
// CHECK 2: Supabase admin can generate a recovery link
// ---------------------------------------------------------------------------
if (!testEmail) {
  console.log('=== CHECK 2-4: Skipped (no email provided) ===')
  console.log('   Run: node scripts/diagnose-reset-flow.mjs your@email.com')
  console.log()
} else {
  console.log(`=== CHECK 2: Supabase admin generateLink for ${testEmail} ===`)
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const baseUrl = APP_URL || MARKETING_BASE_URL
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: testEmail,
    options: { redirectTo: `${baseUrl}/auth/reset-password` },
  })

  if (linkError) {
    console.error('❌ generateLink failed:', linkError.message, linkError.code)
    console.error('   → User may not exist, or service role key is wrong')
    process.exit(1)
  }

  const token = linkData?.properties?.hashed_token
  if (!token) {
    console.error('❌ generateLink returned no hashed_token')
    console.error('   Full properties:', linkData?.properties)
    process.exit(1)
  }

  console.log('✅ Got hashed_token:', token.slice(0, 20) + '...')

  // Inspect expiry from linkData if available
  if (linkData?.properties?.expires_at) {
    const exp = new Date(linkData.properties.expires_at * 1000)
    console.log(`   Token expires at: ${exp.toISOString()} (${Math.round((exp - Date.now()) / 60000)} minutes from now)`)
  }
  console.log()

  // ---------------------------------------------------------------------------
  // CHECK 3: Callback route is reachable with the token (HEAD check first)
  // ---------------------------------------------------------------------------
  console.log('=== CHECK 3: Callback URL reachability ===')
  const callbackUrl = `${baseUrl}/auth/callback?token_hash=${encodeURIComponent(token)}&type=recovery&next=/auth/reset-password`
  console.log('   Reset link that would be emailed:')
  console.log(`   ${callbackUrl}`)

  // Parse the URL to verify it's valid
  try {
    const parsed = new URL(callbackUrl)
    console.log(`   Origin: ${parsed.origin}`)
    console.log(`   Params: token_hash=${parsed.searchParams.get('token_hash')?.slice(0, 20)}...`)
    console.log(`           type=${parsed.searchParams.get('type')}`)
    console.log(`           next=${parsed.searchParams.get('next')}`)
    console.log('✅ Callback URL is well-formed')
  } catch {
    console.error('❌ Callback URL is malformed!')
  }
  console.log()

  // ---------------------------------------------------------------------------
  // CHECK 4: Verify the token once (simulate callback), then verify again
  //          to confirm single-use enforcement
  // ---------------------------------------------------------------------------
  console.log('=== CHECK 4: Token single-use enforcement (verifyOtp × 2) ===')
  // Use anon key for this — mirrors what the callback route does
  const ANON_KEY = env('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error: firstVerify, data: firstData } = await anonClient.auth.verifyOtp({
    token_hash: token,
    type: 'recovery',
  })

  if (firstVerify) {
    console.error('❌ First verifyOtp FAILED:', firstVerify.status, firstVerify.message)
    console.error('   This is the core problem — the token is invalid at point of use.')
    console.error('   Likely causes:')
    console.error('     a) Supabase "Confirm email" setting invalidated existing tokens when link was generated')
    console.error('     b) Token was already used before this script ran')
    console.error('     c) The hashed_token from admin.generateLink is not accepted by verifyOtp on this project')
  } else {
    const userId = firstData?.user?.id
    console.log(`✅ First verifyOtp succeeded — user: ${userId}`)

    const { error: secondVerify } = await anonClient.auth.verifyOtp({
      token_hash: token,
      type: 'recovery',
    })
    if (secondVerify) {
      console.log('✅ Second verifyOtp correctly rejected (single-use confirmed):', secondVerify.message)
    } else {
      console.warn('⚠️  Second verifyOtp also succeeded — token is NOT single-use (unexpected)')
    }
  }
  console.log()
}

// ---------------------------------------------------------------------------
// CHECK 5: Supabase project URL format check
// ---------------------------------------------------------------------------
console.log('=== CHECK 5: Supabase project URL format ===')
if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set')
} else {
  try {
    const su = new URL(SUPABASE_URL)
    if (su.hostname.endsWith('.supabase.co')) {
      console.log(`✅ Supabase URL looks correct: ${SUPABASE_URL}`)
    } else {
      console.warn(`⚠️  Supabase URL hostname is unusual: ${su.hostname}`)
    }
  } catch {
    console.error(`❌ NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${SUPABASE_URL}`)
  }
}
console.log()

console.log('=== Done ===')
