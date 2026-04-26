import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'
import {
  createSignedFitnessPhotoUrl,
  extractPhotoPathFromLegacyUrl,
  FITNESS_PHOTO_BUCKET,
  normalizePhotoPath,
} from '@/lib/fitness-photos'

export async function GET(req: NextRequest) {
  let userId = ''
  try {
    const authz = await getRequestAuthz(req)
    userId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('progress_photos')
    .select('id, photo_url, taken_at, notes, created_at')
    .eq('user_id', userId)
    .order('taken_at', { ascending: false })
    .limit(52)

  if (error) {
    return NextResponse.json({ error: 'Failed to load photos' }, { status: 500 })
  }

  const photos = await Promise.all((data ?? []).map(async row => {
    const rawValue = String(row.photo_url ?? '').trim()
    const storedPath = /^https?:\/\//i.test(rawValue)
      ? extractPhotoPathFromLegacyUrl(rawValue)
      : normalizePhotoPath(rawValue)
    const signedUrl = storedPath ? await createSignedFitnessPhotoUrl(admin, storedPath) : null

    return {
      ...row,
      photo_url: signedUrl ?? rawValue,
    }
  }))

  return NextResponse.json({ photos })
}

export async function POST(req: NextRequest) {
  let userId = ''
  try {
    const authz = await getRequestAuthz(req)
    userId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }
  const admin = supabaseAdmin()

  const contentType = req.headers.get('content-type') ?? ''

  let photoValue = ''
  let takenAt = ''
  let notes: string | null = null

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('photo') as File | null

    if (!file) {
      return NextResponse.json({ error: 'photo is required' }, { status: 400 })
    }

    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ error: 'Photo must be png, jpeg, or webp' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Photo too large (max 5MB)' }, { status: 400 })
    }

    takenAt = String(formData.get('taken_at') ?? '').trim()
    notes = String(formData.get('notes') ?? '').trim() || null

    const buffer = await file.arrayBuffer()
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const filename = `${userId}/progress-photo-${Date.now()}.${ext}`

    const { error: uploadError } = await admin.storage
      .from(FITNESS_PHOTO_BUCKET)
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }

    photoValue = filename
  } else {
    const body = await req.json()
    photoValue = String(body.photo_url ?? '').trim()
    takenAt = String(body.taken_at ?? '').trim()
    notes = body.notes !== undefined ? String(body.notes).trim() || null : null
  }

  if (!photoValue) {
    return NextResponse.json({ error: 'photo_url is required' }, { status: 400 })
  }

  if (!takenAt.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return NextResponse.json({ error: 'taken_at must be YYYY-MM-DD' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('progress_photos')
    .insert({
      user_id: userId,
      photo_url: photoValue,
      taken_at: takenAt,
      notes,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save progress photo' }, { status: 500 })
  }

  const signedUrl = /^https?:\/\//i.test(data.photo_url)
    ? data.photo_url
    : await createSignedFitnessPhotoUrl(admin, data.photo_url)

  return NextResponse.json({ photo: { ...data, photo_url: signedUrl ?? data.photo_url } }, { status: 201 })
}
