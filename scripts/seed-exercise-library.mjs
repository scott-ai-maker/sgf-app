import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const nasmExerciseUrlTemplate = String(process.env.NASM_EXERCISE_URL_TEMPLATE ?? '').trim()

function buildNasmExerciseUrl(exercise) {
  const explicit = String(exercise.nasm_url ?? '').trim()
  if (explicit) return explicit

  if (!nasmExerciseUrlTemplate) return null

  const id = String(exercise.nasm_id ?? exercise.source_id ?? '').trim()
  const slug = slugify(exercise.name)

  if (!id && !slug) return null

  return nasmExerciseUrlTemplate
    .replace('{id}', encodeURIComponent(id))
    .replace('{slug}', encodeURIComponent(slug))
}

const exercises = [
  {
    source_id: 'ex-back-squat',
    name: 'Back Squat',
    description: 'Barbell squat variation targeting quads, glutes, and trunk stability.',
    coaching_cues: ['Brace before descent', 'Drive through mid-foot', 'Keep chest tall'],
    primary_equipment: ['Barbell', 'Squat Rack'],
  },
  {
    source_id: 'ex-front-squat',
    name: 'Front Squat',
    description: 'Anterior-loaded squat emphasizing upright torso and quad strength.',
    coaching_cues: ['Elbows high', 'Keep pressure mid-foot', 'Sit between hips'],
    primary_equipment: ['Barbell', 'Squat Rack'],
  },
  {
    source_id: 'ex-romanian-deadlift',
    name: 'Romanian Deadlift',
    description: 'Hip hinge for posterior-chain strength and hamstring development.',
    coaching_cues: ['Push hips back', 'Soft knees', 'Keep lats engaged'],
    primary_equipment: ['Barbell'],
  },
  {
    source_id: 'ex-deadlift',
    name: 'Conventional Deadlift',
    description: 'Full-body pull from the floor to train posterior-chain power.',
    coaching_cues: ['Bar over mid-foot', 'Pull slack out of bar', 'Stand tall at lockout'],
    primary_equipment: ['Barbell'],
  },
  {
    source_id: 'ex-bench-press',
    name: 'Barbell Bench Press',
    description: 'Horizontal press focused on chest, shoulders, and triceps.',
    coaching_cues: ['Set shoulder blades', 'Wrists stacked over elbows', 'Press through full range'],
    primary_equipment: ['Barbell', 'Bench'],
  },
  {
    source_id: 'ex-incline-dumbbell-press',
    name: 'Incline Dumbbell Press',
    description: 'Upper-body press emphasizing upper chest and shoulder stability.',
    coaching_cues: ['Keep ribcage down', 'Press up and slightly in', 'Control the lowering phase'],
    primary_equipment: ['Dumbbells', 'Bench'],
  },
  {
    source_id: 'ex-overhead-press',
    name: 'Standing Overhead Press',
    description: 'Vertical pressing pattern for shoulder and trunk strength.',
    coaching_cues: ['Squeeze glutes', 'Press in straight path', 'Head through at top'],
    primary_equipment: ['Barbell'],
  },
  {
    source_id: 'ex-lat-pulldown',
    name: 'Lat Pulldown',
    description: 'Vertical pull targeting lats with adjustable loading.',
    coaching_cues: ['Drive elbows down', 'Avoid shrugging', 'Control return to top'],
    primary_equipment: ['Cable Machine'],
  },
  {
    source_id: 'ex-seated-cable-row',
    name: 'Seated Cable Row',
    description: 'Horizontal row for upper-back strength and posture support.',
    coaching_cues: ['Lead with elbows', 'Pause at torso', 'Avoid lower-back extension'],
    primary_equipment: ['Cable Machine'],
  },
  {
    source_id: 'ex-pull-up',
    name: 'Pull-Up',
    description: 'Bodyweight vertical pull building back and grip strength.',
    coaching_cues: ['Initiate from scapula', 'Keep ribs down', 'Full range each rep'],
    primary_equipment: ['Pull-Up Bar'],
  },
  {
    source_id: 'ex-bulgarian-split-squat',
    name: 'Bulgarian Split Squat',
    description: 'Unilateral lower-body movement for quad and glute strength.',
    coaching_cues: ['Stay tall through torso', 'Track front knee over foot', 'Drive through front leg'],
    primary_equipment: ['Bench', 'Dumbbells'],
  },
  {
    source_id: 'ex-walking-lunge',
    name: 'Walking Lunge',
    description: 'Dynamic unilateral pattern for lower-body strength and control.',
    coaching_cues: ['Step long enough for 90-degree knees', 'Stay upright', 'Push through full foot'],
    primary_equipment: ['Dumbbells'],
  },
  {
    source_id: 'ex-hip-thrust',
    name: 'Barbell Hip Thrust',
    description: 'Glute-focused bridge pattern with high loading potential.',
    coaching_cues: ['Ribs down at top', 'Chin tucked', 'Drive through heels'],
    primary_equipment: ['Barbell', 'Bench'],
  },
  {
    source_id: 'ex-leg-press',
    name: 'Leg Press',
    description: 'Machine-based squat pattern for lower-body volume training.',
    coaching_cues: ['Control depth', 'Keep low back stable', 'Press through full foot'],
    primary_equipment: ['Leg Press Machine'],
  },
  {
    source_id: 'ex-leg-curl',
    name: 'Seated Leg Curl',
    description: 'Machine hamstring isolation movement for knee flexion strength.',
    coaching_cues: ['Keep hips pinned', 'Full squeeze each rep', 'Control eccentric'],
    primary_equipment: ['Leg Curl Machine'],
  },
  {
    source_id: 'ex-leg-extension',
    name: 'Leg Extension',
    description: 'Machine quad isolation movement for knee extension strength.',
    coaching_cues: ['Set knee with machine axis', 'Pause at top', 'Lower under control'],
    primary_equipment: ['Leg Extension Machine'],
  },
  {
    source_id: 'ex-plank',
    name: 'Front Plank',
    description: 'Anti-extension core drill for trunk endurance.',
    coaching_cues: ['Squeeze glutes', 'Ribs down', 'Push floor away'],
    primary_equipment: ['Bodyweight'],
  },
  {
    source_id: 'ex-side-plank',
    name: 'Side Plank',
    description: 'Lateral core stability drill targeting obliques and hips.',
    coaching_cues: ['Stack shoulders and hips', 'Drive elbow into floor', 'Keep body straight'],
    primary_equipment: ['Bodyweight'],
  },
  {
    source_id: 'ex-pallof-press',
    name: 'Pallof Press',
    description: 'Anti-rotation core movement performed with cable resistance.',
    coaching_cues: ['Stay square to anchor', 'Press straight forward', 'Minimize trunk rotation'],
    primary_equipment: ['Cable Machine'],
  },
  {
    source_id: 'ex-farmer-carry',
    name: 'Farmer Carry',
    description: 'Loaded carry for grip, trunk, and gait strength.',
    coaching_cues: ['Stand tall', 'Short controlled steps', 'Keep shoulders packed'],
    primary_equipment: ['Dumbbells'],
  },
]

const source = 'manual_seed'

const exerciseRows = exercises.map(exercise => {
  // URL resolution order:
  // 1) exercise.nasm_url (explicit per item)
  // 2) NASM_EXERCISE_URL_TEMPLATE env var using {id} and/or {slug}
  // 3) null
  const nasmExerciseUrl = buildNasmExerciseUrl(exercise)

  return {
    source,
    source_id: exercise.source_id,
    slug: slugify(exercise.name),
    name: exercise.name,
    description: exercise.description,
    coaching_cues: exercise.coaching_cues,
    primary_equipment: exercise.primary_equipment,
    media_video_url: nasmExerciseUrl,
    metadata_json: {
      seededBy: 'scripts/seed-exercise-library.mjs',
      version: 2,
      nasmUrl: nasmExerciseUrl,
    },
    is_active: true,
  }
})

const equipmentNames = [...new Set(exercises.flatMap(exercise => exercise.primary_equipment))]

const equipmentRows = equipmentNames.map(name => ({
  source,
  source_id: `eq-${slugify(name)}`,
  slug: slugify(name),
  name,
  description: `${name} used in programmed exercises.`,
  metadata_json: { seededBy: 'scripts/seed-exercise-library.mjs', version: 1 },
  is_active: true,
}))

const { error: clearExercisesError } = await supabase
  .from('exercise_library_entries')
  .delete()
  .eq('source', source)

if (clearExercisesError) {
  console.error('Failed to clear existing seeded exercises:', clearExercisesError.message)
  process.exit(1)
}

const { error: exerciseError } = await supabase
  .from('exercise_library_entries')
  .insert(exerciseRows)

if (exerciseError) {
  console.error('Failed to upsert exercise_library_entries:', exerciseError.message)
  process.exit(1)
}

const { error: clearEquipmentError } = await supabase
  .from('equipment_library_entries')
  .delete()
  .eq('source', source)

if (clearEquipmentError) {
  console.error('Failed to clear existing seeded equipment:', clearEquipmentError.message)
  process.exit(1)
}

const { error: equipmentError } = await supabase
  .from('equipment_library_entries')
  .insert(equipmentRows)

if (equipmentError) {
  console.error('Failed to upsert equipment_library_entries:', equipmentError.message)
  process.exit(1)
}

const [{ count: exerciseCount, error: exerciseCountError }, { count: equipmentCount, error: equipmentCountError }] = await Promise.all([
  supabase
    .from('exercise_library_entries')
    .select('*', { count: 'exact', head: true })
    .eq('source', source),
  supabase
    .from('equipment_library_entries')
    .select('*', { count: 'exact', head: true })
    .eq('source', source),
])

if (exerciseCountError || equipmentCountError) {
  console.error('Seed completed, but failed to fetch counts.')
  process.exit(1)
}

console.log(`Seed complete. Exercises (${source}): ${exerciseCount}`)
console.log(`Seed complete. Equipment (${source}): ${equipmentCount}`)