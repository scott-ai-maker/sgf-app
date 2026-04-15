import { describe, expect, it, vi } from 'vitest'

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: supabaseAdminMock,
}))

import { AuthzError, requireCoachAssignedClient, requireRole } from '@/lib/authz'

describe('authorization helpers', () => {
  it('allows listed roles', () => {
    expect(() => requireRole('coach', ['coach'])).not.toThrow()
  })

  it('rejects disallowed roles', () => {
    expect(() => requireRole('client', ['coach'])).toThrow(AuthzError)
  })

  it('allows assigned coach/client pairs', async () => {
    supabaseAdminMock.mockReturnValue({
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({ data: { id: 'client-1' } }),
                    }
                  },
                }
              },
            }
          },
        }
      },
    })

    await expect(requireCoachAssignedClient('coach-1', 'client-1')).resolves.toBeUndefined()
  })

  it('rejects unassigned coach/client pairs', async () => {
    supabaseAdminMock.mockReturnValue({
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({ data: null }),
                    }
                  },
                }
              },
            }
          },
        }
      },
    })

    await expect(requireCoachAssignedClient('coach-1', 'client-1')).rejects.toMatchObject<AuthzError>({ status: 403 })
  })
})