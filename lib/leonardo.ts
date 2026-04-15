const API_BASE = 'https://cloud.leonardo.ai/api/rest/v1'

interface LeonardoGenerationRequest {
  prompt: string
  negativePrompt?: string
  width?: number
  height?: number
  numImages?: number
  initImageId?: string
  initStrength?: number
  alchemy?: boolean
  presetStyle?: 'PHOTOGRAPHY' | 'DYNAMIC'
}

interface GenerationResult {
  url: string
  usedUnsafeFallback: boolean
}

interface PollOptions {
  maxPolls: number
  intervalMs: number
}

const BASE_NEGATIVE_PROMPT = [
  'watermark',
  'text',
  'logo',
  'blurry',
  'low quality',
  'distorted anatomy',
  'deformed features',
  'asymmetrical face',
  'bad proportions',
  'cartoon',
  'illustration',
  'artificial',
  'CGI',
  'poorly drawn',
  'composite',
  'before and after collage',
  'multiple people',
  'duplicate body parts',
  'extra limbs',
  'fused limbs',
  'mutated hands',
  'grotesque muscle bulges',
  'extreme bodybuilder',
].join(', ')

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const key = process.env.LEONARDO_API_KEY
  if (!key) throw new Error('LEONARDO_API_KEY is not configured')

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`Leonardo API error (${res.status}): ${msg}`)
  }

  return res.json()
}

function extensionFromMime(contentType: string | undefined) {
  const normalized = String(contentType ?? '').toLowerCase()
  if (normalized.includes('png')) return 'png'
  if (normalized.includes('webp')) return 'webp'
  return 'jpeg'
}

/**
 * Uploads raw image bytes to Leonardo as an init image for img2img generation.
 */
export async function uploadInitImageFromBuffer(
  imageBuffer: ArrayBuffer,
  contentType = 'image/jpeg'
): Promise<string> {
  const ext = extensionFromMime(contentType)

  // Step 1: get presigned S3 details from Leonardo
  const presign = await apiRequest('/init-image', {
    method: 'POST',
    body: JSON.stringify({ extension: ext }),
  })
  const { id, fields: rawFields, url } = presign.uploadInitImage as {
    id: string
    fields: string
    url: string
  }

  // Step 2: upload to S3 using the presigned fields (fields is a JSON string)
  const fields = JSON.parse(rawFields) as Record<string, string>
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value)
  }
  form.append('file', new Blob([imageBuffer], { type: contentType || `image/${ext}` }))

  const s3Res = await fetch(url, { method: 'POST', body: form })
  if (!s3Res.ok) throw new Error(`S3 upload failed: ${s3Res.status}`)

  return id
}

async function submitGeneration(body: LeonardoGenerationRequest) {
  const data = await apiRequest('/generations', {
    method: 'POST',
    body: JSON.stringify({
      prompt: body.prompt,
      negative_prompt: body.negativePrompt ?? BASE_NEGATIVE_PROMPT,
      num_images: body.numImages ?? 1,
      width: body.width ?? 768,
      height: body.height ?? 1024,
      alchemy: body.alchemy ?? true,
      presetStyle: body.presetStyle ?? 'PHOTOGRAPHY',
      ...(body.initImageId ? { init_image_id: body.initImageId, init_strength: body.initStrength ?? 0.45 } : {}),
      ...(process.env.LEONARDO_SEED ? { seed: Number(process.env.LEONARDO_SEED) } : {}),
    }),
  })

  return data?.sdGenerationJob?.generationId as string | undefined
}

async function pollGeneration(generationId: string, options: PollOptions): Promise<GenerationResult> {
  for (let i = 0; i < options.maxPolls; i += 1) {
    await new Promise(resolve => setTimeout(resolve, options.intervalMs))

    const data = await apiRequest(`/generations/${generationId}`)
    const gen = data?.generations_by_pk

    if (gen?.status === 'COMPLETE') {
      const images = Array.isArray(gen.generated_images) ? gen.generated_images as Array<{ nsfw?: boolean; url?: string }> : []
      const firstSafe = images.find(img => !img.nsfw && img.url)
      if (firstSafe?.url) return { url: firstSafe.url, usedUnsafeFallback: false }

      // Some valid generations are over-flagged; use first available URL as a fallback.
      const firstAvailable = images.find(img => img.url)
      if (firstAvailable?.url) {
        console.warn('Leonardo returned no safe images; using first available image fallback')
        return { url: firstAvailable.url, usedUnsafeFallback: true }
      }

      throw new Error('Leonardo generation completed but returned no image URLs')
    }

    if (gen?.status === 'FAILED') {
      throw new Error('Leonardo generation failed')
    }
  }

  throw new Error('Leonardo generation timeout')
}

export async function generatePredictionImage(prompt: string, initImageId?: string) {
  const attempts: Array<{
    initStrength?: number
    numImages: number
    requireSafe: boolean
    negativePrompt?: string
    poll: PollOptions
    useInitImage?: boolean
    alchemy?: boolean
    presetStyle?: 'PHOTOGRAPHY' | 'DYNAMIC'
    width?: number
    height?: number
  }> = initImageId
    ? [
        { initStrength: 0.35, numImages: 1, requireSafe: true, poll: { maxPolls: 14, intervalMs: 2000 }, useInitImage: true, alchemy: true, presetStyle: 'PHOTOGRAPHY' },
        { initStrength: 0.25, numImages: 1, requireSafe: false, poll: { maxPolls: 10, intervalMs: 2000 }, useInitImage: true, alchemy: true, presetStyle: 'PHOTOGRAPHY' },
        { numImages: 1, requireSafe: false, poll: { maxPolls: 8, intervalMs: 2000 }, useInitImage: false, alchemy: false, presetStyle: 'DYNAMIC', width: 640, height: 896 },
      ]
    : [
        { numImages: 1, requireSafe: true, poll: { maxPolls: 14, intervalMs: 2000 }, useInitImage: false, alchemy: true, presetStyle: 'PHOTOGRAPHY' },
        { numImages: 1, requireSafe: false, poll: { maxPolls: 10, intervalMs: 2000 }, useInitImage: false, alchemy: false, presetStyle: 'DYNAMIC', width: 640, height: 896 },
      ]

  const errors: string[] = []

  for (const attempt of attempts) {
    try {
      const generationId = await submitGeneration({
        prompt,
        width: attempt.width ?? 768,
        height: attempt.height ?? 1024,
        numImages: attempt.numImages,
        negativePrompt: attempt.negativePrompt,
        alchemy: attempt.alchemy,
        presetStyle: attempt.presetStyle,
        ...(attempt.useInitImage && initImageId ? { initImageId } : {}),
        ...(attempt.initStrength ? { initStrength: attempt.initStrength } : {}),
      })

      if (!generationId) {
        errors.push('Missing Leonardo generation ID')
        continue
      }

      const result = await pollGeneration(generationId, attempt.poll)
      if (attempt.requireSafe && result.usedUnsafeFallback) {
        errors.push('No safe image returned in strict attempt')
        continue
      }

      return result.url
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown generation error'
      errors.push(message)
    }
  }

  throw new Error(`Prediction generation failed after retries: ${errors.join(' | ')}`)
}
