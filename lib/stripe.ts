import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    })
  : (null as unknown as Stripe)

// Coaching packages — edit prices/sessions here
export const PACKAGES = [
  {
    id: 'starter',
    name: 'Starter Pack',
    sessions: 4,
    price: 24000, // cents = $240
    description: '4 one-hour coaching sessions',
    priceId: '', // set after creating in Stripe dashboard
  },
  {
    id: 'momentum',
    name: 'Momentum Pack',
    sessions: 8,
    price: 44000, // $440
    description: '8 one-hour coaching sessions',
    priceId: '',
    popular: true,
  },
  {
    id: 'transformation',
    name: 'Transformation Pack',
    sessions: 16,
    price: 80000, // $800
    description: '16 one-hour coaching sessions',
    priceId: '',
  },
]
