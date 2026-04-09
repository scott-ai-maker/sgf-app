import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

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
