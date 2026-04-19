#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

function parseArgs(argv) {
  const argSet = new Set(argv.slice(2))
  return {
    json: argSet.has('--json') || process.env.JSON === '1',
    onlyUntagged: argSet.has('--only-untagged') || process.env.ONLY_UNTAGGED === '1',
    limit: Number(process.env.LIMIT || 100),
  }
}

function hasWorkoutDayTag(notes) {
  return /\[workout-day:\d+\]/i.test(String(notes ?? ''))
}

function percent(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

const args = parseArgs(process.argv)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: rows, error } = await supabase
  .from('workout_set_logs')
  .select('id, user_id, notes, created_at')

if (error) {
  console.error('Failed to query workout_set_logs:', error.message)
  process.exit(1)
}

const byUser = new Map()
let totalTagged = 0
let totalUntagged = 0

for (const row of rows ?? []) {
  const userId = String(row.user_id)
  const current = byUser.get(userId) ?? {
    userId,
    tagged: 0,
    untagged: 0,
    total: 0,
    latestCreatedAt: null,
  }

  const tagged = hasWorkoutDayTag(row.notes)
  if (tagged) {
    current.tagged += 1
    totalTagged += 1
  } else {
    current.untagged += 1
    totalUntagged += 1
  }

  current.total += 1
  const createdAt = String(row.created_at ?? '')
  if (createdAt && (!current.latestCreatedAt || createdAt > current.latestCreatedAt)) {
    current.latestCreatedAt = createdAt
  }

  byUser.set(userId, current)
}

const userRows = [...byUser.values()]
  .map(item => ({
    ...item,
    taggedPct: percent(item.tagged, item.total),
    untaggedPct: percent(item.untagged, item.total),
  }))
  .sort((a, b) => {
    if (b.untagged !== a.untagged) return b.untagged - a.untagged
    if (b.total !== a.total) return b.total - a.total
    return a.userId.localeCompare(b.userId)
  })

const filteredRows = args.onlyUntagged
  ? userRows.filter(row => row.untagged > 0)
  : userRows

const summary = {
  users: userRows.length,
  totalRows: totalTagged + totalUntagged,
  totalTagged,
  totalUntagged,
  taggedPct: percent(totalTagged, totalTagged + totalUntagged),
  untaggedPct: percent(totalUntagged, totalTagged + totalUntagged),
}

if (args.json) {
  const payload = {
    summary: {
      ...summary,
      filteredUsers: filteredRows.length,
      onlyUntagged: args.onlyUntagged,
    },
    users: filteredRows.slice(0, Math.max(1, args.limit)),
  }
  console.log(JSON.stringify(payload, null, 2))
  process.exit(0)
}

console.log('Workout Day Tag Audit')
console.log('=====================')
console.log(`Users: ${summary.users}`)
console.log(`Rows: ${summary.totalRows}`)
console.log(`Tagged: ${summary.totalTagged} (${summary.taggedPct}%)`)
console.log(`Untagged: ${summary.totalUntagged} (${summary.untaggedPct}%)`)
if (args.onlyUntagged) {
  console.log('Filter: only users with untagged rows')
}

if (filteredRows.length === 0) {
  if (args.onlyUntagged) {
    console.log('\nNo users with untagged rows found.')
    process.exit(0)
  }

  console.log('\nNo workout_set_logs rows found.')
  process.exit(0)
}

console.log(args.onlyUntagged ? '\nUsers with untagged rows' : '\nTop users by untagged rows')
console.log('--------------------------')
console.log('user_id                                 total  tagged  untagged  tagged%  latest_created_at')

for (const row of filteredRows.slice(0, Math.max(1, args.limit))) {
  const line = [
    row.userId.padEnd(36, ' '),
    String(row.total).padStart(5, ' '),
    String(row.tagged).padStart(7, ' '),
    String(row.untagged).padStart(9, ' '),
    `${String(row.taggedPct).padStart(6, ' ')}%`,
    String(row.latestCreatedAt ?? '-'),
  ].join('  ')

  console.log(line)
}
