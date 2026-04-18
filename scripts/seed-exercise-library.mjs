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
const NASM_EDGE_PLAYLIST_ID = 'PLeVb1RGNTvdfb_UAXU22VNxHQmE0jHvbE'
const NASM_EDGE_PLAYLIST_FEED_URL = `https://www.youtube.com/feeds/videos.xml?playlist_id=${NASM_EDGE_PLAYLIST_ID}`

function normalizeText(value) {
  return String(value ?? '').trim()
}

function parseList(value) {
  return normalizeText(value)
    .split(',')
    .map(item => normalizeText(item))
    .filter(Boolean)
}

function decodeXml(value) {
  return String(value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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

function parseCoachingCues(description) {
  const text = formatExerciseDescription(description)
  if (!text) return []

  const rawLines = text
    .split(/\n+/)
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

function extractTag(entry, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i')
  const match = entry.match(pattern)
  return decodeXml(normalizeText(match?.[1]))
}

function normalizePlaylistTitle(title) {
  return normalizeText(title)
    .replace(/^how\s+to\s+do\s+an?\s+/i, '')
    .replace(/^how\s+to\s+do\s+/i, '')
    .trim()
}

function canonicalExerciseKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferEquipmentFromText(value) {
  const text = normalizeText(value).toLowerCase()
  const equipment = []

  function has(needle) {
    return text.includes(needle)
  }

  if (has('dumbbell')) equipment.push('Dumbbells')
  if (has('barbell')) equipment.push('Barbell')
  if (has('bench')) equipment.push('Bench')
  if (has('kettlebell')) equipment.push('Kettlebell')
  if (has('cable')) equipment.push('Cable Machine')
  if (has('machine')) equipment.push('Chest Press Machine')
  if (has('band') || has('tube')) equipment.push('Band or Tube')
  if (has('medicine ball')) equipment.push('Medicine Ball')
  if (has('stability ball')) equipment.push('Stability Ball')
  if (has('foam roll') || has('foam roller')) equipment.push('Foam Roller')
  if (has('pull-up bar') || has('pull up bar')) equipment.push('Pull-Up Bar')
  if (has('box') || has('step')) equipment.push('Box or Step')
  if (has('rope')) equipment.push('Rope')
  if (has('chain')) equipment.push('Chains')
  if (has('plate')) equipment.push('Plates')
  if (has('strap')) equipment.push('Stretch Strap')

  return uniqueByLower(equipment)
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

async function fetchNasmEdgePlaylistEntries() {
  const playlistPageResponse = await fetch(`https://www.youtube.com/playlist?list=${NASM_EDGE_PLAYLIST_ID}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })

  if (!playlistPageResponse.ok) {
    console.error(`Failed to load YouTube playlist page: ${playlistPageResponse.status}`)
    process.exit(1)
  }

  const html = await playlistPageResponse.text()
  const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1]
  const clientVersion = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1] ?? '2.20240101.00.00'
  const initialDataMatch = html.match(/var ytInitialData = (\{[\s\S]*?\});/)

  if (!apiKey || !initialDataMatch) {
    console.error('Failed to parse YouTube playlist page payload.')
    process.exit(1)
  }

  const initialData = JSON.parse(initialDataMatch[1])

  function collectContinuationTokens(node, out = new Set()) {
    if (!node || typeof node !== 'object') return out

    if (Array.isArray(node)) {
      for (const value of node) {
        collectContinuationTokens(value, out)
      }
      return out
    }

    if (node.continuationCommand?.token) {
      out.add(node.continuationCommand.token)
    }
    if (node.nextContinuationData?.continuation) {
      out.add(node.nextContinuationData.continuation)
    }

    for (const value of Object.values(node)) {
      collectContinuationTokens(value, out)
    }

    return out
  }

  function readInitialPlaylistItems(root) {
    return root?.contents?.twoColumnBrowseResultsRenderer?.tabs
      ?.map(tab => tab.tabRenderer)
      ?.find(tab => tab?.selected)
      ?.content?.sectionListRenderer?.contents?.[0]
      ?.itemSectionRenderer?.contents?.[0]
      ?.playlistVideoListRenderer?.contents ?? []
  }

  function readContinuationItems(root) {
    const actions = [
      ...(Array.isArray(root?.onResponseReceivedActions) ? root.onResponseReceivedActions : []),
      ...(Array.isArray(root?.onResponseReceivedEndpoints) ? root.onResponseReceivedEndpoints : []),
    ]

    const items = []

    for (const action of actions) {
      const append = action?.appendContinuationItemsAction?.continuationItems
      if (Array.isArray(append)) {
        items.push(...append)
      }

      const reload = action?.reloadContinuationItemsCommand?.continuationItems
      if (Array.isArray(reload)) {
        items.push(...reload)
      }
    }

    return items
  }

  function parsePlaylistEntriesFromItems(items) {
    const entries = []

    for (const item of items) {
      const renderer = item?.playlistVideoRenderer
      if (!renderer?.videoId) continue

      const title = normalizeText(renderer?.title?.runs?.[0]?.text || renderer?.title?.simpleText)
      const description = normalizeText(
        renderer?.descriptionSnippet?.runs?.map(run => run?.text ?? '').join('')
      )

      entries.push({
        videoId: renderer.videoId,
        title,
        description,
        videoUrl: `https://www.youtube.com/watch?v=${renderer.videoId}`,
      })
    }

    return entries
  }

  async function fetchContinuationPage(token) {
    const response = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion,
          },
        },
        continuation: token,
      }),
    })

    if (!response.ok) {
      return { entries: [], nextToken: null }
    }

    const payload = await response.json()
    const items = readContinuationItems(payload)
    const entries = parsePlaylistEntriesFromItems(items)
    const nextTokens = [...collectContinuationTokens(payload)].filter(value => value !== token)

    return {
      entries,
      nextToken: nextTokens[0] ?? null,
    }
  }

  const initialItems = readInitialPlaylistItems(initialData)
  const playlistEntries = parsePlaylistEntriesFromItems(initialItems)

  const candidateTokens = [...collectContinuationTokens(initialData)]
  let continuationToken = null
  let bootstrapEntries = []
  let nextTokenAfterBootstrap = null

  for (const token of candidateTokens) {
    const probe = await fetchContinuationPage(token)
    if (probe.entries.length === 0) continue

    continuationToken = token
    bootstrapEntries = probe.entries
    nextTokenAfterBootstrap = probe.nextToken
    break
  }

  if (bootstrapEntries.length > 0) {
    playlistEntries.push(...bootstrapEntries)
  }

  let nextToken = nextTokenAfterBootstrap
  let pageGuard = 0

  while (nextToken && pageGuard < 40) {
    pageGuard += 1
    const page = await fetchContinuationPage(nextToken)
    playlistEntries.push(...page.entries)
    nextToken = page.nextToken
  }

  return playlistEntries.map((entry, index) => {
    const sequence = String(index + 1).padStart(4, '0')
    const normalizedTitle = normalizePlaylistTitle(entry.title)
    const slugBase = slugify(normalizedTitle || entry.title || `video-${entry.videoId}`)
    const rowSlug = slugify(`${slugBase}-${sequence}`)
    const inferredEquipment = inferEquipmentFromText(`${normalizedTitle} ${entry.description}`)
    const formattedDescription = formatExerciseDescription(entry.description)

    return {
      source,
      source_id: `yt-${entry.videoId}-${sequence}`,
      slug: rowSlug,
      name: titleCaseFromSlug(slugBase),
      description: formattedDescription,
      coaching_cues: parseCoachingCues(formattedDescription),
      primary_equipment: inferredEquipment,
      media_video_url: entry.videoUrl,
      metadata_json: {
        seededBy: 'scripts/seed-exercise-library.mjs',
        version: 5,
        nasmEdgePlaylistId: NASM_EDGE_PLAYLIST_ID,
        nasmEdgeVideoId: entry.videoId,
        nasmEdgeVideoUrl: entry.videoUrl,
        nasmEdgeTitle: entry.title || null,
        nasmEdgeSequence: index + 1,
      },
      is_active: true,
    }
  })
}

const source = 'nasm_exercise_library'

const catalog = await fetchNasmCatalog()
const edgePlaylistEntries = await fetchNasmEdgePlaylistEntries()
const bySlug = new Map()
const edgeExerciseKeys = new Set(
  edgePlaylistEntries
    .map(entry => {
      const edgeTitle = entry?.metadata_json?.nasmEdgeTitle || entry?.name
      return canonicalExerciseKey(normalizePlaylistTitle(edgeTitle))
    })
    .filter(Boolean)
)

for (const item of catalog) {
  const title = normalizeText(item?.Title)
  const slug = extractSlugFromThumbnail(item?.['Video Thumbnail']) || slugify(title)
  if (!slug) continue
  const titleKey = canonicalExerciseKey(title)
  if (titleKey && edgeExerciseKeys.has(titleKey)) continue
  if (bySlug.has(slug)) continue

  const nasmUrl = buildNasmExerciseUrl(slug)
  const bodyParts = uniqueByLower(parseList(item?.['Body Part']))
  const equipment = uniqueByLower(parseList(item?.Equipment))
  const formattedDescription = formatExerciseDescription(item?.Description)

  bySlug.set(slug, {
    source,
    source_id: slug,
    slug,
    // User requested naming based on NASM slug (slug is source of truth).
    name: titleCaseFromSlug(slug),
    description: formattedDescription,
    coaching_cues: parseCoachingCues(formattedDescription),
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

const exerciseRows = [...bySlug.values(), ...edgePlaylistEntries]

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
console.log(`Catalog source rows: ${catalog.length}`)
console.log(`Playlist source rows: ${edgePlaylistEntries.length}`)