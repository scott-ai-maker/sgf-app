#!/usr/bin/env node
/**
 * SGF — Leonardo AI Image Generation Script
 *
 * Generates every image needed for scottgordonfitness.com and saves
 * them to public/images/. Re-running skips already-completed files.
 *
 * Usage:
 *   1. Add LEONARDO_API_KEY to .env.local  ← https://app.leonardo.ai/settings/api
 *   2. npm run generate-images
 *
 * Estimated credit cost: ~150–200 API credits for the full set.
 *
 * Model IDs can be found at:
 *   https://docs.leonardo.ai/reference/listplatformmodels
 *   or via: curl -H "Authorization: Bearer $KEY" https://cloud.leonardo.ai/api/rest/v1/platformModels
 */

import { createWriteStream, existsSync } from 'fs'
import { mkdir, readFile } from 'fs/promises'
import { get as httpsGet } from 'https'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── Load .env.local ──────────────────────────────────────────────────────────
async function loadEnv() {
  const envPath = path.join(ROOT, '.env.local')
  if (!existsSync(envPath)) return
  const raw = await readFile(envPath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key && !(key in process.env)) process.env[key] = val
  }
}

// ── Config ───────────────────────────────────────────────────────────────────
const API_BASE = 'https://cloud.leonardo.ai/api/rest/v1'
const OUT_DIR = path.join(ROOT, 'public', 'images')
const POLL_INTERVAL_MS = 5000
const MAX_POLL_ATTEMPTS = 72   // 6 min ceiling per image
const SUBMISSION_DELAY_MS = 2500  // respect rate limits between jobs
const MAX_SAFE_RETRIES = 2
const MODEL_MAX_DIMENSION = 1536
const MODEL_DIMENSION_STEP = 32

/**
 * Legacy IDs are intentionally kept as hints only.
 * The script now resolves a compatible model dynamically from /platformModels.
 */
const MODELS = {
  KINO_XL: 'aa77f04e-3eec-4034-9c07-d0a6fef09c3d',
  PHOENIX: 'de7d3faf-762f-48e0-b3b5-9d76efc12f3c',
  LIGHTNING_XL: 'e316348f-7773-490e-adcd-46757c738eb9',
}

const MODEL_NAME_PREFERENCES = [
  'lucid realism',
  'lucid origin',
  'phoenix',
  'flux',
  'albedo',
]

let platformModelsCache = null
let resolvedDefaultModelId = null

// ── Shared prompt fragments ──────────────────────────────────────────────────
const BRAND =
  'professional commercial photography, dark navy blue color grade, ' +
  'dramatic cinematic lighting, deep shadows contrasted with precise accent light, ' +
  'photorealistic, ultra high resolution, 8k, no text overlay, no watermark'

const NEG =
  'text, watermark, logo, signature, low quality, blurry, deformed, ugly, ' +
  'overexposed, washed out, cartoon, anime, illustration, painting, sketch, ' +
  '3d render, cgi, jpeg artifacts, multiple people, crowded'

const LOGO_NEG =
  'photograph, realistic photo, person, face, body, cluttered, messy, low contrast, ' +
  'blurry edges, watermark, signature, extra letters, misspelling, illegible typography'

const SAFE_NEG_APPEND =
  ', nsfw, nudity, shirtless, exposed torso, exposed chest, cleavage, lingerie, erotic, suggestive, fetish'

// ── Image manifest ───────────────────────────────────────────────────────────
// Each entry produces one file in public/images/.
// Width/height must satisfy Leonardo's 64px-multiple constraint.
const IMAGES = [

  // ── Landing page hero ────────────────────────────────────────────────────
  {
    filename: 'hero-bg.jpg',
    prompt:
      'Cinematic dark professional gym interior, heavy iron barbells and matte black ' +
      'weight plates on a steel rack, dramatic single low-key side light casting long ' +
      'shadows across textured concrete floor, atmospheric dust motes in a single warm ' +
      'shaft of light, extreme depth of field, deep navy blue and charcoal tones, ' +
      'powerful moody atmosphere, ' + BRAND,
    width: 1792,
    height: 1024,
    modelId: MODELS.KINO_XL,
    presetStyle: 'CINEMATIC',
  },
  {
    filename: 'hero-bg-mobile.jpg',
    prompt:
      'Cinematic dark professional gym interior, empty room with no people, close-up ' +
      'of heavy barbell and weight plates on rack, dramatic side lighting, atmospheric ' +
      'dust particles, portrait vertical composition, deep navy blue and charcoal tones, ' + BRAND,
    negativePrompt:
      NEG + ', person, human, man, woman, body, skin',
    width: 832,
    height: 1472,
    modelId: MODELS.KINO_XL,
    presetStyle: 'CINEMATIC',
  },

  // ── Open Graph / social share ────────────────────────────────────────────
  {
    filename: 'og-image.jpg',
    prompt:
      'Wide cinematic dark gym panorama, powerlifting platform with heavy loaded barbell ' +
      'centered in frame, god rays of golden atmospheric light cutting through dark air, ' +
      'deep navy blue and charcoal atmosphere, premium brand photography composition, ' +
      'ample empty space at left for text overlay, ' + BRAND,
    width: 1344,
    height: 768,
    modelId: MODELS.KINO_XL,
    presetStyle: 'CINEMATIC',
  },

  // ── Coach portrait — seed-driven for likeness consistency ─────────────────
  // Set LEONARDO_SEED=<your_seed> in .env.local to reproduce your exact likeness.
  // You can also set seed here directly: seed: 1234567
  {
    filename: 'coach-portrait.jpg',
    prompt:
      'Professional athletic male personal trainer, mid-thirties, strong confident build, ' +
      'arms loosely crossed, wearing a fitted dark navy athletic performance shirt, short ' +
      'dark hair, clean sharp professional headshot, studio photography with deep navy to ' +
      'charcoal gradient background, single dramatic key light from camera-left creating ' +
      'strong facial contrast, commercial fitness photography, photorealistic portrait',
    negativePrompt:
      NEG + ', group photo, silly expression, gym background, distracting props',
    width: 832,
    height: 1216,
    modelId: MODELS.KINO_XL,
    presetStyle: 'PORTRAIT',
    // seed: undefined  ← uncomment and set your seed number here, or use LEONARDO_SEED env var
  },

  // ── Feature / pillar cards (4 pillars on the landing page) ───────────────
  {
    filename: 'feature-programming.jpg',
    prompt:
      'Artistic close-up of a heavy barbell loaded with iron weight plates resting on a ' +
      'dark concrete gym floor, dramatic raking side light from one angle, deep golden ' +
      'metallic sheen on plates, stark minimal composition, navy background, ' + BRAND,
    width: 896,
    height: 896,
    modelId: MODELS.KINO_XL,
    presetStyle: 'CINEMATIC',
  },
  {
    filename: 'feature-tracking.jpg',
    prompt:
      'Close-up of athletic hands writing in a dark leather-covered training journal ' +
      'beside an analog stopwatch on dark textured concrete, dramatic single-source side ' +
      'light, golden pen accent, minimal composition, deep navy tones, ' + BRAND,
    width: 896,
    height: 896,
    modelId: MODELS.KINO_XL,
    presetStyle: 'CINEMATIC',
  },
  {
    filename: 'feature-coaching.jpg',
    prompt:
      'Athletic male fitness coach in dark performance athletic wear reviewing training ' +
      'data on a sleek dark laptop in a moody dark gym, dramatic rim lighting from behind, ' +
      'golden screen glow softly illuminating strong jaw and forearms, deep navy blue ' +
      'atmosphere, ' + BRAND,
    width: 896,
    height: 896,
    modelId: MODELS.KINO_XL,
    presetStyle: 'CINEMATIC',
  },
  {
    filename: 'feature-scheduling.jpg',
    prompt:
      'Clean dark smartphone displaying a minimal scheduling calendar on a dark brushed ' +
      'concrete surface beside a black pen, dramatic side light with a warm gold glow ' +
      'from the phone screen, minimal composition, deep navy blue tones, ' + BRAND,
    width: 896,
    height: 896,
    modelId: MODELS.KINO_XL,
    presetStyle: 'CINEMATIC',
  },

  // ── Package tier cards ───────────────────────────────────────────────────
  {
    // Starter Pack — 4 sessions, $240 — foundation / beginning
    filename: 'package-starter.jpg',
    prompt:
      'Single polished dumbbell and a resistance band on dark brushed concrete gym floor, ' +
      'minimal overhead composition, single dramatic side light casting long sharp shadow, ' +
      'deep charcoal and navy tones, clean foundation concept, ' + BRAND,
    width: 1344,
    height: 768,
    modelId: MODELS.KINO_XL,
    presetStyle: 'CINEMATIC',
  },
  {
    // Momentum Pack — 8 sessions, $440 — building progress (most popular)
    filename: 'package-momentum.jpg',
    prompt:
      'Set of barbells and iron weight plates arranged with energy and forward motion on ' +
      'dark gym floor, dramatic side lighting with warm gold metallic highlights on iron ' +
      'surfaces, deep navy blue atmosphere, strong dynamic drive concept, ' + BRAND,
    width: 1344,
    height: 768,
    modelId: MODELS.KINO_XL,
    presetStyle: 'CINEMATIC',
  },
  {
    // Transformation Pack — 16 sessions, $800 — elite / premium
    filename: 'package-transformation.jpg',
    prompt:
      'Premium full power rack with a heavy loaded barbell in a professional dark gym, ' +
      'dramatic volumetric golden haze lighting, luxury high-performance aesthetic, rich ' +
      'deep navy and warm gold color palette, elite championship concept, cinematic ' +
      'atmosphere, ' + BRAND,
    width: 1344,
    height: 768,
    modelId: MODELS.KINO_XL,
    presetStyle: 'CINEMATIC',
  },

  // ── Auth pages (login / signup / reset) ─────────────────────────────────
  {
    filename: 'auth-bg.jpg',
    prompt:
      'Extremely dark minimal gym interior, deep out-of-focus weight room equipment ' +
      'visible only as dim shapes in darkness, smooth dark navy gradient, barely ' +
      'perceptible subtle gym silhouettes, very low contrast, ideal as an atmospheric ' +
      'background behind a login form, ' + BRAND,
    width: 1792,
    height: 1024,
    modelId: MODELS.KINO_XL,
    presetStyle: 'CINEMATIC',
  },

  // ── Bottom CTA section background ────────────────────────────────────────
  {
    filename: 'cta-bg.jpg',
    prompt:
      'Motivational dark gym, silhouette of an athlete in a powerful deadlift stance ' +
      'against dramatic backlight creating a golden rim halo effect, deep navy blue ' +
      'atmosphere with warm gold haze, inspirational and powerful, wide cinematic ' +
      'composition with empty left half for text overlay, ' + BRAND,
    width: 1792,
    height: 768,
    modelId: MODELS.KINO_XL,
    presetStyle: 'CINEMATIC',
  },

  // ── Favicon / brand icon source ──────────────────────────────────────────
  // NOTE: A precise vector logo should be created in Figma or Illustrator.
  // This generates a high-res atmospheric brand icon only.
  {
    filename: 'brand-icon-source.jpg',
    prompt:
      'Minimal abstract brand icon, bold stylized monogram letterforms "SGF" rendered as ' +
      'brushed liquid gold metal, dramatic studio lighting creating specular highlights, ' +
      'pure matte black background, ultra clean centered composition, luxury brand identity ' +
      'photography, macro detail, sharp focus, photorealistic',
    width: 1024,
    height: 1024,
    modelId: MODELS.PHOENIX,
    presetStyle: 'DYNAMIC',
  },
  {
    filename: 'logo-mark-source.jpg',
    prompt:
      'Premium minimalist logo mark for fitness coaching brand "Scott Gordon Fitness", ' +
      'interlocked SG monogram, geometric sharp lines, flat vector look, metallic gold ' +
      'on deep matte navy black background, centered composition, high contrast, brand ' +
      'identity design board style, clean negative space, no mockup, no perspective',
    negativePrompt: LOGO_NEG,
    width: 1024,
    height: 1024,
    modelId: MODELS.PHOENIX,
    presetStyle: 'DYNAMIC',
  },
  {
    filename: 'logo-shield-source.jpg',
    prompt:
      'Modern emblem logo for elite coaching brand "Scott Gordon Fitness", angular ' +
      'shield badge with SG initials, flat vector style, gold and navy palette, clean ' +
      'solid shapes, no gradients, centered on plain dark background, crisp edges, ' +
      'print-ready brand identity concept',
    negativePrompt: LOGO_NEG,
    width: 1024,
    height: 1024,
    modelId: MODELS.PHOENIX,
    presetStyle: 'DYNAMIC',
  },
]

// ── API helpers ──────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function apiRequest(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.LEONARDO_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Leonardo API ${res.status} ${res.statusText}: ${body}`)
  }

  return res.json()
}

function parseErrorPayload(errorMessage) {
  const start = errorMessage.indexOf('{')
  if (start === -1) return null
  try {
    return JSON.parse(errorMessage.slice(start))
  } catch {
    return null
  }
}

function isUnsupportedModelError(errorMessage) {
  const payload = parseErrorPayload(errorMessage)
  const msg = (payload?.error ?? errorMessage ?? '').toLowerCase()
  return msg.includes('model is not supported')
}

function isAlchemyNotEnabledError(errorMessage) {
  const payload = parseErrorPayload(errorMessage)
  const msg = (payload?.error ?? errorMessage ?? '').toLowerCase()
  return msg.includes('alchemy is not enabled')
}

async function getPlatformModels() {
  if (platformModelsCache) return platformModelsCache

  const data = await apiRequest('/platformModels')
  const models = [
    ...(Array.isArray(data.custom_models) ? data.custom_models : []),
    ...(Array.isArray(data.platform_models) ? data.platform_models : []),
    ...(Array.isArray(data.models) ? data.models : []),
  ]

  platformModelsCache = models
  return models
}

async function resolveDefaultModelId() {
  if (resolvedDefaultModelId) return resolvedDefaultModelId

  const forcedId = (process.env.LEONARDO_MODEL_ID ?? '').trim()
  if (forcedId) {
    resolvedDefaultModelId = forcedId
    return forcedId
  }

  const models = await getPlatformModels()
  if (!models.length) return null

  const normalize = s => String(s ?? '').toLowerCase()

  for (const wanted of MODEL_NAME_PREFERENCES) {
    const hit = models.find(m => normalize(m.name).includes(wanted))
    if (hit?.id) {
      resolvedDefaultModelId = hit.id
      return hit.id
    }
  }

  resolvedDefaultModelId = models[0].id ?? null
  return resolvedDefaultModelId
}

async function resolveCompatibleModelId(requestedModelId) {
  const forcedId = (process.env.LEONARDO_MODEL_ID ?? '').trim()
  if (forcedId) return forcedId

  const models = await getPlatformModels()
  const knownIds = new Set(models.map(m => m.id).filter(Boolean))
  if (requestedModelId && knownIds.has(requestedModelId)) return requestedModelId

  return resolveDefaultModelId()
}

function clampToStep(value, step, min, max) {
  const stepped = Math.floor(value / step) * step
  return Math.max(min, Math.min(max, stepped))
}

function normalizeDimensions(width, height) {
  const largest = Math.max(width, height)
  if (largest <= MODEL_MAX_DIMENSION) {
    return {
      width: clampToStep(width, MODEL_DIMENSION_STEP, 32, MODEL_MAX_DIMENSION),
      height: clampToStep(height, MODEL_DIMENSION_STEP, 32, MODEL_MAX_DIMENSION),
      changed: false,
    }
  }

  const scale = MODEL_MAX_DIMENSION / largest
  return {
    width: clampToStep(Math.round(width * scale), MODEL_DIMENSION_STEP, 32, MODEL_MAX_DIMENSION),
    height: clampToStep(Math.round(height * scale), MODEL_DIMENSION_STEP, 32, MODEL_MAX_DIMENSION),
    changed: true,
  }
}

async function submitGeneration(spec) {
  const modelId = await resolveCompatibleModelId(spec.modelId)
  const normalized = normalizeDimensions(spec.width, spec.height)
  const alchemyEnabled = ['1', 'true', 'yes'].includes((process.env.LEONARDO_ALCHEMY ?? '').toLowerCase())

  // Seed resolution order:
  //   1. per-image spec.seed
  //   2. LEONARDO_SEED env var (applies to all images)
  const globalSeed = (process.env.LEONARDO_SEED ?? '').trim()
  const seedRaw = spec.seed ?? (globalSeed !== '' ? Number(globalSeed) : undefined)
  const seed = Number.isFinite(seedRaw) ? Math.trunc(seedRaw) : undefined

  const body = {
    prompt: spec.prompt,
    negative_prompt: spec.negativePrompt ?? NEG,
    width: normalized.width,
    height: normalized.height,
    num_images: spec.numImages ?? 1,
    alchemy: alchemyEnabled,
    ...(spec.presetStyle ? { presetStyle: spec.presetStyle } : {}),
    ...(modelId ? { modelId } : {}),
    ...(seed !== undefined ? { seed } : {}),
  }

  if (normalized.changed) {
    console.log(`\n   ↻ Resized for API limits: ${spec.width}×${spec.height} → ${normalized.width}×${normalized.height}`)
  }

  let data
  try {
    data = await apiRequest('/generations', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (isUnsupportedModelError(error.message)) {
      const fallbackModelId = await resolveDefaultModelId()
      if (!fallbackModelId || fallbackModelId === modelId) throw error

      const retryBody = {
        ...body,
        modelId: fallbackModelId,
      }

      console.log(`\n   ↻ Retrying with compatible model: ${fallbackModelId}`)
      data = await apiRequest('/generations', {
        method: 'POST',
        body: JSON.stringify(retryBody),
      })
    } else if (isAlchemyNotEnabledError(error.message) && body.alchemy) {
      const retryBody = {
        ...body,
        alchemy: false,
      }

      console.log('\n   ↻ Retrying without alchemy for compatibility')
      data = await apiRequest('/generations', {
        method: 'POST',
        body: JSON.stringify(retryBody),
      })
    } else {
      throw error
    }
  }

  return data.sdGenerationJob.generationId
}

function isNoSafeImagesError(errorMessage) {
  return String(errorMessage ?? '').toLowerCase().includes('no safe images in generation result')
}

function buildSafetyRetrySpec(spec, attempt) {
  const safetyPrompt =
    attempt === 1
      ? 'strictly safe-for-work composition, all people fully clothed in non-revealing athletic wear, non-sexual neutral scene'
      : 'strictly safe-for-work product-style scene with equipment only when possible, no people, no skin exposure, no suggestive content'

  return {
    ...spec,
    prompt: `${spec.prompt}, ${safetyPrompt}`,
    negativePrompt: `${spec.negativePrompt ?? NEG}${SAFE_NEG_APPEND}`,
    numImages: 2,
  }
}

async function pollForCompletion(generationId) {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS)

    const data = await apiRequest(`/generations/${generationId}`)
    const gen = data.generations_by_pk

    if (gen.status === 'COMPLETE') {
      const img = gen.generated_images.find(i => !i.nsfw)
      if (!img) throw new Error('No safe images in generation result')
      return img.url
    }

    if (gen.status === 'FAILED') {
      throw new Error(`Generation ${generationId} failed on Leonardo servers`)
    }

    process.stdout.write('.')
  }

  throw new Error(`Timed out polling generation ${generationId}`)
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const out = createWriteStream(destPath)
    httpsGet(url, res => {
      if (res.statusCode !== 200) {
        out.destroy()
        reject(new Error(`HTTP ${res.statusCode} downloading image`))
        return
      }
      res.pipe(out)
      out.on('finish', () => { out.close(); resolve() })
      out.on('error', reject)
    }).on('error', reject)
  })
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await loadEnv()

  const apiKey = process.env.LEONARDO_API_KEY
  if (!apiKey || apiKey.trim() === '') {
    console.error('\n❌  LEONARDO_API_KEY is not set.')
    console.error('    Add it to .env.local:')
    console.error('      LEONARDO_API_KEY=your_key_here\n')
    console.error('    Get your API key at:')
    console.error('      https://app.leonardo.ai/settings/api\n')
    process.exit(1)
  }

  await mkdir(OUT_DIR, { recursive: true })

  const limit = Number(process.env.LEONARDO_LIMIT ?? 0)
  const onlyRaw = (process.env.LEONARDO_ONLY ?? '').trim()
  const onlySet = new Set(
    onlyRaw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  )

  const baseQueue = Number.isFinite(limit) && limit > 0
    ? IMAGES.slice(0, limit)
    : IMAGES

  const generationQueue = onlySet.size
    ? baseQueue.filter(img => onlySet.has(img.filename))
    : baseQueue

  const force = ['1', 'true', 'yes'].includes((process.env.LEONARDO_FORCE ?? '').toLowerCase())

  const totalImages = generationQueue.length
  console.log(`\n🏋  Scott Gordon Fitness — Image Generation`)
  console.log(`   Generating ${totalImages} images → public/images/`)
  console.log(`   Estimated credits: ~${totalImages * 8}–${totalImages * 12}\n`)

  const selectedModelId = await resolveDefaultModelId()
  if (selectedModelId) {
    console.log(`   Selected model id: ${selectedModelId}`)
  } else {
    console.log('   Selected model id: (none; API default)')
  }
  if (limit > 0) {
    console.log(`   Limited run: first ${totalImages} image(s) via LEONARDO_LIMIT\n`)
  }
  if (onlySet.size > 0) {
    console.log(`   File filter: ${[...onlySet].join(', ')}\n`)
  }
  if (force) {
    console.log('   Force mode: existing files will be overwritten\n')
  }

  const results = []

  for (let i = 0; i < generationQueue.length; i++) {
    const spec = generationQueue[i]
    const destPath = path.join(OUT_DIR, spec.filename)
    const index = `[${String(i + 1).padStart(2)}/${totalImages}]`

    if (existsSync(destPath) && !force) {
      console.log(`${index} ⏭   ${spec.filename} — already exists, skipping`)
      results.push({ filename: spec.filename, status: 'skip' })
      continue
    }

    try {
      process.stdout.write(`${index} 🎨  Generating ${spec.filename} (${spec.width}×${spec.height})`)

      let imageUrl = null
      for (let attempt = 0; attempt <= MAX_SAFE_RETRIES; attempt++) {
        const attemptSpec = attempt === 0 ? spec : buildSafetyRetrySpec(spec, attempt)
        if (attempt > 0) {
          process.stdout.write(`\n   ↻ Safety retry ${attempt}/${MAX_SAFE_RETRIES}`)
        }

        try {
          const generationId = await submitGeneration(attemptSpec)
          process.stdout.write(' — waiting')
          imageUrl = await pollForCompletion(generationId)
          break
        } catch (error) {
          if (!isNoSafeImagesError(error.message) || attempt === MAX_SAFE_RETRIES) {
            throw error
          }
        }
      }

      process.stdout.write('\n')

      await downloadFile(imageUrl, destPath)
      console.log(`${index} ✅  Saved → public/images/${spec.filename}`)
      results.push({ filename: spec.filename, status: 'ok' })
    } catch (err) {
      process.stdout.write('\n')
      console.error(`${index} ❌  ${spec.filename}: ${err.message}`)
      results.push({ filename: spec.filename, status: 'error', error: err.message })
    }

    // Avoid hammering the API
    if (i < generationQueue.length - 1) await sleep(SUBMISSION_DELAY_MS)
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const ok    = results.filter(r => r.status === 'ok').length
  const skip  = results.filter(r => r.status === 'skip').length
  const errors = results.filter(r => r.status === 'error')

  console.log('\n── Results ─────────────────────────────────────────────────')
  console.log(`   ✅  Generated : ${ok}`)
  console.log(`   ⏭   Skipped   : ${skip}`)
  console.log(`   ❌  Errors    : ${errors.length}`)
  if (errors.length) {
    console.log('\n   Failed images:')
    errors.forEach(e => console.log(`     • ${e.filename}: ${e.error}`))
  }
  if (ok > 0) {
    console.log('\n   Next steps:')
    console.log('     1. Review images in public/images/')
    console.log('     2. Replace coach-portrait.jpg with a real photo before launch')
    console.log('     3. Wire images into page components (npm run wire-images is a good name)')
  }
  console.log()
}

main().catch(err => {
  console.error('\n💥  Fatal:', err.message)
  process.exit(1)
})
