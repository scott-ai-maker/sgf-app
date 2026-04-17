import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  process.exit(1)
}

const source = 'exercisedb'
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeArray(values) {
  if (!Array.isArray(values)) return []

  const unique = new Set()

  return values
    .map(item => normalizeText(item))
    .filter(item => {
      if (!item) return false
      const key = item.toLowerCase()
      if (unique.has(key)) return false
      unique.add(key)
      return true
    })
}

function firstNonEmptyArray(...candidates) {
  for (const candidate of candidates) {
    const normalized = normalizeArray(candidate)
    if (normalized.length > 0) {
      return normalized
    }
  }

  return []
}

function toNullableText(value) {
  const normalized = normalizeText(value)
  return normalized ? normalized : null
}

function toDescription(record) {
  const overview = toNullableText(record.overview)
  if (overview) return overview

  const instructions = normalizeArray(record.instructions)
  if (instructions.length > 0) {
    return instructions.join(' ')
  }

  return null
}

function toAbsoluteAssetUrl(rawValue, baseUrl) {
  const value = normalizeText(rawValue)
  if (!value) return null

  if (/^https?:\/\//i.test(value)) {
    return value
  }

  if (!baseUrl) {
    return null
  }

  return `${baseUrl.replace(/\/$/, '')}/${value.replace(/^\//, '')}`
}

function buildExerciseDbConfig() {
  const baseUrl = normalizeText(process.env.EXERCISEDB_BASE_URL || 'https://exercisedb.p.rapidapi.com')
  const exercisesPath = normalizeText(process.env.EXERCISEDB_EXERCISES_PATH || '/exercises')
  const exerciseByIdPath = normalizeText(process.env.EXERCISEDB_EXERCISE_BY_ID_PATH || '/api/v1/exercises/{id}')
  const equipmentsPath = normalizeText(process.env.EXERCISEDB_EQUIPMENTS_PATH || '/api/v1/equipments')
  const apiHost = normalizeText(process.env.EXERCISEDB_API_HOST)
  const apiKey = normalizeText(process.env.EXERCISEDB_API_KEY)
  const bearerToken = normalizeText(process.env.EXERCISEDB_BEARER_TOKEN)

  if (!apiKey && !bearerToken) {
    console.error('Missing EXERCISEDB_API_KEY or EXERCISEDB_BEARER_TOKEN.')
    process.exit(1)
  }

  return {
    baseUrl,
    exercisesPath,
    exerciseByIdPath,
    equipmentsPath,
    pageSize: Math.max(1, Number(process.env.EXERCISEDB_PAGE_SIZE || 200)),
    maxPages: Math.max(1, Number(process.env.EXERCISEDB_MAX_PAGES || 200)),
    enrichById: String(process.env.EXERCISEDB_ENRICH_BY_ID || '1').trim() !== '0',
    enrichConcurrency: Math.max(1, Number(process.env.EXERCISEDB_ENRICH_CONCURRENCY || 5)),
    headers: {
      Accept: 'application/json',
      ...(apiHost ? { 'x-rapidapi-host': apiHost } : {}),
      ...(apiKey ? { 'x-rapidapi-key': apiKey, 'x-api-key': apiKey } : {}),
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    },
  }
}

function byIdUrl(config, exerciseId) {
  const path = config.exerciseByIdPath.includes('{id}')
    ? config.exerciseByIdPath.replace('{id}', encodeURIComponent(exerciseId))
    : `${config.exerciseByIdPath.replace(/\/$/, '')}/${encodeURIComponent(exerciseId)}`

  return new URL(path, `${config.baseUrl.replace(/\/$/, '')}/`)
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function readCollectionRows(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.results)) return payload.results
  return []
}

async function fetchExerciseDbExercises(config) {

  const exercises = []
  const seenExerciseIds = new Set()
  const seenCursors = new Set()
  let offset = 0
  let afterCursor = null

  for (let page = 0; page < config.maxPages; page += 1) {
    const url = new URL(config.exercisesPath, `${config.baseUrl.replace(/\/$/, '')}/`)

    if (!url.searchParams.has('limit')) {
      url.searchParams.set('limit', String(config.pageSize))
    }
    if (!url.searchParams.has('offset')) {
      url.searchParams.set('offset', String(offset))
    }
    if (afterCursor && !url.searchParams.has('after')) {
      url.searchParams.set('after', afterCursor)
    }

    const response = await fetch(url, { headers: config.headers })

    if (!response.ok) {
      const payload = await response.text()
      console.error(`ExerciseDB request failed (${response.status}): ${payload.slice(0, 500)}`)
      process.exit(1)
    }

    const payload = await response.json()
    const pageData = readCollectionRows(payload)

    if (pageData.length === 0) {
      break
    }

    for (const item of pageData) {
      const id = normalizeText(item?.exerciseId || item?.id)
      if (!id || seenExerciseIds.has(id)) continue

      seenExerciseIds.add(id)
      exercises.push(item)
    }

    const nextCursor = normalizeText(payload?.meta?.nextCursor)
    if (nextCursor) {
      if (seenCursors.has(nextCursor)) {
        break
      }

      seenCursors.add(nextCursor)
      afterCursor = nextCursor
      continue
    }

    if (pageData.length < config.pageSize) {
      break
    }

    offset += config.pageSize
  }

  if (exercises.length === 0) {
    console.error('No exercises returned from ExerciseDB. Check endpoint and credentials.')
    process.exit(1)
  }

  return exercises
}

async function fetchExerciseDbEquipments(config) {
  const equipmentNames = []
  const seenNames = new Set()
  const seenCursors = new Set()
  let offset = 0
  let afterCursor = null

  for (let page = 0; page < config.maxPages; page += 1) {
    const url = new URL(config.equipmentsPath, `${config.baseUrl.replace(/\/$/, '')}/`)

    if (!url.searchParams.has('limit')) {
      url.searchParams.set('limit', String(config.pageSize))
    }
    if (!url.searchParams.has('offset')) {
      url.searchParams.set('offset', String(offset))
    }
    if (afterCursor && !url.searchParams.has('after')) {
      url.searchParams.set('after', afterCursor)
    }

    const response = await fetch(url, { headers: config.headers })

    if (!response.ok) {
      const payload = await response.text()
      console.error(`ExerciseDB equipment request failed (${response.status}): ${payload.slice(0, 500)}`)
      return equipmentNames
    }

    const payload = await response.json()
    const pageData = readCollectionRows(payload)
    if (pageData.length === 0) {
      break
    }

    for (const item of pageData) {
      const candidate = typeof item === 'string'
        ? item
        : item?.name ?? item?.equipment ?? item?.title ?? ''
      const normalized = normalizeText(candidate)
      if (!normalized) continue

      const key = normalized.toLowerCase()
      if (seenNames.has(key)) continue

      seenNames.add(key)
      equipmentNames.push(normalized)
    }

    const nextCursor = normalizeText(payload?.meta?.nextCursor)
    if (nextCursor) {
      if (seenCursors.has(nextCursor)) {
        break
      }

      seenCursors.add(nextCursor)
      afterCursor = nextCursor
      continue
    }

    if (pageData.length < config.pageSize) {
      break
    }

    offset += config.pageSize
  }

  return equipmentNames
}

async function fetchByIdRecord(config, exerciseId, retries = 2) {
  const response = await fetch(byIdUrl(config, exerciseId), { headers: config.headers })

  if (response.ok) {
    const payload = await response.json()
    if (Array.isArray(payload?.data)) return payload.data[0] ?? null
    return payload?.data ?? payload
  }

  if ((response.status === 429 || response.status >= 500) && retries > 0) {
    await delay(350)
    return fetchByIdRecord(config, exerciseId, retries - 1)
  }

  return null
}

async function enrichExercisesById(config, exercises) {
  const ids = exercises
    .map(item => normalizeText(item?.exerciseId || item?.id))
    .filter(Boolean)

  if (ids.length === 0) return exercises

  const detailsById = new Map()

  for (let i = 0; i < ids.length; i += config.enrichConcurrency) {
    const chunk = ids.slice(i, i + config.enrichConcurrency)
    const results = await Promise.all(
      chunk.map(async id => ({ id, detail: await fetchByIdRecord(config, id) }))
    )

    for (const result of results) {
      if (result.detail) {
        detailsById.set(result.id, result.detail)
      }
    }
  }

  return exercises.map(item => {
    const id = normalizeText(item?.exerciseId || item?.id)
    const detail = detailsById.get(id)
    if (!detail) return item

    return {
      ...item,
      ...detail,
      // Prefer list endpoint media if by-id omits it.
      imageUrl: detail.imageUrl ?? item.imageUrl,
      videoUrl: detail.videoUrl ?? item.videoUrl,
      gifUrl: detail.gifUrl ?? item.gifUrl,
    }
  })
}

function chunkArray(values, chunkSize) {
  const chunks = []

  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize))
  }

  return chunks
}

async function insertInChunks(tableName, rows, chunkSize = 250) {
  const chunks = chunkArray(rows, chunkSize)

  for (const chunk of chunks) {
    const { error } = await supabase.from(tableName).insert(chunk)

    if (error) {
      console.error(`Failed inserting ${tableName} chunk:`, error.message)
      process.exit(1)
    }
  }
}

const config = buildExerciseDbConfig()
const imageBaseUrl = toNullableText(process.env.EXERCISEDB_IMAGE_BASE_URL)
const videoBaseUrl = toNullableText(process.env.EXERCISEDB_VIDEO_BASE_URL)

const listExercises = await fetchExerciseDbExercises(config)
const rawExercises = config.enrichById
  ? await enrichExercisesById(config, listExercises)
  : listExercises
const endpointEquipmentNames = await fetchExerciseDbEquipments(config)

const exerciseRows = rawExercises
  .map(record => {
    const sourceId = normalizeText(record.exerciseId || record.id)
    const name = normalizeText(record.name)

    if (!sourceId || !name) {
      return null
    }

    const coachingCues = firstNonEmptyArray(record.exerciseTips, record.instructions)
    const primaryEquipment = firstNonEmptyArray(record.equipments, record.equipment)
    const imageUrl = toAbsoluteAssetUrl(record.imageUrl || record.gifUrl, imageBaseUrl)
    const videoUrl = toAbsoluteAssetUrl(record.videoUrl, videoBaseUrl)

    return {
      source,
      source_id: sourceId,
      slug: slugify(name),
      name,
      description: toDescription(record),
      coaching_cues: coachingCues,
      primary_equipment: primaryEquipment,
      media_image_url: imageUrl,
      media_video_url: videoUrl,
      metadata_json: {
        importedBy: 'scripts/import-exercisedb.mjs',
        bodyParts: normalizeArray(record.bodyParts),
        targetMuscles: normalizeArray(record.targetMuscles),
        secondaryMuscles: normalizeArray(record.secondaryMuscles),
        gender: toNullableText(record.gender),
        exerciseType: toNullableText(record.exerciseType),
        keywords: normalizeArray(record.keywords),
        variations: normalizeArray(record.variations),
        relatedExerciseIds: normalizeArray(record.relatedExerciseIds),
      },
      is_active: true,
    }
  })
  .filter(Boolean)

const equipmentNames = [
  ...new Set([
    ...exerciseRows.flatMap(exercise => normalizeArray(exercise.primary_equipment)),
    ...endpointEquipmentNames,
  ]),
]

const equipmentRows = equipmentNames.map(name => ({
  source,
  source_id: `eq-${slugify(name)}`,
  slug: slugify(name),
  name,
  description: `${name} used in ExerciseDB movements.`,
  metadata_json: {
    importedBy: 'scripts/import-exercisedb.mjs',
    fromEndpoint: endpointEquipmentNames.some(item => item.toLowerCase() === name.toLowerCase()),
  },
  is_active: true,
}))

const { error: clearExercisesError } = await supabase
  .from('exercise_library_entries')
  .delete()
  .eq('source', source)

if (clearExercisesError) {
  console.error('Failed to clear existing ExerciseDB exercise records:', clearExercisesError.message)
  process.exit(1)
}

await insertInChunks('exercise_library_entries', exerciseRows)

const { error: clearEquipmentError } = await supabase
  .from('equipment_library_entries')
  .delete()
  .eq('source', source)

if (clearEquipmentError) {
  console.error('Failed to clear existing ExerciseDB equipment records:', clearEquipmentError.message)
  process.exit(1)
}

if (equipmentRows.length > 0) {
  await insertInChunks('equipment_library_entries', equipmentRows)
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
  console.error('Import completed, but failed to fetch final counts.')
  process.exit(1)
}

console.log(`ExerciseDB import complete. Exercises (${source}): ${exerciseCount}`)
console.log(`ExerciseDB import complete. Equipment (${source}): ${equipmentCount}`)