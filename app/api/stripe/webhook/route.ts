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
      const {
        clientId,
        packageName,
        sessionsTotal,
        discountCode,
        discountAmountCents,
      } = session.metadata ?? {}
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
        const fallbackEmail = `${clientId}@placeholder.local`

        let { error: clientError } = await admin
          .from('clients')
          .upsert(
            {
              id: clientId,
              email: checkoutEmail ?? fallbackEmail,
            },
            { onConflict: 'id' }
          )

        // If the email is already used by another row, preserve FK integrity
        // by creating this id with a guaranteed-unique placeholder email.
        if (clientError && clientError.message.includes('clients_email_key')) {
          const retry = await admin
            .from('clients')
            .upsert(
              {
                id: clientId,
                email: fallbackEmail,
              },
              { onConflict: 'id' }
            )
          clientError = retry.error
        }

        if (clientError) {
          throw new Error(`Failed upserting client: ${clientError.message}`)
        }

        const normalizedDiscountCode = (discountCode ?? '').trim().toUpperCase()
        const parsedDiscountAmount = Number.parseInt(discountAmountCents ?? '0', 10)
        const discountAmount = Number.isNaN(parsedDiscountAmount) ? 0 : Math.max(parsedDiscountAmount, 0)

        const { error: packageError } = await admin.from('client_packages').insert({
          client_id: clientId,
          package_name: packageName,
          sessions_total: parseInt(sessionsTotal),
          sessions_remaining: parseInt(sessionsTotal),
          stripe_payment_id: paymentIntentId,
          source: 'purchase',
          discount_code: normalizedDiscountCode || null,
          discount_amount_cents: discountAmount,
        })

        if (packageError) {
          throw new Error(`Failed inserting package: ${packageError.message}`)
        }

        if (paymentIntentId && normalizedDiscountCode) {
          const { data: discountCodeRow, error: discountCodeError } = await admin
            .from('discount_codes')
            .select('id')
            .eq('code', normalizedDiscountCode)
            .maybeSingle()

          if (discountCodeError) {
            throw new Error(`Failed loading discount code: ${discountCodeError.message}`)
          }

          if (discountCodeRow?.id) {
            const { data: redemption, error: redemptionError } = await admin
              .from('discount_code_redemptions')
              .insert({
                discount_code_id: discountCodeRow.id,
                client_id: clientId,
                stripe_payment_id: paymentIntentId,
                amount_cents: discountAmount,
              })
              .select('id')
              .maybeSingle()

            if (redemptionError && redemptionError.code !== '23505') {
              throw new Error(`Failed inserting discount redemption: ${redemptionError.message}`)
            }

            if (redemption?.id) {
              const { error: redemptionCountError } = await admin.rpc('increment_discount_code_redemptions', {
                p_discount_code: normalizedDiscountCode,
              })

              if (redemptionCountError) {
                throw new Error(`Failed incrementing discount redemptions: ${redemptionCountError.message}`)
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 400 })
  }
}
