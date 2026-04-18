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

// Matches the generic placeholder fallback text we generated earlier
function isPlaceholderDescription(text) {
  if (!text) return true
  return (
    text.includes('Stand in athletic posture and prepare for') &&
    text.includes('Draw your abs in, maintain a neutral spine') &&
    text.includes('controlled tempo and full range of motion') &&
    text.includes('Reset to the start position with control')
  )
}

function createProgressBar(current, total, startTime) {
  const percentage = (current / total) * 100
  const filled = Math.round((percentage / 100) * 40)
  const bar = '█'.repeat(filled) + '░'.repeat(40 - filled)
  const pct = percentage.toFixed(1).padStart(5, ' ')
  const elapsed = Date.now() - startTime
  const eta = current > 0 ? Math.ceil(((elapsed / current) * (total - current)) / 1000) : 0
  const etaStr = eta > 60 ? `${Math.floor(eta / 60)}m ${eta % 60}s` : `${eta}s`
  return `[${bar}] ${pct}% (${current}/${total}) ETA: ${etaStr}`
}

async function generateExerciseSteps(exerciseName) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are a certified NASM personal trainer writing exercise instructions for a fitness coaching app.
Write clear, concise step-by-step instructions for exercises using exactly this format:

Step 1: [Phase label] [Instruction sentence.]
Step 2: [Phase label] [Instruction sentence.]
Step 3: [Phase label] [Instruction sentence.]
Step 4: [Phase label] [Instruction sentence.]

Rules:
- Use 4 steps only (Setup, Brace/Position, Execute, Return/Repeat)
- Each step on its own line, no blank lines between steps
- Be specific to the named exercise — muscular focus, body position, movement path
- Professional, concise language — no fluff
- Do not add any text before "Step 1" or after the last step`,
        },
        {
          role: 'user',
          content: `Write 4-step exercise instructions for: ${exerciseName}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error('Empty response from OpenAI')

  // Format steps separated by double newlines (matches our display formatting)
  const steps = text.match(/Step\s*\d+\s*:[\s\S]*?(?=(?:\s*Step\s*\d+\s*:)|$)/gi)
  if (steps && steps.length > 1) {
    return steps.map(s => s.replace(/\s+/g, ' ').trim()).join('\n\n')
  }

  return text.replace(/\n/g, '\n\n')
}

async function enrichWithOpenAI() {
  console.log('Fetching exercises with placeholder descriptions...\n')

  const { data: allExercises, error } = await supabase
    .from('exercise_library_entries')
    .select('id, name, description')
    .not('metadata_json->>nasmEdgeVideoId', 'is', null)

  if (error) {
    console.error('Failed to fetch exercises:', error.message)
    process.exit(1)
  }

  const targets = allExercises.filter(ex => isPlaceholderDescription(ex.description))

  if (targets.length === 0) {
    console.log('✓ No placeholder descriptions found — nothing to do.')
    process.exit(0)
  }

  console.log(`Found ${targets.length} exercises with placeholder descriptions`)
  console.log(`Model: gpt-4o-mini (~$${(targets.length * 0.0002).toFixed(2)} estimated cost)\n`)

  const startTime = Date.now()
  let enriched = 0
  let failed = 0

  for (let i = 0; i < targets.length; i++) {
    const exercise = targets[i]
    process.stdout.write(`\r${createProgressBar(i + 1, targets.length, startTime)}`)

    try {
      const description = await generateExerciseSteps(exercise.name)

      const { error: updateError } = await supabase
        .from('exercise_library_entries')
        .update({ description, updated_at: new Date().toISOString() })
        .eq('id', exercise.id)

      if (updateError) throw new Error(updateError.message)

      enriched++
    } catch (err) {
      process.stdout.write(`\n  ✗ ${exercise.name}: ${err.message}\n`)
      failed++
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 150))
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  console.log(`\n\n✓ Complete in ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`)
  console.log(`✓ Updated: ${enriched}`)
  console.log(`✗ Failed:  ${failed}`)
}

await enrichWithOpenAI()
