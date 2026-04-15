import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
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

    // Only allow images
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const ext = file.type.split('/')[1] || 'jpg'
    const filename = `${user.id}/before-photo-${Date.now()}.${ext}`

    // Delete old photo if exists
    const { data: files } = await admin.storage.from('fitness-photos').list(user.id)
    if (files && files.length > 0) {
      const oldFiles = files
        .filter(f => f.name.startsWith('before-photo-'))
        .map(f => `${user.id}/${f.name}`)
      if (oldFiles.length > 0) {
        await admin.storage.from('fitness-photos').remove(oldFiles)
      }
    }

    // Upload new photo
    const { error: uploadError } = await admin.storage
      .from('fitness-photos')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`)
    }

    // Get public URL
    const { data } = admin.storage.from('fitness-photos').getPublicUrl(filename)

    if (!data.publicUrl) {
      throw new Error('Failed to generate public URL')
    }

    // Update fitness profile with photo URL
    const { error: updateError } = await admin
      .from('fitness_profiles')
      .update({ before_photo_url: data.publicUrl })
      .eq('user_id', user.id)

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`)
    }

    return NextResponse.json({ photoUrl: data.publicUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Photo upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
