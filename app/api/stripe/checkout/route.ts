import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
      clientId: user.id,
      packageName: pkg.name,
      sessionsTotal: String(pkg.sessions),
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/packages`,
  })

  return NextResponse.json({ url: session.url })
}
