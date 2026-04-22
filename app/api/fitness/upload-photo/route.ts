import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { protectCSRF } from '@/lib/csrf'
import {
  createSignedFitnessPhotoUrl,
  FITNESS_PHOTO_BUCKET,
} from '@/lib/fitness-photos'

export async function POST(req: NextRequest) {
  const csrf = await protectCSRF(req)
  if (!csrf.valid) return csrf.error

  const supabase = await createClient()
  const admin = supabaseAdmin()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('photo') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No photo provided' }, { status: 400 })
    }

    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const filename = `${user.id}/before-photo-${Date.now()}.${ext}`

    const { data: profile } = await admin
      .from('fitness_profiles')
      .select('before_photo_path')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profile?.before_photo_path) {
      await admin.storage.from(FITNESS_PHOTO_BUCKET).remove([profile.before_photo_path])
    }

    // Delete stale legacy photos in case older rows exist.
    const { data: files } = await admin.storage.from(FITNESS_PHOTO_BUCKET).list(user.id)
    if (files && files.length > 0) {
      const oldFiles = files
        .filter(f => f.name.startsWith('before-photo-'))
        .map(f => `${user.id}/${f.name}`)
      if (oldFiles.length > 0) {
        await admin.storage.from(FITNESS_PHOTO_BUCKET).remove(oldFiles)
      }
    }

    // Upload new photo
    const { error: uploadError } = await admin.storage
      .from(FITNESS_PHOTO_BUCKET)
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    const signedUrl = await createSignedFitnessPhotoUrl(admin, filename)

    // Update fitness profile with storage path (private bucket).
    const { error: updateError } = await admin
      .from('fitness_profiles')
      .update({
        before_photo_path: filename,
        before_photo_url: null,
      })
      .eq('user_id', user.id)

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`)
    }

    return NextResponse.json({ photoUrl: signedUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Photo upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
