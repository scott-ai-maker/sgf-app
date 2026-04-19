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
  const text = `${exerciseName} ${description || ''}`.toLowerCase()

  const muscleKeywords = {
    chest: ['chest', 'pec', 'bench press', 'fly'],
    back: ['back', 'lat', 'row', 'pull', 'lats'],
    shoulders: ['shoulder', 'press', 'raise', 'delt', 'overhead'],
    biceps: ['bicep', 'curl', 'arm curl'],
    triceps: ['tricep', 'overhead extension', 'dip', 'pushdown'],
    forearms: ['forearm', 'wrist curl', 'wrist'],
    quadriceps: ['quad', 'leg press', 'leg extension', 'squat'],
    hamstrings: ['hamstring', 'leg curl', 'deadlift', 'rdl'],
    glutes: ['glute', 'hip thrust', 'leg press', 'squat', 'lunge', 'butt'],
    calves: ['calf', 'ankle', 'standing calf'],
    core: ['core', 'crunch', 'plank', 'ab', 'abs'],
    legs: ['leg', 'squat', 'lunge', 'extension', 'curl', 'press'],
  }

  const detected = new Set()
  for (const [muscle, keywords] of Object.entries(muscleKeywords)) {
    if (keywords.some(k => text.includes(k))) {
      detected.add(muscle)
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

    // Get all active exercises
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
    let skipped = 0
    const BATCH_SIZE = 50

    for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
      const batch = exercises.slice(i, i + BATCH_SIZE)
      const updates = []

      for (const exercise of batch) {
        // Only update if muscle_groups is empty or null
        if (!exercise.muscle_groups || exercise.muscle_groups.length === 0) {
          const muscleGroups = extractMuscleGroups(exercise.name, exercise.description)

          if (muscleGroups.length > 0) {
            updates.push({
              id: exercise.id,
              muscle_groups: muscleGroups,
            })
          }
        } else {
          skipped++
        }
      }

      if (updates.length > 0) {
        console.log(`  ✏️  Updating ${updates.length} exercises...`)

        for (const update of updates) {
          const { error: updateError } = await client
            .from('exercise_library_entries')
            .update({ muscle_groups: update.muscle_groups })
            .eq('id', update.id)

          if (updateError) {
            console.error(`    ❌ Error updating ${update.id}:`, updateError.message)
          } else {
            updated++
            console.log(`    ✅ ${updates.find(u => u.id === update.id)?.muscle_groups?.join(', ') || 'no groups'}`)
          }
        }
      }
    }

    console.log(`\n✨ Backfill complete!`)
    console.log(`  ✅ Updated: ${updated} exercises`)
    console.log(`  ⏭️  Skipped: ${skipped} exercises (already have data)`)
  } catch (error) {
    console.error('❌ Backfill failed:', error.message)
    process.exit(1)
  }
}

backfillMuscleGroups()
