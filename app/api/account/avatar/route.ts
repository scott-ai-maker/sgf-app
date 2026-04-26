import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestAuthz, AuthzError } from '@/lib/authz'
import { protectCSRF } from '@/lib/csrf'
import {
  createSignedFitnessPhotoUrl,
  FITNESS_PHOTO_BUCKET,
} from '@/lib/fitness-photos'

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_FILE_BYTES = 5 * 1024 * 1024

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

  const { data: existing, error } = await admin
    .from('clients')
    .select('avatar_path')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const avatarUrl = await createSignedFitnessPhotoUrl(admin, existing?.avatar_path ?? null)
  return NextResponse.json({ avatarUrl })
}

export async function POST(req: NextRequest) {
  const csrf = await protectCSRF(req)
  if (!csrf.valid) return csrf.error

  const supabase = await createClient()
  const admin = supabaseAdmin()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('avatar') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No avatar provided.' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Avatar must be PNG, JPEG, or WebP.' }, { status: 400 })
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Avatar must be 5MB or smaller.' }, { status: 400 })
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const filename = `${user.id}/account-avatar-${Date.now()}.${ext}`
    const buffer = await file.arrayBuffer()

    const { data: existing } = await admin
      .from('clients')
      .select('avatar_path')
      .eq('id', user.id)
      .maybeSingle()

    if (existing?.avatar_path) {
      await admin.storage.from(FITNESS_PHOTO_BUCKET).remove([existing.avatar_path])
    }

    const { data: files } = await admin.storage.from(FITNESS_PHOTO_BUCKET).list(user.id)
    if (files && files.length > 0) {
      const staleFiles = files
        .filter(fileEntry => fileEntry.name.startsWith('account-avatar-'))
        .map(fileEntry => `${user.id}/${fileEntry.name}`)

      if (staleFiles.length > 0) {
        await admin.storage.from(FITNESS_PHOTO_BUCKET).remove(staleFiles)
      }
    }

    const { error: uploadError } = await admin.storage
      .from(FITNESS_PHOTO_BUCKET)
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const { error: updateError } = await admin
      .from('clients')
      .update({ avatar_path: filename })
      .eq('id', user.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    const avatarUrl = await createSignedFitnessPhotoUrl(admin, filename)

    return NextResponse.json({ avatarUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Avatar upload failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const csrf = await protectCSRF(req)
  if (!csrf.valid) return csrf.error

  const supabase = await createClient()
  const admin = supabaseAdmin()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: existing, error } = await admin
    .from('clients')
    .select('avatar_path')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (existing?.avatar_path) {
    await admin.storage.from(FITNESS_PHOTO_BUCKET).remove([existing.avatar_path])
  }

  const { error: updateError } = await admin
    .from('clients')
    .update({ avatar_path: null })
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ avatarUrl: null })
}
