import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getRequestAuthzMock, requireRoleMock, supabaseAdminMock, createSessionMock } = vi.hoisted(() => ({
  getRequestAuthzMock: vi.fn(),
  requireRoleMock: vi.fn(),
  supabaseAdminMock: vi.fn(),
  createSessionMock: vi.fn(),
}))

vi.mock('@/lib/authz', async () => {
  const actual = await vi.importActual<typeof import('@/lib/authz')>('@/lib/authz')
  return {
    ...actual,
    getRequestAuthz: getRequestAuthzMock,
    requireRole: requireRoleMock,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: supabaseAdminMock,
}))

vi.mock('@/lib/stripe', () => ({
  PACKAGES: [
    {
      id: 'starter',
      name: 'Starter Pack',
      sessions: 4,
      price: 24000,
    },
  ],
  stripe: {
    checkout: {
      sessions: {
        create: createSessionMock,
      },
    },
  },
}))

import { POST } from '@/app/api/stripe/checkout/route'

function createDiscountAdmin(discount: Record<string, unknown> | null) {
  return {
    from(table: string) {
      if (table !== 'discount_codes') {
        throw new Error(`Unexpected table: ${table}`)
      }

      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: discount, error: null }),
              }
            },
          }
        },
      }
    },
  }
}

describe('stripe checkout route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'test_key'
    getRequestAuthzMock.mockResolvedValue({
      user: { id: 'client-1' },
      client: { role: 'client' },
    })
    createSessionMock.mockResolvedValue({ url: 'https://checkout.stripe.com/test' })
  })

  it('applies a valid percentage discount code', async () => {
    supabaseAdminMock.mockReturnValue(
      createDiscountAdmin({
        id: 'code-1',
        code: 'COACH-15OFF',
        description: null,
        discount_type: 'percent',
        discount_value: 15,
        is_active: true,
        max_redemptions: null,
        redemptions_count: 0,
        starts_at: new Date(Date.now() - 60_000).toISOString(),
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
        applies_to_package_ids: null,
        restricted_client_id: null,
      })
    )

    const req = new NextRequest('http://localhost/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ packageId: 'starter', discountCode: 'coach-15off' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    expect(createSessionMock).toHaveBeenCalledTimes(1)
    const createArgs = createSessionMock.mock.calls[0][0]
    expect(createArgs.line_items[0].price_data.unit_amount).toBe(20400)
    expect(createArgs.metadata.discountCode).toBe('COACH-15OFF')

    await expect(res.json()).resolves.toMatchObject({
      pricing: {
        basePriceCents: 24000,
        discountAmountCents: 3600,
        finalPriceCents: 20400,
      },
    })
  })

  it('rejects expired discount codes', async () => {
    supabaseAdminMock.mockReturnValue(
      createDiscountAdmin({
        id: 'code-1',
        code: 'OLDCODE',
        description: null,
        discount_type: 'fixed_amount',
        discount_value: 1000,
        is_active: true,
        max_redemptions: null,
        redemptions_count: 0,
        starts_at: new Date(Date.now() - 3600_000).toISOString(),
        expires_at: new Date(Date.now() - 60_000).toISOString(),
        applies_to_package_ids: null,
        restricted_client_id: null,
      })
    )

    const req = new NextRequest('http://localhost/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ packageId: 'starter', discountCode: 'oldcode' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: 'This discount code is inactive or expired',
    })
  })
})
