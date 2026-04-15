import type { SupabaseClient } from '@supabase/supabase-js'

export const FITNESS_PHOTO_BUCKET = 'fitness-photos'
export const FITNESS_PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60

export function normalizePhotoPath(path: string | null | undefined) {
  return String(path ?? '').trim().replace(/^\/+/, '')
}

export function extractPhotoPathFromLegacyUrl(input: string | null | undefined) {
  const raw = String(input ?? '').trim()
  if (!raw) return null

  try {
    const url = new URL(raw)
    const markers = [
      `/storage/v1/object/public/${FITNESS_PHOTO_BUCKET}/`,
      `/storage/v1/object/authenticated/${FITNESS_PHOTO_BUCKET}/`,
      `/storage/v1/object/sign/${FITNESS_PHOTO_BUCKET}/`,
    ]

    const matched = markers.find(marker => url.pathname.includes(marker))
    if (!matched) return null

    const idx = url.pathname.indexOf(matched)
    if (idx < 0) return null

    const pathPart = url.pathname.slice(idx + matched.length)
    const cleanPath = decodeURIComponent(pathPart).replace(/^\/+/, '')
    return cleanPath || null
  } catch {
    return null
  }
}

export async function createSignedFitnessPhotoUrl(
  supabase: SupabaseClient,
  path: string | null | undefined
) {
  const normalized = normalizePhotoPath(path)
  if (!normalized) return null

  const { data, error } = await supabase.storage
    .from(FITNESS_PHOTO_BUCKET)
    .createSignedUrl(normalized, FITNESS_PHOTO_SIGNED_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) {
    return null
  }

  return data.signedUrl
}
