#!/usr/bin/env node

/**
 * Fix exercise names that had apostrophes stripped during initial seeding
 * Restores proper names like "Child's Pose" instead of "Child S Pose"
 * Run with: node scripts/fix-apostrophe-names.mjs
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Map of patterns to fix: regex to match broken name => correct name
const FIXES = [
  {
    pattern: /^Child S Pose$/i,
    corrected: "Child's Pose",
  },
  {
    pattern: /^Toe S Pose$/i,
    corrected: "Toe's Pose",
  },
  {
    pattern: /^O S Pose$/i,
    corrected: "O's Pose",
  },
]

async function fixApostrophes() {
  console.log('🔍 Scanning for exercises with missing apostrophes...\n')

  const { data: exercises, error: fetchError } = await supabase
    .from('exercise_library_entries')
    .select('id, name, slug')
    .eq('is_active', true)

  if (fetchError) {
    console.error('Error fetching exercises:', fetchError)
    process.exit(1)
  }

  let fixCount = 0

  for (const exercise of exercises) {
    for (const { pattern, corrected } of FIXES) {
      if (pattern.test(exercise.name)) {
        console.log(`  ✏️  "${exercise.name}" → "${corrected}"`)

        const { error: updateError } = await supabase
          .from('exercise_library_entries')
          .update({ name: corrected })
          .eq('id', exercise.id)

        if (updateError) {
          console.error(`    ❌ Error updating ${exercise.id}:`, updateError)
        } else {
          console.log(`    ✓ Updated`)
          fixCount += 1
        }

        break // Only apply first matching pattern
      }
    }
  }

  console.log(`\n✅ Fixed ${fixCount} exercise name(s)`)
}

await fixApostrophes()
process.exit(0)
