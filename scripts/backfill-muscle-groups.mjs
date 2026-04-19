#!/usr/bin/env node

/**
 * Backfill muscle groups metadata for exercise library
 * Extracts muscle groups from exercise names and descriptions
 * Run with: node scripts/backfill-muscle-groups.mjs
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const client = createClient(supabaseUrl, supabaseServiceKey)

function extractMuscleGroups(exerciseName, description) {
  const name = exerciseName.toLowerCase()

  // Ordered from most specific to least — first match wins for primary,
  // then accumulate secondary groups below.
  const detected = new Set()

  // ── LOWER BODY ─────────────────────────────────────────────
  if (
    name.match(/\bsquat\b|leg press|hack squat|goblet squat|front squat|box squat|sumo squat/)
  ) {
    detected.add('quadriceps')
    detected.add('hamstrings')
    detected.add('glutes')
  }

  if (
    name.match(/\blunge\b|split squat|step.?up|bulgarian|step down|curtsy/)
  ) {
    detected.add('quadriceps')
    detected.add('hamstrings')
    detected.add('glutes')
  }

  if (
    name.match(/leg curl|hamstring curl|nordic|glute.ham|good morning|rdl|romanian|straight.leg deadlift/)
  ) {
    detected.add('hamstrings')
    detected.add('glutes')
  }

  if (
    name.match(/hip thrust|glute bridge|hip extension|donkey kick|fire hydrant/)
  ) {
    detected.add('glutes')
    detected.add('hamstrings')
  }

  if (
    name.match(/leg extension|terminal knee|quad/)
  ) {
    detected.add('quadriceps')
  }

  if (
    name.match(/calf raise|heel raise|ankle|tibialis/)
  ) {
    detected.add('calves')
  }

  if (
    name.match(/abduction|adduction|hip abduct|hip adduct|clamshell|lateral band walk/)
  ) {
    detected.add('glutes')
    detected.add('legs')
  }

  // ── PLYOMETRICS / JUMPS → always legs ──────────────────────
  if (
    name.match(/jump|box jump|hurdle|tuck jump|broad jump|depth jump|bound|hop\b|leap/)
  ) {
    detected.add('quadriceps')
    detected.add('glutes')
    detected.add('hamstrings')
    detected.add('calves')
  }

  // ── DEADLIFTS ───────────────────────────────────────────────
  if (
    name.match(/deadlift|trap bar|sumo dead/)
  ) {
    detected.add('hamstrings')
    detected.add('glutes')
    detected.add('back')
  }

  // ── UPPER BODY PUSH ─────────────────────────────────────────
  if (
    name.match(/bench press|chest press|chest fly|pec|push.?up|push up|dip\b|dips\b|cable crossover|chest/)
  ) {
    detected.add('chest')
    detected.add('triceps')
    if (!name.match(/incline|decline|flat/)) detected.add('shoulders')
  }

  if (
    name.match(/incline|decline/)
  ) {
    detected.add('chest')
    detected.add('triceps')
  }

  if (
    name.match(/shoulder press|overhead press|military press|arnold press|seated press|standing press|dumbbell press|ohp\b/)
    && !name.match(/bench|chest|leg press|hip press/)
  ) {
    detected.add('shoulders')
    detected.add('triceps')
  }

  if (
    name.match(/lateral raise|front raise|rear delt|side raise|upright row|face pull|cable rear|band pull.?apart/)
  ) {
    detected.add('shoulders')
  }

  if (
    name.match(/tricep|skull crusher|overhead extension|cable push.*down|pushdown|close.grip/)
  ) {
    detected.add('triceps')
  }

  // ── UPPER BODY PULL ─────────────────────────────────────────
  if (
    name.match(/pull.?up|chin.?up|lat pulldown|straight.arm|pulldown\b/)
  ) {
    detected.add('back')
    detected.add('biceps')
  }

  if (
    name.match(/\brow\b|seated row|cable row|bent over row|t.bar row|machine row|dumbbell row|chest.supported/)
  ) {
    detected.add('back')
    detected.add('biceps')
  }

  if (
    name.match(/shrug|trap|farmer|carry\b|suitcase/)
  ) {
    detected.add('back')
    detected.add('shoulders')
  }

  if (
    name.match(/bicep curl|barbell curl|hammer curl|preacher curl|concentration curl|spider curl|\bcurl\b/)
    && !name.match(/hair curl|leg curl|hamstring curl/)
  ) {
    detected.add('biceps')
  }

  // ── CORE ────────────────────────────────────────────────────
  if (
    name.match(/plank|crunch|sit.?up|ab \w|core|pallof|dead bug|bird.?dog|hollow|l.?sit|leg raise|knee raise|cable crunch|russian twist|woodchop|chop\b/)
  ) {
    detected.add('core')
  }

  // ── COMPOUND / TOTAL BODY ───────────────────────────────────
  if (name.match(/clean\b|power clean|hang clean|snatch|thruster|kettlebell swing|swing\b/)) {
    detected.add('quadriceps')
    detected.add('hamstrings')
    detected.add('glutes')
    detected.add('back')
    detected.add('shoulders')
  }

  if (name.match(/burpee/)) {
    detected.add('quadriceps')
    detected.add('chest')
    detected.add('core')
  }

  // ── FLEXIBILITY / STABILITY / BALANCE ───────────────────────
  if (name.match(/single.?leg|balance|stabiliz|bosu|wobble/)) {
    detected.add('glutes')
    detected.add('core')
  }

  // If nothing was detected, mark as full body
  if (detected.size === 0) {
    const text = `${exerciseName} ${description || ''}`.toLowerCase()
    if (text.match(/leg|lower body|squat|lunge/)) {
      detected.add('quadriceps'); detected.add('hamstrings'); detected.add('glutes')
    } else if (text.match(/back|row|pull/)) {
      detected.add('back')
    } else if (text.match(/chest|press|push/)) {
      detected.add('chest')
    } else {
      detected.add('full body')
    }
  }

  return Array.from(detected).sort()
}

async function backfillMuscleGroups() {
  try {
    // Ensure column exists by testing with a count query
    console.log('🔄 Checking muscle_groups column...')
    const { error: colCheckError } = await client
      .from('exercise_library_entries')
      .select('muscle_groups')
      .limit(1)

    if (colCheckError?.message?.includes('column') && colCheckError?.message?.includes('does not exist')) {
      console.error('❌ Column muscle_groups does not exist yet.')
      console.error('')
      console.error('Run this SQL in your Supabase SQL editor:')
      console.error('  ALTER TABLE exercise_library_entries ADD COLUMN IF NOT EXISTS muscle_groups text[] DEFAULT ARRAY[]::text[];')
      process.exit(1)
    }

    console.log('✅ Column exists. Finding exercises to update...')

    // Get all active exercises — always overwrite for accuracy
    const { data: exercises, error: fetchError } = await client
      .from('exercise_library_entries')
      .select('id, name, description, muscle_groups')
      .eq('is_active', true)
      .limit(5000)

    if (fetchError) throw fetchError

    if (!exercises || exercises.length === 0) {
      console.log('✅ No exercises found')
      return
    }

    console.log(`📚 Found ${exercises.length} active exercises`)

    let updated = 0
    let unchanged = 0
    const BATCH_SIZE = 50

    for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
      const batch = exercises.slice(i, i + BATCH_SIZE)
      const updates = []

      for (const exercise of batch) {
        const muscleGroups = extractMuscleGroups(exercise.name, exercise.description)
        const existing = (exercise.muscle_groups || []).slice().sort().join(',')
        const incoming = muscleGroups.slice().sort().join(',')

        if (existing !== incoming) {
          updates.push({ id: exercise.id, name: exercise.name, muscle_groups: muscleGroups })
        } else {
          unchanged++
        }
      }

      if (updates.length > 0) {
        for (const update of updates) {
          const { error: updateError } = await client
            .from('exercise_library_entries')
            .update({ muscle_groups: update.muscle_groups })
            .eq('id', update.id)

          if (updateError) {
            console.error(`  ❌ Error updating "${update.name}":`, updateError.message)
          } else {
            updated++
            console.log(`  ✅ ${update.name} → [${update.muscle_groups.join(', ')}]`)
          }
        }
      }
    }

    console.log(`\n✨ Backfill complete!`)
    console.log(`  ✅ Updated: ${updated} exercises`)
    console.log(`  ⏭️  Unchanged: ${unchanged} exercises`)
  } catch (error) {
    console.error('❌ Backfill failed:', error.message)
    process.exit(1)
  }
}

backfillMuscleGroups()
