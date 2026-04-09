import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Stripe webhook handler — requires STRIPE_SECRET_KEY at runtime
  // Full implementation activates once env vars are set in Vercel
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  try {
    const { stripe } = await import('@/lib/stripe')
    const { supabaseAdmin } = await import('@/lib/supabase')
    const Stripe = (await import('stripe')).default

    const body = await req.text()
    const sig = req.headers.get('stripe-signature')!
    const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as InstanceType<typeof Stripe>['checkout']['sessions']['retrieve'] extends (...args: any) => Promise<infer R> ? R : any
      const { clientId, packageName, sessionsTotal } = (session as any).metadata || {}

      if (clientId && packageName && sessionsTotal) {
        await supabaseAdmin().from('client_packages').insert({
          client_id: clientId,
          package_name: packageName,
          sessions_total: parseInt(sessionsTotal),
          sessions_remaining: parseInt(sessionsTotal),
          stripe_payment_id: (session as any).payment_intent,
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 400 })
  }
}
