import process from 'node:process'

const baseUrl = process.env.MARKETING_BASE_URL || 'http://127.0.0.1:3000'
const secret = process.env.MARKETING_CRON_SECRET

if (!secret) {
  console.error('MARKETING_CRON_SECRET is required')
  process.exit(1)
}

const res = await fetch(`${baseUrl}/api/marketing/dispatch`, {
  method: 'POST',
  headers: {
    'x-marketing-cron-secret': secret,
  },
})

const body = await res.json().catch(() => ({}))

if (!res.ok) {
  console.error('Dispatch failed', res.status, body)
  process.exit(1)
}

console.log('Dispatch succeeded', body)
