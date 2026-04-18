import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const openaiApiKey = process.env.OPENAI_API_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!openaiApiKey) {
  console.error('Missing OPENAI_API_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function normalizeEquipment(primaryEquipment) {
  if (!Array.isArray(primaryEquipment) || primaryEquipment.length === 0) {
    return 'Bodyweight'
  }

  const cleaned = primaryEquipment
    .map(item => String(item || '').trim())
    .filter(Boolean)

  return cleaned.length > 0 ? cleaned.join(', ') : 'Bodyweight'
}

function countStepLabels(text) {
  if (!text) return 0
  return (text.match(/Step\s*\d\s*:/gi) || []).length
}

function removeEquipmentLine(text) {
  if (!text) return ''
  return text
    .replace(/\n\nEquipment\s*:[\s\S]*$/i, '')
    .replace(/\nEquipment\s*:[\s\S]*$/i, '')
    .trim()
}

function normalizeStepSpacing(text) {
  const steps = text.match(/Step\s*\d\s*:[\s\S]*?(?=(?:\n+Step\s*\d\s*:)|$)/gi)
  if (!steps || steps.length === 0) {
    return text.trim().replace(/\n{3,}/g, '\n\n')
  }

  return steps
    .map(step => step.replace(/\s+/g, ' ').trim())
    .join('\n\n')
}

async function generateFourStepDescription(exerciseName, equipment) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 420,
      temperature: 0.25,
      messages: [
        {
          role: 'system',
          content:
            'You are a NASM-certified coach. Write exercise instructions in exactly 4 steps. Use exactly this format: Step 1:, Step 2:, Step 3:, Step 4:. Each step should be one concise sentence. No intro or outro text. Make instructions specific to the named exercise and listed equipment. Keep it practical and coaching-ready.',
        },
        {
          role: 'user',
          content: `Exercise: ${exerciseName}\nEquipment: ${equipment}\nWrite the 4 steps now.`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`OpenAI error ${response.status}: ${detail}`)
  }

  const data = await response.json()
  const raw = data?.choices?.[0]?.message?.content?.trim()
  if (!raw) {
    throw new Error('OpenAI returned empty content')
  }

  const steps = raw.match(/Step\s*\d\s*:[\s\S]*?(?=(?:\s*Step\s*\d\s*:)|$)/gi)
  if (!steps || steps.length !== 4) {
    throw new Error('OpenAI response did not contain exactly 4 steps')
  }

  return steps.map(step => step.replace(/\s+/g, ' ').trim()).join('\n\n')
}

function withEquipmentLine(description, equipment) {
  const base = removeEquipmentLine(description)
  const normalized = normalizeStepSpacing(base)
  return `${normalized}\n\nEquipment: ${equipment}`
}

function createProgressBar(current, total) {
  const pct = total === 0 ? 100 : Math.round((current / total) * 1000) / 10
  const filled = Math.round((pct / 100) * 30)
  const bar = '█'.repeat(filled) + '░'.repeat(30 - filled)
  return `[${bar}] ${pct.toFixed(1)}% (${current}/${total})`
}

async function main() {
  const { data: entries, error } = await supabase
    .from('exercise_library_entries')
    .select('id, name, description, primary_equipment, is_active')
    .eq('is_active', true)

  if (error) {
    throw new Error(`Supabase fetch failed: ${error.message}`)
  }

  const total = entries.length
  let aiRegenerated = 0
  let updated = 0
  let unchanged = 0
  let failed = 0

  console.log(`Normalizing ${total} active exercises...`)

  for (let i = 0; i < entries.length; i++) {
    const row = entries[i]
    const equipment = normalizeEquipment(row.primary_equipment)
    const currentDescription = row.description || ''
    const stepCount = countStepLabels(currentDescription)

    try {
      let baseDescription

      if (stepCount === 4) {
        baseDescription = removeEquipmentLine(currentDescription)
      } else {
        baseDescription = await generateFourStepDescription(row.name, equipment)
        aiRegenerated++
      }

      const nextDescription = withEquipmentLine(baseDescription, equipment)

      if (nextDescription !== currentDescription.trim()) {
        const { error: updateError } = await supabase
          .from('exercise_library_entries')
          .update({
            description: nextDescription,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)

        if (updateError) {
          throw new Error(`Update failed: ${updateError.message}`)
        }

        updated++
      } else {
        unchanged++
      }
    } catch (err) {
      failed++
      console.log(`\n✗ ${row.name}: ${err.message}`)
    }

    process.stdout.write(`\r${createProgressBar(i + 1, total)}`)

    // Gentle pacing for API and DB
    await new Promise(resolve => setTimeout(resolve, 120))
  }

  console.log('\n\nNormalization complete')
  console.log(`Updated: ${updated}`)
  console.log(`Unchanged: ${unchanged}`)
  console.log(`AI regenerated: ${aiRegenerated}`)
  console.log(`Failed: ${failed}`)
}

await main()
