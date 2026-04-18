import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const checklistPath = resolve(process.cwd(), 'docs/authenticated-smoke-checklist.md')

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function createCookieJar() {
  const jar = new Map()

  return {
    cookies: {
      async getAll() {
        return [...jar.entries()].map(([name, value]) => ({ name, value }))
      },
      async setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          if (cookie.options?.maxAge === 0 || cookie.value === '') {
            jar.delete(cookie.name)
          } else {
            jar.set(cookie.name, cookie.value)
          }
        }
      },
    },
    header() {
      return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
    },
    size() {
      return jar.size
    },
  }
}

async function parseChecklistAccounts() {
  const markdown = await readFile(checklistPath, 'utf8')

  const readValue = (label) => {
    const match = markdown.match(new RegExp(`- ${label}:\\s*([^\\n]+)`))
    return match?.[1]?.trim() || ''
  }

  return {
    coachEmail: readValue('Coach email'),
    assignedClientEmail: readValue('Assigned client email'),
    unassignedClientEmail: readValue('Unassigned client email'),
  }
}

function createAdminClient() {
  return createSupabaseClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function createSession(email, password) {
  const jar = createCookieJar()
  const client = createBrowserClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: jar.cookies,
      cookieEncoding: 'base64url',
    }
  )

  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(`Failed to sign in ${email}: ${error.message}`)
  }

  if (jar.size() === 0) {
    throw new Error(`No auth cookies were stored for ${email}`)
  }

  return {
    email,
    cookieHeader: jar.header(),
    client,
  }
}

async function request(baseUrl, path, options = {}, session) {
  const headers = new Headers(options.headers ?? {})
  if (session?.cookieHeader) {
    headers.set('cookie', session.cookieHeader)
  }

  let body = options.body
  if (body && typeof body === 'object' && !(body instanceof URLSearchParams) && !(body instanceof FormData) && !(body instanceof ArrayBuffer)) {
    headers.set('content-type', 'application/json')
    body = JSON.stringify(body)
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body,
    redirect: 'manual',
  })

  const contentType = response.headers.get('content-type') ?? ''
  let payload = null

  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null)
  } else {
    payload = await response.text().catch(() => '')
  }

  return { response, payload }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function getClientRowByEmail(admin, email) {
  const { data, error } = await admin
    .from('clients')
    .select('id, email, role, designated_coach_id')
    .eq('email', email)
    .single()

  if (error || !data) {
    throw new Error(`Could not resolve client row for ${email}: ${error?.message ?? 'not found'}`)
  }

  return data
}

async function ensureClientStartsUnassigned(admin, clientId, email) {
  const { error } = await admin
    .from('clients')
    .update({ designated_coach_id: null })
    .eq('id', clientId)

  if (error) {
    throw new Error(`Failed to reset unassigned client ${email}: ${error.message}`)
  }
}

async function getAssignedPackage(admin, clientId) {
  const { data, error } = await admin
    .from('client_packages')
    .select('id, sessions_remaining')
    .eq('client_id', clientId)
    .gt('sessions_remaining', 0)
    .order('purchased_at', { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(`Failed to load package for ${clientId}: ${error.message}`)
  }

  return data?.[0] ?? null
}

/**
 * Ensure the assigned client always has at least one session remaining for the
 * booking smoke check. Upserts a dedicated smoke-test package row so the check
 * is idempotent across CI runs regardless of how many times it has booked.
 */
async function ensureTestPackage(admin, clientId) {
  const SMOKE_PACKAGE_NAME = 'smoke-test-package'

  // Try to refill an existing smoke package first.
  const { data: existing } = await admin
    .from('client_packages')
    .select('id')
    .eq('client_id', clientId)
    .eq('package_name', SMOKE_PACKAGE_NAME)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await admin
      .from('client_packages')
      .update({ sessions_remaining: 1 })
      .eq('id', existing.id)
    if (error) throw new Error(`Failed to refill smoke package: ${error.message}`)
    return
  }

  // Create a fresh smoke package.
  const { error } = await admin.from('client_packages').insert({
    client_id: clientId,
    package_name: SMOKE_PACKAGE_NAME,
    sessions_total: 1,
    sessions_remaining: 1,
  })
  if (error) throw new Error(`Failed to create smoke package: ${error.message}`)
}

async function getFitnessProfile(admin, userId) {
  const { data, error } = await admin
    .from('fitness_profiles')
    .select('user_id, onboarding_completed_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load fitness profile for ${userId}: ${error.message}`)
  }

  return data
}

async function runCheck(results, name, fn) {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log(`PASS ${name}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    results.push({ name, ok: false, message })
    console.error(`FAIL ${name}: ${message}`)
  }
}

async function main() {
  const baseUrl = (process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '')
  const enableBooking = process.env.SMOKE_ENABLE_BOOKING === '1'
  const enableCheckout = process.env.SMOKE_ENABLE_CHECKOUT === '1'

  const accounts = await parseChecklistAccounts()
  assert(accounts.coachEmail, 'Coach email is missing from docs/authenticated-smoke-checklist.md')
  assert(accounts.assignedClientEmail, 'Assigned client email is missing from docs/authenticated-smoke-checklist.md')
  assert(accounts.unassignedClientEmail, 'Unassigned client email is missing from docs/authenticated-smoke-checklist.md')

  const coachPassword = requireEnv('SMOKE_COACH_PASSWORD')
  const assignedClientPassword = requireEnv('SMOKE_ASSIGNED_CLIENT_PASSWORD')
  const unassignedClientPassword = requireEnv('SMOKE_UNASSIGNED_CLIENT_PASSWORD')

  const admin = createAdminClient()
  const coachRow = await getClientRowByEmail(admin, accounts.coachEmail)
  const assignedClientRow = await getClientRowByEmail(admin, accounts.assignedClientEmail)
  let unassignedClientRow = await getClientRowByEmail(admin, accounts.unassignedClientEmail)

  if (unassignedClientRow.designated_coach_id !== null) {
    await ensureClientStartsUnassigned(admin, unassignedClientRow.id, accounts.unassignedClientEmail)
    unassignedClientRow = await getClientRowByEmail(admin, accounts.unassignedClientEmail)
  }

  assert(coachRow.role === 'coach', `${accounts.coachEmail} is not marked as a coach`)
  assert(assignedClientRow.role === 'client', `${accounts.assignedClientEmail} is not marked as a client`)
  assert(unassignedClientRow.role === 'client', `${accounts.unassignedClientEmail} is not marked as a client`)
  assert(assignedClientRow.designated_coach_id === coachRow.id, 'Assigned client is not assigned to the configured coach')
  assert(unassignedClientRow.designated_coach_id === null, 'Unassigned client must start unassigned')

  const coachSession = await createSession(accounts.coachEmail, coachPassword)
  const assignedClientSession = await createSession(accounts.assignedClientEmail, assignedClientPassword)
  const unassignedClientSession = await createSession(accounts.unassignedClientEmail, unassignedClientPassword)

  const results = []

  await runCheck(results, 'unauth dashboard redirects to login', async () => {
    const { response } = await request(baseUrl, '/dashboard')
    assert(response.status === 307, `Expected 307, got ${response.status}`)
    assert(response.headers.get('location') === '/auth/login', 'Expected redirect to /auth/login')
  })

  await runCheck(results, 'unauth coach redirects to login', async () => {
    const { response } = await request(baseUrl, '/coach')
    assert(response.status === 307, `Expected 307, got ${response.status}`)
    assert(response.headers.get('location') === '/auth/login', 'Expected redirect to /auth/login')
  })

  await runCheck(results, 'unauth messages api returns 401', async () => {
    const { response, payload } = await request(baseUrl, '/api/messages')
    assert(response.status === 401, `Expected 401, got ${response.status}`)
    assert(payload?.error === 'Unauthorized', 'Expected Unauthorized payload')
  })

  await runCheck(results, 'assigned client dashboard route is reachable or onboarding-redirected', async () => {
    const { response } = await request(baseUrl, '/dashboard', {}, assignedClientSession)
    const location = response.headers.get('location')
    const ok =
      response.status === 200 ||
      (response.status === 307 && location === '/dashboard/onboarding')
    assert(ok, `Expected 200 or onboarding redirect, got ${response.status} ${location ?? ''}`)
  })

  await runCheck(results, 'assigned client dashboard messages route responds', async () => {
    const { response } = await request(baseUrl, '/dashboard/messages', {}, assignedClientSession)
    assert(response.status === 200 || response.status === 307, `Expected 200 or 307, got ${response.status}`)
  })

  await runCheck(results, 'assigned client is redirected away from coach area', async () => {
    const { response } = await request(baseUrl, '/coach', {}, assignedClientSession)
    assert(response.status === 307, `Expected 307, got ${response.status}`)
    assert(response.headers.get('location') === '/dashboard', 'Expected redirect to /dashboard')
  })

  await runCheck(results, 'assigned client can read own message thread', async () => {
    const { response, payload } = await request(baseUrl, '/api/messages', {}, assignedClientSession)
    assert(response.status === 200, `Expected 200, got ${response.status}`)
    assert(Array.isArray(payload?.messages), 'Expected messages array')
  })

  await runCheck(results, 'unassigned client cannot read trainer thread', async () => {
    const { response, payload } = await request(baseUrl, '/api/messages', {}, unassignedClientSession)
    assert(response.status === 400, `Expected 400, got ${response.status}`)
    assert(payload?.error === 'No designated trainer assigned yet.', 'Expected designated trainer validation message')
  })

  await runCheck(results, 'client cannot call coach assignment api', async () => {
    const { response } = await request(
      baseUrl,
      `/api/coach/clients/${unassignedClientRow.id}/assignment`,
      { method: 'PATCH' },
      assignedClientSession
    )
    assert(response.status === 403, `Expected 403, got ${response.status}`)
  })

  await runCheck(results, 'client cannot call coach workout generation api', async () => {
    const { response } = await request(
      baseUrl,
      '/api/coach/workouts/generate',
      {
        method: 'POST',
        body: { clientId: assignedClientRow.id, sessionsPerWeek: 4 },
      },
      assignedClientSession
    )
    assert(response.status === 403, `Expected 403, got ${response.status}`)
  })

  await runCheck(results, 'assigned client self-generation endpoint is unavailable (coach-generated plans only)', async () => {
    const { response } = await request(
      baseUrl,
      '/api/workouts/generate',
      { method: 'POST', body: { sessionsPerWeek: 4 } },
      assignedClientSession
    )

    assert(response.status === 404, `Expected 404 for removed endpoint, got ${response.status}`)
  })

  await runCheck(results, 'coach route responds', async () => {
    const { response } = await request(baseUrl, '/coach', {}, coachSession)
    assert(response.status === 200 || response.status === 307, `Expected 200 or 307, got ${response.status}`)
  })

  await runCheck(results, 'coach dashboard route responds with expected redirect or content', async () => {
    const { response } = await request(baseUrl, '/dashboard', {}, coachSession)
    assert(response.status === 200 || response.status === 307, `Expected 200 or 307, got ${response.status}`)
  })

  await runCheck(results, 'coach assigned client detail route responds', async () => {
    const { response } = await request(baseUrl, `/coach/clients/${assignedClientRow.id}`, {}, coachSession)
    assert(response.status === 200 || response.status === 307, `Expected 200 or 307, got ${response.status}`)
  })

  await runCheck(results, 'coach cannot open unassigned client detail before assignment', async () => {
    const { response } = await request(baseUrl, `/coach/clients/${unassignedClientRow.id}`, {}, coachSession)
    assert(response.status === 404 || response.status === 307, `Expected 404 or 307, got ${response.status}`)
  })

  await runCheck(results, 'coach can read assigned client message thread', async () => {
    const { response, payload } = await request(baseUrl, `/api/messages?clientId=${assignedClientRow.id}`, {}, coachSession)
    assert(response.status === 200, `Expected 200, got ${response.status}`)
    assert(Array.isArray(payload?.messages), 'Expected messages array')
  })

  await runCheck(results, 'coach cannot read unassigned client message thread', async () => {
    const { response } = await request(baseUrl, `/api/messages?clientId=${unassignedClientRow.id}`, {}, coachSession)
    assert(response.status === 403, `Expected 403, got ${response.status}`)
  })

  await runCheck(results, 'coach can assign and release the unassigned client', async () => {
    const assign = await request(
      baseUrl,
      `/api/coach/clients/${unassignedClientRow.id}/assignment`,
      { method: 'PATCH' },
      coachSession
    )
    assert(assign.response.status === 200, `Expected assignment 200, got ${assign.response.status}`)

    const { data: afterAssign } = await admin
      .from('clients')
      .select('designated_coach_id')
      .eq('id', unassignedClientRow.id)
      .single()

    assert(afterAssign?.designated_coach_id === coachRow.id, 'Expected designated coach to be set after assignment')

    const assignedThread = await request(baseUrl, `/api/messages?clientId=${unassignedClientRow.id}`, {}, coachSession)
    assert(assignedThread.response.status === 200, `Expected assigned thread 200 after assignment, got ${assignedThread.response.status}`)

    const release = await request(
      baseUrl,
      `/api/coach/clients/${unassignedClientRow.id}/assignment`,
      { method: 'DELETE' },
      coachSession
    )
    assert(release.response.status === 200, `Expected release 200, got ${release.response.status}`)

    const { data: afterRelease } = await admin
      .from('clients')
      .select('designated_coach_id')
      .eq('id', unassignedClientRow.id)
      .single()

    assert(afterRelease?.designated_coach_id === null, 'Expected designated coach to be cleared after release')
  })

  await runCheck(results, 'coach can generate a workout plan for assigned client (or reports missing onboarding profile)', async () => {
    const profile = await getFitnessProfile(admin, assignedClientRow.id)

    const { response, payload } = await request(
      baseUrl,
      '/api/coach/workouts/generate',
      { method: 'POST', body: { clientId: assignedClientRow.id, sessionsPerWeek: 4 } },
      coachSession
    )

    if (!profile?.onboarding_completed_at) {
      assert(response.status === 404, `Expected 404 without client onboarding profile, got ${response.status}`)
      return
    }

    assert(response.status === 200, `Expected 200, got ${response.status}`)
    assert(payload?.draft?.clientId === assignedClientRow.id, 'Expected generated coach draft for assigned client')
    assert(Array.isArray(payload?.draft?.workouts) && payload.draft.workouts.length > 0, 'Expected generated coach draft workouts')
  })

  await runCheck(results, 'coach cannot use client booking api', async () => {
    const { response } = await request(
      baseUrl,
      '/api/sessions/book',
      { method: 'POST', body: {} },
      coachSession
    )
    assert(response.status === 403, `Expected 403, got ${response.status}`)
  })

  await runCheck(results, 'coach cannot use client workout log api', async () => {
    const { response } = await request(
      baseUrl,
      '/api/workouts/log',
      { method: 'POST', body: {} },
      coachSession
    )
    assert(response.status === 403, `Expected 403, got ${response.status}`)
  })

  await runCheck(results, 'client and coach can exchange messages', async () => {
    const marker = `smoke-${Date.now()}`

    const clientSend = await request(
      baseUrl,
      '/api/messages',
      { method: 'POST', body: { message: `client-${marker}` } },
      assignedClientSession
    )
    assert(clientSend.response.status === 200, `Expected client message 200, got ${clientSend.response.status}`)

    const coachRead = await request(baseUrl, `/api/messages?clientId=${assignedClientRow.id}`, {}, coachSession)
    assert(coachRead.response.status === 200, `Expected coach read 200, got ${coachRead.response.status}`)
    assert(
      coachRead.payload?.messages?.some?.(message => message.message_body === `client-${marker}`),
      'Expected coach thread to contain client smoke message'
    )

    const coachSend = await request(
      baseUrl,
      '/api/messages',
      { method: 'POST', body: { clientId: assignedClientRow.id, message: `coach-${marker}` } },
      coachSession
    )
    assert(coachSend.response.status === 200, `Expected coach message 200, got ${coachSend.response.status}`)

    const clientRead = await request(baseUrl, '/api/messages', {}, assignedClientSession)
    assert(clientRead.response.status === 200, `Expected client read 200, got ${clientRead.response.status}`)
    assert(
      clientRead.payload?.messages?.some?.(message => message.message_body === `coach-${marker}`),
      'Expected client thread to contain coach smoke reply'
    )
  })

  await runCheck(results, 'assigned client can load available session slots', async () => {
    const { response, payload } = await request(baseUrl, '/api/sessions/available', {}, assignedClientSession)
    assert(response.status === 200, `Expected 200, got ${response.status}`)
    assert(Array.isArray(payload), 'Expected slots array')
  })

  if (enableBooking) {
    await runCheck(results, 'assigned client can book a session', async () => {
      await ensureTestPackage(admin, assignedClientRow.id)
      const packageRow = await getAssignedPackage(admin, assignedClientRow.id)
      assert(packageRow?.id, 'No package with remaining sessions was found for assigned client')

      const slotsRes = await request(baseUrl, '/api/sessions/available', {}, assignedClientSession)
      const slot = slotsRes.payload?.[0]
      assert(slot?.datetime, 'No available slot was returned for booking')

      const bookingRes = await request(
        baseUrl,
        '/api/sessions/book',
        {
          method: 'POST',
          body: { packageId: packageRow.id, scheduledAt: slot.datetime },
        },
        assignedClientSession
      )

      assert(bookingRes.response.status === 200, `Expected booking 200, got ${bookingRes.response.status}`)
    })
  }

  if (enableCheckout) {
    await runCheck(results, 'assigned client can start checkout', async () => {
      const packageId = process.env.SMOKE_CHECKOUT_PACKAGE_ID ?? 'starter'

      const checkoutRes = await request(
        baseUrl,
        '/api/stripe/checkout',
        { method: 'POST', body: { packageId } },
        assignedClientSession
      )

      assert(checkoutRes.response.status === 200, `Expected checkout 200, got ${checkoutRes.response.status}`)
      assert(typeof checkoutRes.payload?.url === 'string' && checkoutRes.payload.url.length > 0, 'Expected checkout URL')
    })
  }

  const failures = results.filter(result => !result.ok)
  console.log('')
  console.log(`Completed ${results.length} checks with ${failures.length} failure(s).`)

  if (failures.length > 0) {
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})