import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  // Stripe webhook handler — requires STRIPE_SECRET_KEY at runtime
  // Full implementation activates once env vars are set in Vercel
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  try {
    const { stripe } = await import('@/lib/stripe')

    const { supabaseAdmin } = await import('@/lib/supabase')
    const body = await req.text()
    const sig = req.headers.get('stripe-signature')!
    const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const { clientId, packageName, sessionsTotal } = session.metadata ?? {}
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null

      if (clientId && packageName && sessionsTotal) {
        const admin = supabaseAdmin()

        if (paymentIntentId) {
          const { data: existingPackage, error: existingError } = await admin
            .from('client_packages')
            .select('id')
            .eq('stripe_payment_id', paymentIntentId)
            .limit(1)
            .maybeSingle()

          if (existingError) {
            throw new Error(`Failed checking existing package: ${existingError.message}`)
          }

          if (existingPackage) {
            return NextResponse.json({ received: true, duplicate: true })
          }
        }

        // Ensure FK target exists before inserting package row.
        const checkoutEmail = session.customer_details?.email ?? session.customer_email ?? null
        const { error: clientError } = await admin
          .from('clients')
          .upsert(
            {
              id: clientId,
              email: checkoutEmail ?? `${clientId}@placeholder.local`,
            },
            { onConflict: 'id' }
          )

        if (clientError) {
          throw new Error(`Failed upserting client: ${clientError.message}`)
        }

        const { error: packageError } = await admin.from('client_packages').insert({
          client_id: clientId,
          package_name: packageName,
          sessions_total: parseInt(sessionsTotal),
          sessions_remaining: parseInt(sessionsTotal),
          stripe_payment_id: paymentIntentId,
        })

        if (packageError) {
          throw new Error(`Failed inserting package: ${packageError.message}`)
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 400 })
  }
}
