import { createPrivateKey, createSign } from 'node:crypto'

import { supabaseAdmin } from '@/lib/supabase'

type PushAlert = {
  title: string
  body: string
}

type PushSendInput = {
  userId: string
  alert: PushAlert
  data?: Record<string, string>
}

type PushConfig = {
  teamId: string
  keyId: string
  privateKey: string
  topic: string
  useSandbox: boolean
}

function base64UrlEncode(input: Buffer | string) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function resolvePushConfig(): PushConfig | null {
  const teamId = process.env.APPLE_TEAM_ID?.trim()
  const keyId = process.env.APPLE_KEY_ID?.trim()
  const privateKey = process.env.APPLE_PUSH_KEY?.replace(/\\n/g, '\n')?.trim()
  const topic = process.env.APPLE_BUNDLE_ID?.trim()
  const useSandbox = process.env.APPLE_PUSH_USE_SANDBOX !== 'false'

  if (!teamId || !keyId || !privateKey || !topic) {
    return null
  }

  return { teamId, keyId, privateKey, topic, useSandbox }
}

function createProviderToken(config: PushConfig) {
  const header = { alg: 'ES256', kid: config.keyId }
  const claims = { iss: config.teamId, iat: Math.floor(Date.now() / 1000) }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedClaims = base64UrlEncode(JSON.stringify(claims))
  const signingInput = `${encodedHeader}.${encodedClaims}`
  const signer = createSign('sha256')
  signer.update(signingInput)
  signer.end()
  const signature = signer.sign(createPrivateKey(config.privateKey))
  return `${signingInput}.${base64UrlEncode(signature)}`
}

async function removeInvalidToken(deviceToken: string) {
  await supabaseAdmin().from('push_tokens').delete().eq('device_token', deviceToken)
}

async function fetchUserTokens(userId: string) {
  const { data, error } = await supabaseAdmin()
    .from('push_tokens')
    .select('device_token, platform')
    .eq('user_id', userId)
    .eq('platform', 'ios')

  if (error) {
    throw new Error(`Failed to load push tokens: ${error.message}`)
  }

  return (data ?? []) as Array<{ device_token: string; platform: string }>
}

export async function sendPushToUser({ userId, alert, data }: PushSendInput) {
  const config = resolvePushConfig()
  if (!config) {
    return { delivered: 0, skipped: true as const }
  }

  const tokens = await fetchUserTokens(userId)
  if (tokens.length === 0) {
    return { delivered: 0, skipped: false as const }
  }

  const providerToken = createProviderToken(config)
  const host = config.useSandbox ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com'
  let delivered = 0

  for (const token of tokens) {
    const response = await fetch(`${host}/3/device/${token.device_token}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${providerToken}`,
        'apns-topic': config.topic,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        aps: {
          alert,
          sound: 'default',
        },
        ...data,
      }),
    })

    if (response.ok) {
      delivered += 1
      continue
    }

    const payload = (await response.json().catch(() => null)) as { reason?: string } | null
    if (payload?.reason === 'BadDeviceToken' || payload?.reason === 'Unregistered') {
      await removeInvalidToken(token.device_token)
    }
  }

  return { delivered, skipped: false as const }
}

export async function sendWeeklyCheckinNudges() {
  const admin = supabaseAdmin()
  const weekStart = new Date()
  const day = weekStart.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  weekStart.setUTCDate(weekStart.getUTCDate() + diff)
  weekStart.setUTCHours(0, 0, 0, 0)
  const weekStartIso = weekStart.toISOString().slice(0, 10)

  const { data: clients, error: clientsError } = await admin
    .from('clients')
    .select('id, full_name, role')
    .eq('role', 'client')

  if (clientsError) {
    throw new Error(`Failed to load clients: ${clientsError.message}`)
  }

  const { data: checkins, error: checkinsError } = await admin
    .from('weekly_checkins')
    .select('user_id')
    .eq('week_start', weekStartIso)

  if (checkinsError) {
    throw new Error(`Failed to load weekly check-ins: ${checkinsError.message}`)
  }

  const completed = new Set((checkins ?? []).map((row) => row.user_id))
  let notified = 0

  for (const client of clients ?? []) {
    if (completed.has(client.id)) {
      continue
    }

    const result = await sendPushToUser({
      userId: client.id,
      alert: {
        title: 'Weekly check-in due',
        body: 'Log your weight, recovery, and notes so your coach can adjust your plan.',
      },
      data: { type: 'weekly_checkin_nudge' },
    })

    notified += result.delivered
  }

  return { weekStart: weekStartIso, clientsConsidered: (clients ?? []).length, notified }
}