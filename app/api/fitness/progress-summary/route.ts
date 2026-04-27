import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  let userId = ''
  try {
    const authz = await getRequestAuthz(req)
    userId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const admin = supabaseAdmin()

  // Fetch last 16 check-ins — select measurement columns separately with a fallback
  // so the endpoint doesn't fail if the ALTER TABLE hasn't been run on the live DB yet.
  const { data: checkins, error: checkinsError } = await admin
    .from('weekly_checkins')
    .select('week_start, weight_kg, sleep_quality, stress_level, soreness_level, energy_level')
    .eq('user_id', userId)
    .order('week_start', { ascending: true })
    .limit(16)

  if (checkinsError) {
    return NextResponse.json({ error: 'Failed to load check-ins' }, { status: 500 })
  }

  // Try to fetch measurement columns separately — they may not exist yet if schema migration
  // hasn't been applied. Failures here are silently ignored.
  let measurementRows: Array<{ week_start: string; waist_cm: number | null; hip_cm: number | null; neck_cm: number | null }> = []
  try {
    const { data: mData } = await admin
      .from('weekly_checkins')
      .select('week_start, waist_cm, hip_cm, neck_cm')
      .eq('user_id', userId)
      .order('week_start', { ascending: true })
      .limit(16)
    measurementRows = (mData ?? []) as typeof measurementRows
  } catch {
    // columns not yet migrated — skip silently
  }

  // Weight trend: only entries with a non-null weight
  const weightTrend = (checkins ?? [])
    .filter((c) => c.weight_kg != null)
    .map((c) => ({ weekStart: c.week_start, weightKg: c.weight_kg as number }))

  // Measurement trend: waist/hip/neck over time
  const measurementTrend = measurementRows
    .filter((c) => c.waist_cm != null || c.hip_cm != null || c.neck_cm != null)
    .map((c) => ({
      weekStart: c.week_start,
      waistCm: c.waist_cm as number | null,
      hipCm: c.hip_cm as number | null,
      neckCm: c.neck_cm as number | null,
    }))

  // Wellness trend: entries where at least one rating is present
  const wellnessTrend = (checkins ?? [])
    .filter(
      (c) =>
        c.sleep_quality != null ||
        c.energy_level != null ||
        c.stress_level != null ||
        c.soreness_level != null
    )
    .map((c) => ({
      weekStart: c.week_start,
      sleepQuality: c.sleep_quality as number | null,
      energyLevel: c.energy_level as number | null,
      stressLevel: c.stress_level as number | null,
      sorenessLevel: c.soreness_level as number | null,
    }))

  // Personal records: max weight per exercise from set logs
  const { data: setLogs, error: setLogsError } = await admin
    .from('workout_set_logs')
    .select('exercise_name, weight_kg, reps, created_at')
    .eq('user_id', userId)
    .not('weight_kg', 'is', null)
    .gt('weight_kg', 0)
    .order('weight_kg', { ascending: false })

  if (setLogsError) {
    return NextResponse.json({ error: 'Failed to load set logs' }, { status: 500 })
  }

  // Deduplicate — one PR per exercise (already ordered desc by weight)
  const seen = new Set<string>()
  const personalRecords: Array<{
    exerciseName: string
    weightKg: number
    reps: number | null
    achievedAt: string
  }> = []

  for (const row of setLogs ?? []) {
    const key = row.exercise_name?.toLowerCase()?.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    personalRecords.push({
      exerciseName: row.exercise_name,
      weightKg: row.weight_kg,
      reps: row.reps ?? null,
      achievedAt: row.created_at,
    })
    if (personalRecords.length >= 20) break
  }

  const strengthByExercise = new Map<
    string,
    Array<{ sessionDate: string; bestWeightKg: number; bestReps: number | null }>
  >()

  for (const row of setLogs ?? []) {
    const exerciseName = row.exercise_name?.trim()
    const sessionDate = row.created_at?.slice(0, 10)
    if (!exerciseName || !sessionDate || row.weight_kg == null) continue

    const existingSeries = strengthByExercise.get(exerciseName) ?? []
    const existingPoint = existingSeries.find((point) => point.sessionDate === sessionDate)
    if (!existingPoint) {
      existingSeries.push({
        sessionDate,
        bestWeightKg: row.weight_kg,
        bestReps: row.reps ?? null,
      })
      strengthByExercise.set(exerciseName, existingSeries)
      continue
    }

    if (row.weight_kg > existingPoint.bestWeightKg) {
      existingPoint.bestWeightKg = row.weight_kg
      existingPoint.bestReps = row.reps ?? null
    }
  }

  const strengthTrend = Array.from(strengthByExercise.entries())
    .map(([exerciseName, points]) => ({
      exerciseName,
      points: points.sort((left, right) => left.sessionDate.localeCompare(right.sessionDate)),
    }))
    .filter((series) => series.points.length >= 2)
    .sort((left, right) => right.points.length - left.points.length)
    .slice(0, 6)

  return NextResponse.json({
    weightTrend,
    measurementTrend,
    wellnessTrend,
    strengthTrend,
    personalRecords,
  })
}
