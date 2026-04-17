export type DiscountType = 'percent' | 'fixed_amount'

export interface DiscountCodeRecord {
  id: string
  code: string
  description: string | null
  discount_type: DiscountType
  discount_value: number
  is_active: boolean
  max_redemptions: number | null
  redemptions_count: number
  starts_at: string
  expires_at: string | null
  applies_to_package_ids: string[] | null
  restricted_client_id: string | null
}

const SAFE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function normalizeDiscountCode(raw: string | null | undefined) {
  if (!raw) return ''
  return raw.trim().toUpperCase()
}

export function generateDiscountCode(prefix = 'SGF', randomLength = 6) {
  let randomPart = ''
  for (let i = 0; i < randomLength; i += 1) {
    const idx = Math.floor(Math.random() * SAFE_CODE_CHARS.length)
    randomPart += SAFE_CODE_CHARS[idx]
  }
  return `${prefix}-${randomPart}`
}

export function isDiscountCodeActive(code: DiscountCodeRecord, now = new Date()) {
  if (!code.is_active) return false

  const startsAt = new Date(code.starts_at)
  if (!Number.isNaN(startsAt.getTime()) && startsAt.getTime() > now.getTime()) {
    return false
  }

  if (code.expires_at) {
    const expiresAt = new Date(code.expires_at)
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < now.getTime()) {
      return false
    }
  }

  if (code.max_redemptions !== null && code.redemptions_count >= code.max_redemptions) {
    return false
  }

  return true
}

export function isDiscountCodeEligibleForPackage(code: DiscountCodeRecord, packageId: string) {
  if (!code.applies_to_package_ids || code.applies_to_package_ids.length === 0) {
    return true
  }
  return code.applies_to_package_ids.includes(packageId)
}

export function calculateDiscountAmountCents(priceCents: number, discountType: DiscountType, discountValue: number) {
  if (priceCents <= 0 || discountValue <= 0) return 0

  if (discountType === 'percent') {
    const pct = Math.min(Math.max(discountValue, 1), 100)
    return Math.floor((priceCents * pct) / 100)
  }

  return Math.min(discountValue, priceCents)
}
