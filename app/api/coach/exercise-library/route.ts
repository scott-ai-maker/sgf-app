import { NextResponse } from 'next/server'
import { getRequestAuthz, requireRole, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const authz = await getRequestAuthz()
    requireRole(authz.client.role, ['coach'])
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('exercise_library_entries')
    .select('id, name, slug, description, coaching_cues, primary_equipment, muscle_groups, media_image_url, media_video_url, is_active, metadata_json, created_at')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: 'Failed to load exercise library' }, { status: 500 })
  }

  const exercises = (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    slug: e.slug,
    description: e.description,
    coaching_cues: e.coaching_cues,
    primary_equipment: e.primary_equipment,
    muscle_groups: e.muscle_groups,
    media_image_url: e.media_image_url,
    media_video_url: e.media_video_url,
    is_active: e.is_active,
    metadata: e.metadata_json ?? {},
    created_at: e.created_at,
  }))

  return NextResponse.json({ exercises })
}
