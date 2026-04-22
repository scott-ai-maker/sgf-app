import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, requireRole, AuthzError } from '@/lib/authz'
import { getTrustedAppBaseUrl } from '@/lib/app-base-url'
import {
  calculateDiscountAmountCents,
  isDiscountCodeActive,
  isDiscountCodeEligibleForPackage,
  normalizeDiscountCode,
  type DiscountCodeRecord,
} from '@/lib/discount-codes'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe is not configured. Missing STRIPE_SECRET_KEY.' }, { status: 500 })
    }

    const authz = await getRequestAuthz(req)
    requireRole(authz.client.role, ['client'])
    const userId = authz.user.id

    const body = await req.json()
    const packageId = body?.packageId
    const discountCodeInput = normalizeDiscountCode(typeof body?.discountCode === 'string' ? body.discountCode : '')

    if (!packageId || typeof packageId !== 'string') {
      return NextResponse.json({ error: 'packageId is required' }, { status: 400 })
    }

    const { stripe, PACKAGES } = await import('@/lib/stripe')

    const pkg = PACKAGES.find(p => p.id === packageId)
    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    let appliedDiscountCode: string | null = null
    let appliedDiscountType: 'percent' | 'fixed_amount' | null = null
    let appliedDiscountValue = 0
    let discountAmountCents = 0

    if (discountCodeInput) {
      const { supabaseAdmin } = await import('@/lib/supabase')
      const admin = supabaseAdmin()

      const { data: discount, error: discountError } = await admin
        .from('discount_codes')
        .select('id, code, description, discount_type, discount_value, is_active, max_redemptions, redemptions_count, starts_at, expires_at, applies_to_package_ids, restricted_client_id')
        .eq('code', discountCodeInput)
        .maybeSingle<DiscountCodeRecord>()

      if (discountError || !discount) {
        return NextResponse.json({ error: 'Invalid discount code' }, { status: 400 })
      }

      if (!isDiscountCodeActive(discount)) {
        return NextResponse.json({ error: 'This discount code is inactive or expired' }, { status: 400 })
      }

      if (discount.restricted_client_id && discount.restricted_client_id !== userId) {
        return NextResponse.json({ error: 'This discount code is not eligible for your account' }, { status: 403 })
      }

      if (!isDiscountCodeEligibleForPackage(discount, packageId)) {
        return NextResponse.json({ error: 'This discount code does not apply to this package' }, { status: 400 })
      }

      appliedDiscountCode = discount.code
      appliedDiscountType = discount.discount_type
      appliedDiscountValue = discount.discount_value
      discountAmountCents = calculateDiscountAmountCents(pkg.price, discount.discount_type, discount.discount_value)
    }

    const finalAmountCents = pkg.price - discountAmountCents

    if (finalAmountCents < 50) {
      return NextResponse.json({
        error: 'Discount is too large for checkout. Use comp sessions for a fully free booking.',
      }, { status: 400 })
    }

    let appUrl: string
    try {
      appUrl = getTrustedAppBaseUrl()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'App base URL is not configured'
      return NextResponse.json({ error: message }, { status: 503 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: pkg.name },
            unit_amount: finalAmountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        clientId: userId,
        packageName: pkg.name,
        sessionsTotal: String(pkg.sessions),
        basePriceCents: String(pkg.price),
        finalPriceCents: String(finalAmountCents),
        discountCode: appliedDiscountCode ?? '',
        discountType: appliedDiscountType ?? '',
        discountValue: String(appliedDiscountValue),
        discountAmountCents: String(discountAmountCents),
      },
      success_url: `${appUrl}/dashboard?success=true`,
      cancel_url: `${appUrl}/packages`,
    })

    return NextResponse.json({
      url: session.url,
      pricing: {
        basePriceCents: pkg.price,
        discountAmountCents,
        finalPriceCents: finalAmountCents,
        discountCode: appliedDiscountCode,
      },
    })
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected checkout error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
