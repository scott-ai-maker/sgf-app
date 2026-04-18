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

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function extractTextFromHtml(html) {
  try {
    // Remove script and style tags
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    
    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
    
    // Extract text from common instruction elements
    const instructionContent = html.match(
      /<(?:section|article|div)[^>]*(?:class="[^"]*(?:instruction|step|direction|how-to)[^"]*"|id="[^"]*(?:instruction|step|direction)[^"]*")[^>]*>[\s\S]*?<\/(?:section|article|div)>/gi
    )
    
    if (instructionContent && instructionContent.length > 0) {
      // Extract text from matched elements
      text = instructionContent
        .map(el => el.replace(/<[^>]+>/g, ' '))
        .join(' ')
    } else {
      // Fallback: remove all HTML tags
      text = html.replace(/<[^>]+>/g, ' ')
    }
    
    // Clean up whitespace
    text = text
      .split('\n')
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n')
    
    return normalizeText(text)
  } catch (err) {
    console.error('Error parsing HTML:', err.message)
    return null
  }
}

async function fetchNasmExerciseInstructions(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status}`)
      return null
    }

    const html = await response.text()
    const instructions = extractTextFromHtml(html)
    
    return instructions ? formatExerciseDescription(instructions) : null
  } catch (err) {
    console.error(`Error fetching ${url}:`, err.message)
    return null
  }
}

async function enrichExerciseInstructions() {
  console.log('Fetching exercises with missing descriptions...')
  
  const { data: exercisesWithoutDescriptions, error: fetchError } = await supabase
    .from('exercise_library_entries')
    .select('id, name, slug, metadata_json')
    .or('description.is.null,description.eq.""')
    .limit(100)

  if (fetchError) {
    console.error('Failed to fetch exercises:', fetchError.message)
    process.exit(1)
  }

  if (!exercisesWithoutDescriptions || exercisesWithoutDescriptions.length === 0) {
    console.log('✓ All exercises have descriptions!')
    process.exit(0)
  }

  console.log(`Found ${exercisesWithoutDescriptions.length} exercises missing descriptions`)
  console.log('Attempting to fetch instructions...\n')

  let enriched = 0
  let failed = 0

  for (const exercise of exercisesWithoutDescriptions) {
    let nasmUrl = exercise.metadata_json?.nasmUrl
    
    // If no NASM URL, try building one from the slug (stripping sequence numbers)
    if (!nasmUrl && exercise.slug) {
      // Remove sequence numbers at the end (e.g., "-0001" from "kettlebell-clean-to-press-0001")
      const baseSlug = exercise.slug.replace(/-\d{4}$/, '')
      nasmUrl = `https://www.nasm.org/resource-center/exercise-library/${encodeURIComponent(baseSlug)}`
    }
    
    // If still no URL, try building from name
    if (!nasmUrl && exercise.name) {
      const nameSlug = slugify(exercise.name)
      nasmUrl = `https://www.nasm.org/resource-center/exercise-library/${nameSlug}`
    }
    
    if (!nasmUrl) {
      console.log(`⊘ ${exercise.name || exercise.slug} - Cannot construct URL`)
      failed++
      continue
    }

    console.log(`↓ Fetching ${exercise.name || exercise.slug}...`)
    const instructions = await fetchNasmExerciseInstructions(nasmUrl)

    if (!instructions) {
      console.log(`  ✗ No instructions found`)
      failed++
      continue
    }

    // Update the exercise with the fetched instructions
    const { error: updateError } = await supabase
      .from('exercise_library_entries')
      .update({ 
        description: instructions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', exercise.id)

    if (updateError) {
      console.log(`  ✗ Failed to update: ${updateError.message}`)
      failed++
      continue
    }

    console.log(`  ✓ Updated (${instructions.slice(0, 50)}...)`)
    enriched++
    
    // Rate limit to be gentle on NASM servers
    await new Promise(resolve => setTimeout(resolve, 800))
  }

  console.log(`\n✓ Enrichment complete: ${enriched} updated, ${failed} failed`)
}

await enrichExerciseInstructions()
