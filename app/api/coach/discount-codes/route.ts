import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, requireCoachAssignedClient, requireRole, AuthzError } from '@/lib/authz'
import { supabaseAdmin } from '@/lib/supabase'
import { generateDiscountCode, normalizeDiscountCode } from '@/lib/discount-codes'

interface CreateDiscountCodeBody {
  code?: unknown
  description?: unknown
  discountType?: unknown
  discountValue?: unknown
  maxRedemptions?: unknown
  expiresAt?: unknown
  packageIds?: unknown
  restrictedClientId?: unknown
}

function isValidDiscountCodeFormat(value: string) {
  return /^[A-Z0-9-]{4,32}$/.test(value)
}

export async function GET(req: NextRequest) {
  let coachId = ''
  try {
    const authz = await getRequestAuthz(req)
    requireRole(authz.client.role, ['coach'])
    coachId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('discount_codes')
    .select('id, code, description, discount_type, discount_value, is_active, max_redemptions, redemptions_count, starts_at, expires_at, applies_to_package_ids, restricted_client_id, created_at')
    .eq('created_by_coach_id', coachId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    return NextResponse.json({ error: 'Failed to load discount codes' }, { status: 500 })
  }

  return NextResponse.json({ codes: data ?? [] })
}

export async function POST(req: NextRequest) {
  let coachId = ''
  try {
    const authz = await getRequestAuthz(req)
    requireRole(authz.client.role, ['coach'])
    coachId = authz.user.id
  } catch (error) {
    const status = error instanceof AuthzError ? error.status : 500
    const message = error instanceof Error ? error.message : 'Unauthorized'
    return NextResponse.json({ error: message }, { status })
  }

  const body = (await req.json().catch(() => ({}))) as CreateDiscountCodeBody

  const discountType = body.discountType === 'fixed_amount' ? 'fixed_amount' : body.discountType === 'percent' ? 'percent' : null
  if (!discountType) {
    return NextResponse.json({ error: 'discountType must be percent or fixed_amount' }, { status: 400 })
  }

  const discountValue = Number(body.discountValue)
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return NextResponse.json({ error: 'discountValue must be greater than 0' }, { status: 400 })
  }

  if (discountType === 'percent' && (!Number.isInteger(discountValue) || discountValue > 95)) {
    return NextResponse.json({ error: 'percent discounts must be an integer between 1 and 95' }, { status: 400 })
  }

  if (discountType === 'fixed_amount' && (!Number.isInteger(discountValue) || discountValue < 50)) {
    return NextResponse.json({ error: 'fixed_amount discounts must be in cents and at least 50' }, { status: 400 })
  }

  const maxRedemptions = body.maxRedemptions === null || body.maxRedemptions === undefined
    ? null
    : Number(body.maxRedemptions)

  if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 5000)) {
    return NextResponse.json({ error: 'maxRedemptions must be between 1 and 5000 when provided' }, { status: 400 })
  }

  const restrictedClientId = typeof body.restrictedClientId === 'string' && body.restrictedClientId.trim().length > 0
    ? body.restrictedClientId.trim()
    : null

  if (restrictedClientId) {
    try {
      await requireCoachAssignedClient(coachId, restrictedClientId)
    } catch (error) {
      const status = error instanceof AuthzError ? error.status : 500
      const message = error instanceof Error ? error.message : 'Forbidden'
      return NextResponse.json({ error: message }, { status })
    }
  }

  let expiresAt: string | null = null
  if (typeof body.expiresAt === 'string' && body.expiresAt.trim().length > 0) {
    const parsed = new Date(body.expiresAt)
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'expiresAt must be a valid ISO datetime' }, { status: 400 })
    }
    expiresAt = parsed.toISOString()
  }

  let packageIds: string[] | null = null
  if (Array.isArray(body.packageIds)) {
    const normalized = body.packageIds
      .filter((v): v is string => typeof v === 'string')
      .map(v => v.trim())
      .filter(Boolean)

    packageIds = normalized.length > 0 ? Array.from(new Set(normalized)) : null
  }

  const description = typeof body.description === 'string' && body.description.trim().length > 0
    ? body.description.trim().slice(0, 200)
    : null

  const providedCode = typeof body.code === 'string' ? normalizeDiscountCode(body.code) : ''
  const code = providedCode || normalizeDiscountCode(generateDiscountCode('COACH', 6))

  if (!isValidDiscountCodeFormat(code)) {
    return NextResponse.json({ error: 'code must be 4-32 chars using A-Z, 0-9, and dashes' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('discount_codes')
    .insert({
      code,
      description,
      discount_type: discountType,
      discount_value: Math.floor(discountValue),
      max_redemptions: maxRedemptions,
      expires_at: expiresAt,
      applies_to_package_ids: packageIds,
      restricted_client_id: restrictedClientId,
      created_by_coach_id: coachId,
    })
    .select('id, code, description, discount_type, discount_value, is_active, max_redemptions, redemptions_count, starts_at, expires_at, applies_to_package_ids, restricted_client_id, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Discount code already exists. Try a different code.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create discount code' }, { status: 500 })
  }

  return NextResponse.json({ code: data })
}
