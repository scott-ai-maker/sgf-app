import { NextRequest, NextResponse } from 'next/server'
import { getRequestAuthz, requireRole, AuthzError } from '@/lib/authz'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe is not configured. Missing STRIPE_SECRET_KEY.' }, { status: 500 })
    }

    const authz = await getRequestAuthz()
    requireRole(authz.client.role, ['client'])
    const userId = authz.user.id

    const body = await req.json()
    const packageId = body?.packageId

    if (!packageId || typeof packageId !== 'string') {
      return NextResponse.json({ error: 'packageId is required' }, { status: 400 })
    }

    const { stripe, PACKAGES } = await import('@/lib/stripe')

    const pkg = PACKAGES.find(p => p.id === packageId)
    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: pkg.name },
            unit_amount: pkg.price,
          },
          quantity: 1,
        },
      ],
      metadata: {
        clientId: userId,
        packageName: pkg.name,
        sessionsTotal: String(pkg.sessions),
      },
      success_url: `${appUrl}/dashboard?success=true`,
      cancel_url: `${appUrl}/packages`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : 'Unexpected checkout error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
