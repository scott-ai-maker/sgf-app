import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  let userId = ''
  try {
    const authz = await getRequestAuthz()
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

  return NextResponse.json({ photos: data ?? [] })
}

export async function POST(req: NextRequest) {
  let userId = ''
  try {
    const authz = await getRequestAuthz()
    userId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const body = await req.json()

  const photoUrl = String(body.photo_url ?? '').trim()
  if (!photoUrl) {
    return NextResponse.json({ error: 'photo_url is required' }, { status: 400 })
  }

  const takenAt = String(body.taken_at ?? '').trim()
  if (!takenAt.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return NextResponse.json({ error: 'taken_at must be YYYY-MM-DD' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('progress_photos')
    .insert({
      user_id: userId,
      photo_url: photoUrl,
      taken_at: takenAt,
      notes: body.notes !== undefined ? String(body.notes).trim() : null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save progress photo' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
