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

function normalizeText(value) {
  return String(value ?? '').trim()
}

function canonicalExerciseKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatExerciseDescription(description) {
  const text = String(description ?? '').replace(/\r/g, '').trim()
  if (!text) return null

  const numberedSteps = text.match(/Step\s*\d+\s*:[\s\S]*?(?=(?:\s*Step\s*\d+\s*:)|$)/gi)
  if (numberedSteps && numberedSteps.length > 1) {
    return numberedSteps
      .map(step => step.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n\n')
  }

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  if (lines.length > 1) {
    return lines.join('\n\n')
  }

  return text.replace(/\s+/g, ' ')
}

async function fetchNasmCatalog() {
  console.log('Fetching NASM catalog...')
  try {
    const response = await fetch('https://www.nasm.org/documents/exercises.json')
    if (!response.ok) {
      console.error(`Failed to fetch NASM catalog: ${response.status}`)
      return null
    }

    const payload = await response.json()
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : []

    return items
  } catch (err) {
    console.error('Error fetching NASM catalog:', err.message)
    return null
  }
}

async function enrichFromCatalog() {
  console.log('Fetching YouTube exercises with missing descriptions...')
  
  const { data: youtubeExercises, error: fetchError } = await supabase
    .from('exercise_library_entries')
    .select('id, name, slug, metadata_json')
    .or('description.is.null,description.eq.""')
    .eq('source', 'nasm_exercise_library')
    .limit(200)

  if (fetchError) {
    console.error('Failed to fetch exercises:', fetchError.message)
    process.exit(1)
  }

  const youtubeExercisesOnly = youtubeExercises.filter(ex => 
    ex.metadata_json?.nasmEdgeVideoId && 
    !ex.metadata_json?.nasmSlug
  )

  if (youtubeExercisesOnly.length === 0) {
    console.log('✓ No YouTube-only exercises need enrichment')
    process.exit(0)
  }

  console.log(`Found ${youtubeExercisesOnly.length} YouTube exercises without descriptions\n`)
  
  // Fetch NASM catalog to match exercises
  const nasmCatalog = await fetchNasmCatalog()
  if (!nasmCatalog || nasmCatalog.length === 0) {
    console.error('Could not fetch NASM catalog for matching')
    process.exit(1)
  }

  // Build a lookup map of catalog exercises by canonical name
  const catalogByCanonical = new Map()
  for (const item of nasmCatalog) {
    const title = normalizeText(item?.Title)
    const description = normalizeText(item?.Description)
    if (title && description) {
      const key = canonicalExerciseKey(title)
      if (key && !catalogByCanonical.has(key)) {
        catalogByCanonical.set(key, formatExerciseDescription(description))
      }
    }
  }

  console.log(`Catalog has ${catalogByCanonical.size} exercises with descriptions`)
  console.log('Matching YouTube exercises with catalog...\n')

  let enriched = 0
  let failed = 0

  for (const exercise of youtubeExercisesOnly) {
    const exerciseName = exercise.name || exercise.slug
    const key = canonicalExerciseKey(exerciseName)
    const matchedDescription = catalogByCanonical.get(key)

    if (!matchedDescription) {
      console.log(`⊘ ${exerciseName} - No catalog match found`)
      failed++
      continue
    }

    console.log(`↓ Matching ${exerciseName}...`)

    const { error: updateError } = await supabase
      .from('exercise_library_entries')
      .update({ 
        description: matchedDescription,
        updated_at: new Date().toISOString(),
      })
      .eq('id', exercise.id)

    if (updateError) {
      console.log(`  ✗ Failed to update: ${updateError.message}`)
      failed++
      continue
    }

    console.log(`  ✓ Updated (${matchedDescription.slice(0, 50)}...)`)
    enriched++
  }

  console.log(`\n✓ Enrichment complete: ${enriched} updated, ${failed} still need manual review`)
}

await enrichFromCatalog()
