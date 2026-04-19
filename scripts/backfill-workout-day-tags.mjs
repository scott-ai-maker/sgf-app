#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

function normalizeExerciseName(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseDateOnly(value) {
  const text = String(value ?? '')
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return null

  const [, year, month, day] = match
  const utcMillis = Date.UTC(Number(year), Number(month) - 1, Number(day))
  return Number.isFinite(utcMillis) ? new Date(utcMillis) : null
}

function dayDiffAbs(a, b) {
  if (!a || !b) return Number.MAX_SAFE_INTEGER
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.abs(Math.round((a.getTime() - b.getTime()) / msPerDay))
}

function hasWorkoutDayTag(notes) {
  return /\[workout-day:\d+\]/i.test(String(notes ?? ''))
}

function workoutDayTag(day) {
  return `[workout-day:${String(day)}]`
}

function extractWorkoutRows(planJson) {
  if (!planJson || typeof planJson !== 'object') return []

  const workouts = planJson.workouts
  if (!Array.isArray(workouts)) return []

  const rows = []

  for (const workout of workouts) {
    if (!workout || typeof workout !== 'object') continue

    const day = Number(workout.day)
    if (!Number.isFinite(day) || day <= 0) continue

    const scheduledDate = parseDateOnly(workout.scheduledDate)
    const exercises = Array.isArray(workout.exercises) ? workout.exercises : []

    for (const exercise of exercises) {
      if (!exercise || typeof exercise !== 'object') continue
      const name = normalizeExerciseName(exercise.name)
      if (!name) continue

      rows.push({ day, scheduledDate, exerciseName: name })
    }
  }

  return rows
}

function parseArgs(argv) {
  const argSet = new Set(argv.slice(2))
  return {
    apply: argSet.has('--apply') || process.env.APPLY === '1',
    limit: Number(process.env.LIMIT || 0),
  }
}

const args = parseArgs(process.argv)
const modeLabel = args.apply ? 'APPLY' : 'DRY RUN'
console.log(`Starting workout day tag backfill (${modeLabel})`)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: plans, error: plansError } = await supabase
  .from('workout_plans')
  .select('id, user_id, created_at, plan_json')

if (plansError) {
  console.error('Failed to fetch workout plans:', plansError.message)
  process.exit(1)
}

const plansByUser = new Map()
for (const plan of plans ?? []) {
  const list = plansByUser.get(plan.user_id) ?? []
  list.push({
    id: plan.id,
    createdAt: parseDateOnly(String(plan.created_at).slice(0, 10)),
    rows: extractWorkoutRows(plan.plan_json),
  })
  plansByUser.set(plan.user_id, list)
}

for (const [userId, userPlans] of plansByUser.entries()) {
  userPlans.sort((a, b) => {
    const aTs = a.createdAt?.getTime() ?? 0
    const bTs = b.createdAt?.getTime() ?? 0
    return bTs - aTs
  })
  plansByUser.set(userId, userPlans)
}

const { data: rawSetLogs, error: logsError } = await supabase
  .from('workout_set_logs')
  .select('id, user_id, workout_plan_id, session_date, exercise_name, notes')
  .order('created_at', { ascending: true })

if (logsError) {
  console.error('Failed to fetch workout set logs:', logsError.message)
  process.exit(1)
}

const pendingSetLogs = (rawSetLogs ?? []).filter(row => !hasWorkoutDayTag(row.notes))
const candidateLogs = args.limit > 0 ? pendingSetLogs.slice(0, args.limit) : pendingSetLogs

let processed = 0
let proposed = 0
let skippedNoPlan = 0
let skippedNoMatch = 0
const updates = []

for (const row of candidateLogs) {
  processed += 1

  const normalizedExercise = normalizeExerciseName(row.exercise_name)
  if (!normalizedExercise) {
    skippedNoMatch += 1
    continue
  }

  const userPlans = plansByUser.get(row.user_id) ?? []
  if (userPlans.length === 0) {
    skippedNoPlan += 1
    continue
  }

  const sessionDate = parseDateOnly(row.session_date)
  const candidates = []

  for (const plan of userPlans) {
    const exerciseRows = plan.rows.filter(ex => ex.exerciseName === normalizedExercise)
    if (exerciseRows.length === 0) continue

    for (const ex of exerciseRows) {
      let score = 0

      if (row.workout_plan_id && row.workout_plan_id === plan.id) score += 100
      if (ex.scheduledDate && sessionDate) {
        const diff = dayDiffAbs(ex.scheduledDate, sessionDate)
        if (diff === 0) score += 50
        score += Math.max(0, 30 - diff)
      } else {
        score += 5
      }

      candidates.push({
        day: ex.day,
        score,
        diff: dayDiffAbs(ex.scheduledDate, sessionDate),
      })
    }
  }

  if (candidates.length === 0) {
    skippedNoMatch += 1
    continue
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.diff !== b.diff) return a.diff - b.diff
    return a.day - b.day
  })

  const best = candidates[0]
  const tag = workoutDayTag(best.day)
  const nextNotes = `${tag} ${String(row.notes ?? '').trim()}`.trim()

  updates.push({ id: row.id, notes: nextNotes })
  proposed += 1
}

console.log(`Set logs scanned: ${processed}`)
console.log(`Rows eligible for update: ${proposed}`)
console.log(`Skipped (no user plan): ${skippedNoPlan}`)
console.log(`Skipped (no match): ${skippedNoMatch}`)

if (!args.apply) {
  console.log('Dry run complete. Re-run with --apply to write changes.')
  process.exit(0)
}

if (updates.length === 0) {
  console.log('No updates to apply.')
  process.exit(0)
}

const BATCH_SIZE = 100
let applied = 0

for (let i = 0; i < updates.length; i += BATCH_SIZE) {
  const batch = updates.slice(i, i + BATCH_SIZE)
  await Promise.all(
    batch.map(async item => {
      const { error } = await supabase
        .from('workout_set_logs')
        .update({ notes: item.notes })
        .eq('id', item.id)

      if (error) {
        throw new Error(`Update failed for ${item.id}: ${error.message}`)
      }
    })
  )

  applied += batch.length
  console.log(`Applied ${applied}/${updates.length}`)
}

console.log('Workout day tag backfill complete.')
