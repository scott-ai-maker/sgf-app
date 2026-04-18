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
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const nasmExerciseUrlTemplate = String(process.env.NASM_EXERCISE_URL_TEMPLATE ?? '').trim()

function normalizeText(value) {
  return String(value ?? '').trim()
}

function parseList(value) {
  return normalizeText(value)
    .split(',')
    .map(item => normalizeText(item))
    .filter(Boolean)
}

function uniqueByLower(values) {
  const seen = new Set()
  const out = []
  for (const value of values) {
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function titleCaseFromSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function extractSlugFromThumbnail(value) {
  const text = normalizeText(value)
  if (!text) return null
  const match = text.match(/\/exercises\/([^/?#.]+)\./i)
  if (!match) return null
  return slugify(match[1])
}

function buildNasmExerciseUrl(slug) {
  if (!slug) return null

  if (nasmExerciseUrlTemplate) {
    return nasmExerciseUrlTemplate
      .replace('{id}', encodeURIComponent(slug))
      .replace('{slug}', encodeURIComponent(slug))
  }

  return `https://www.nasm.org/resource-center/exercise-library/${slug}`
}

function parseCoachingCues(description) {
  const text = normalizeText(description)
  if (!text) return []

  const rawLines = text
    .split('\n')
    .map(line => normalizeText(line.replace(/^Step\s*\d+\s*:\s*/i, '')))
    .filter(Boolean)

  if (rawLines.length > 0) {
    return rawLines.slice(0, 4)
  }

  return text
    .split('.')
    .map(line => normalizeText(line))
    .filter(Boolean)
    .slice(0, 4)
}

async function fetchNasmCatalog() {
  const response = await fetch('https://www.nasm.org/documents/exercises.json')

  if (!response.ok) {
    console.error(`Failed to fetch NASM catalog: ${response.status}`)
    process.exit(1)
  }

  const payload = await response.json()
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : []

  if (items.length === 0) {
    console.error('NASM catalog is empty or unexpected format.')
    process.exit(1)
  }

  return items
}

const source = 'nasm_exercise_library'

const catalog = await fetchNasmCatalog()
const bySlug = new Map()

for (const item of catalog) {
  const title = normalizeText(item?.Title)
  const slug = extractSlugFromThumbnail(item?.['Video Thumbnail']) || slugify(title)
  if (!slug) continue
  if (bySlug.has(slug)) continue

  const nasmUrl = buildNasmExerciseUrl(slug)
  const bodyParts = uniqueByLower(parseList(item?.['Body Part']))
  const equipment = uniqueByLower(parseList(item?.Equipment))

  bySlug.set(slug, {
    source,
    source_id: slug,
    slug,
    // User requested naming based on NASM slug (slug is source of truth).
    name: titleCaseFromSlug(slug),
    description: normalizeText(item?.Description) || null,
    coaching_cues: parseCoachingCues(item?.Description),
    primary_equipment: equipment,
    media_video_url: normalizeText(item?.['Video URL']) || nasmUrl,
    metadata_json: {
      seededBy: 'scripts/seed-exercise-library.mjs',
      version: 3,
      nasmTitle: title || null,
      nasmSlug: slug,
      nasmUrl,
      nasmVideoThumbnail: normalizeText(item?.['Video Thumbnail']) || null,
      difficulty: normalizeText(item?.Difficulty) || null,
      bodyParts,
    },
    is_active: true,
  })
}

const exerciseRows = [...bySlug.values()]

const equipmentNames = uniqueByLower(exerciseRows.flatMap(exercise => exercise.primary_equipment))

const equipmentRows = equipmentNames.map(name => ({
  source,
  source_id: `eq-${slugify(name)}`,
  slug: slugify(name),
  name,
  description: `${name} listed in NASM exercise library.`,
  metadata_json: { seededBy: 'scripts/seed-exercise-library.mjs', version: 2 },
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