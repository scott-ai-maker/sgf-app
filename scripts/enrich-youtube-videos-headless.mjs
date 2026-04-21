import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

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

function toSentenceCase(value) {
  const text = normalizeText(value)
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function containsInvalidYoutubeWarning(text) {
  const value = normalizeText(text).toLowerCase()
  if (!value) return true

  return (
    value.includes('videos you watch may be added to the tv\'s watch history') ||
    value.includes('sign in to youtube on your computer') ||
    value.includes('influence tv recommendations')
  )
}

function buildFallbackSteps(exerciseName) {
  const label = toSentenceCase(exerciseName || 'exercise')

  return [
    `Step 1: Setup Stand in athletic posture and prepare for ${label}.`,
    `Step 2: Brace Draw your abs in, maintain a neutral spine, and keep steady breathing.`,
    `Step 3: Execute Perform ${label} with controlled tempo and full range of motion.`,
    `Step 4: Return Reset to the start position with control and repeat for quality reps.`,
  ].join('\n\n')
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

function createProgressBar(current, total, startTime) {
  const percentage = (current / total) * 100
  const filled = Math.round((percentage / 100) * 40)
  const empty = 40 - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  const pct = percentage.toFixed(1).padStart(5, ' ')
  const elapsedMs = Date.now() - startTime
  const timePerItem = elapsedMs / current
  const remaining = Math.ceil((total - current) * timePerItem / 1000)
  const remainingStr = remaining > 60 ? `${Math.floor(remaining / 60)}m ${remaining % 60}s` : `${remaining}s`
  
  return `[${bar}] ${pct}% (${current}/${total}) ETA: ${remainingStr}`
}

async function extractYoutubeDescription(page, videoUrl) {
  try {
    await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    
    // Wait for description to be available
    await page.waitForTimeout(500)
    
    // Try multiple selectors for YouTube description
    const descriptionSelectors = [
      'yt-formatted-string.content[id="description"]',
      'div#description-inline-expander',
      'yt-formatted-string.description-snippet',
      'div[class*="description"]',
    ]
    
    for (const selector of descriptionSelectors) {
      const element = await page.$(selector)
      if (element) {
        const text = await element.evaluate(el => el.textContent)
        if (text && text.trim().length > 20) {
          const normalized = normalizeText(text)
          if (!containsInvalidYoutubeWarning(normalized)) {
            return normalized
          }
        }
      }
    }
    
    // Fallback: extract from initial data in page source
    const pageContent = await page.content()
    const descMatch = pageContent.match(/"shortDescription":"([^"\\]*(?:\\.[^"\\]*)*)/)
    if (descMatch) {
      try {
        const decoded = JSON.parse(`"${descMatch[1]}"`)
        const normalized = normalizeText(decoded)
        if (!containsInvalidYoutubeWarning(normalized)) {
          return normalized
        }
      } catch {
        // Fallback
      }
    }
    
    return null
  } catch {
    return null
  }
}

async function enrichYouTubeVideos() {
  console.log('Fetching YouTube exercises with missing or invalid descriptions...\n')
  
  const { data: youtubeExercises, error: fetchError } = await supabase
    .from('exercise_library_entries')
    .select('id, name, description, media_video_url, metadata_json')
    .not('metadata_json->>nasmEdgeVideoId', 'is', null)

  if (fetchError) {
    console.error('Failed to fetch exercises:', fetchError.message)
    process.exit(1)
  }

  if (!youtubeExercises || youtubeExercises.length === 0) {
    console.log('✓ All YouTube exercises have descriptions!')
    process.exit(0)
  }

  const targets = youtubeExercises.filter(exercise => {
    const description = normalizeText(exercise.description)
    if (!description) return true
    return containsInvalidYoutubeWarning(description)
  })

  if (targets.length === 0) {
    console.log('✓ No YouTube exercises need cleanup or enrichment.')
    process.exit(0)
  }

  const total = targets.length
  console.log(`Found ${total} YouTube exercises to process\n`)
  console.log('Starting headless browser...')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  // Set a reasonable timeout
  page.setDefaultTimeout(15000)

  let enriched = 0
  let failed = 0
  const startTime = Date.now()

  for (let i = 0; i < targets.length; i++) {
    const exercise = targets[i]
    const current = i + 1
    
    // Show progress bar
    process.stdout.write(`\r${createProgressBar(current, total, startTime)}`)

    const videoUrl = exercise.media_video_url
    if (!videoUrl) {
      failed++
      continue
    }

    try {
      const rawDescription = await extractYoutubeDescription(page, videoUrl)

      const formattedDescription = formatExerciseDescription(rawDescription || buildFallbackSteps(exercise.name))
      if (!formattedDescription) {
        failed++
        continue
      }

      const { error: updateError } = await supabase
        .from('exercise_library_entries')
        .update({
          description: formattedDescription,
          updated_at: new Date().toISOString(),
        })
        .eq('id', exercise.id)

      if (updateError) {
        failed++
        continue
      }

      enriched++
    } catch {
      const fallback = formatExerciseDescription(buildFallbackSteps(exercise.name))
      if (!fallback) {
        failed++
        continue
      }

      const { error: updateError } = await supabase
        .from('exercise_library_entries')
        .update({
          description: fallback,
          updated_at: new Date().toISOString(),
        })
        .eq('id', exercise.id)

      if (updateError) {
        failed++
        continue
      }

      enriched++
    }
  }

  await browser.close()

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  console.log(`\n`)
  console.log(`✓ Complete in ${minutes}m ${seconds}s`)
  console.log(`✓ Updated: ${enriched} exercises`)
  console.log(`✗ Failed: ${failed} exercises`)

  const { count: totalCount } = await supabase
    .from('exercise_library_entries')
    .select('*', { count: 'exact', head: true })

  const { count: withDescriptionsCount } = await supabase
    .from('exercise_library_entries')
    .select('*', { count: 'exact', head: true })
    .not('description', 'is', null)
    .neq('description', '')

  const coverage = totalCount ? Math.round((withDescriptionsCount / totalCount) * 100) : 0
  console.log(`\nCoverage: ${coverage}% of library has descriptions`)
}

await enrichYouTubeVideos()
