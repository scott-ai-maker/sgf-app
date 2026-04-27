import { NextRequest, NextResponse } from 'next/server'

import { getRequestAuthz, requireRole, requireCoachAssignedClient, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let coachId = ''
  try {
    const authz = await getRequestAuthz(req)
    requireRole(authz.client.role, ['coach'])
    coachId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const { id: clientId } = await params

  try {
    await requireCoachAssignedClient(coachId, clientId)
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Forbidden'
    return NextResponse.json({ error: message }, { status })
  }

  const { data, error } = await supabaseAdmin()
    .from('workout_video_events')
    .select('exercise_name, event_type, watch_seconds, created_at')
    .eq('user_id', clientId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: 'Failed to load video analytics' }, { status: 500 })
  }

  const byExercise = new Map<string, { started: number; completed: number; totalWatchSeconds: number }>()

  for (const row of data ?? []) {
    const key = row.exercise_name?.trim()
    if (!key) continue
    const current = byExercise.get(key) ?? { started: 0, completed: 0, totalWatchSeconds: 0 }

    if (row.event_type === 'started') current.started += 1
    if (row.event_type === 'completed') current.completed += 1
    if (row.watch_seconds != null) current.totalWatchSeconds += Math.max(0, Number(row.watch_seconds) || 0)

    byExercise.set(key, current)
  }

  const exercises = Array.from(byExercise.entries())
    .map(([exerciseName, stats]) => {
      const completionRate = stats.started > 0 ? stats.completed / stats.started : 0
      const avgWatchSeconds = stats.completed > 0 ? stats.totalWatchSeconds / stats.completed : 0
      return {
        exerciseName,
        started: stats.started,
        completed: stats.completed,
        completionRate,
        avgWatchSeconds,
      }
    })
    .sort((left, right) => right.started - left.started)
    .slice(0, 12)

  const totals = exercises.reduce(
    (acc, row) => {
      acc.started += row.started
      acc.completed += row.completed
      acc.avgWatchSecondsSum += row.avgWatchSeconds
      return acc
    },
    { started: 0, completed: 0, avgWatchSecondsSum: 0 }
  )

  const summary = {
    started: totals.started,
    completed: totals.completed,
    completionRate: totals.started > 0 ? totals.completed / totals.started : 0,
    avgWatchSeconds: exercises.length > 0 ? totals.avgWatchSecondsSum / exercises.length : 0,
  }

  return NextResponse.json({ summary, exercises })
}