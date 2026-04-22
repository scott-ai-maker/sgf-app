import { NextRequest, NextResponse } from 'next/server'
import { AuthzError, getRequestAuthz, requireRole } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'

const PHONE_REGEX = /^[0-9+()\-\s.]{7,24}$/

type SettingsPayload = {
  fullName?: unknown
  phone?: unknown
}

function normalizeFullName(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length < 2 || trimmed.length > 100) return null
  return trimmed
}

function normalizePhone(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (!PHONE_REGEX.test(trimmed)) return null
  return trimmed
}

function getAuthzErrorResponse(error: unknown) {
  const status = error instanceof AuthzError ? error.status : 500
  const message = error instanceof Error ? error.message : 'Unauthorized'
  return NextResponse.json({ error: message }, { status })
}

export async function GET() {
  let userId = ''

  try {
    const authz = await getRequestAuthz()
    requireRole(authz.client.role, ['client', 'coach'])
    userId = authz.user.id
  } catch (error) {
    return getAuthzErrorResponse(error)
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('clients')
    .select('email, full_name, phone, role')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    profile: {
      email: data?.email ?? '',
      fullName: data?.full_name ?? '',
      phone: data?.phone ?? '',
      role: data?.role === 'coach' ? 'coach' : 'client',
    },
  })
}

export async function PATCH(req: NextRequest) {
  let userId = ''
  let role: 'client' | 'coach' = 'client'
  let currentMetadata: Record<string, unknown> = {}

  try {
    const authz = await getRequestAuthz()
    requireRole(authz.client.role, ['client', 'coach'])
    userId = authz.user.id
    role = authz.client.role
    currentMetadata = (authz.user.user_metadata ?? {}) as Record<string, unknown>
  } catch (error) {
    return getAuthzErrorResponse(error)
  }

  const body = await req.json().catch(() => null)
  const payload = (body ?? {}) as SettingsPayload

  const fullName = normalizeFullName(payload.fullName)
  if (fullName === null) {
    return NextResponse.json(
      { error: 'Please enter a valid full name (2-100 characters).' },
      { status: 400 }
    )
  }

  const phone = normalizePhone(payload.phone)
  if (phone === null) {
    return NextResponse.json(
      { error: 'Please enter a valid phone number or leave it blank.' },
      { status: 400 }
    )
  }

  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('clients')
    .update({
      full_name: fullName,
      phone: phone || null,
    })
    .eq('id', userId)
    .select('email, full_name, phone, role')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Unable to update settings.' },
      { status: 500 }
    )
  }

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...currentMetadata,
      full_name: fullName,
      name: fullName,
    },
  })

  return NextResponse.json({
    profile: {
      email: data.email ?? '',
      fullName: data.full_name ?? '',
      phone: data.phone ?? '',
      role: data.role === 'coach' ? 'coach' : role,
    },
  })
}
