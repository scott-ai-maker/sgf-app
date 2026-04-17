import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getRequestAuthzMock, requireRoleMock, requireCoachAssignedClientMock, supabaseAdminMock } = vi.hoisted(() => ({
  getRequestAuthzMock: vi.fn(),
  requireRoleMock: vi.fn(),
  requireCoachAssignedClientMock: vi.fn(),
  supabaseAdminMock: vi.fn(),
}))

vi.mock('@/lib/authz', async () => {
  const actual = await vi.importActual<typeof import('@/lib/authz')>('@/lib/authz')
  return {
    ...actual,
    getRequestAuthz: getRequestAuthzMock,
    requireRole: requireRoleMock,
    requireCoachAssignedClient: requireCoachAssignedClientMock,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: supabaseAdminMock,
}))

import { POST } from '@/app/api/coach/clients/[id]/comp-sessions/route'

function createCompAdmin() {
  return {
    from(table: string) {
      if (table === 'client_packages') {
        return {
          insert(payload: Record<string, unknown>) {
            return {
              select() {
                return {
                  single: async () => ({
                    data: {
                      id: 'pkg-1',
                      ...payload,
                    },
                    error: null,
                  }),
                }
              },
            }
          },
        }
      }

      if (table === 'comp_session_grants') {
        return {
          insert(payload: Record<string, unknown>) {
            return {
              select() {
                return {
                  single: async () => ({
                    data: {
                      id: 'grant-1',
                      ...payload,
                    },
                    error: null,
                  }),
                }
              },
            }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('coach comp sessions route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabaseAdminMock.mockReturnValue(createCompAdmin())
    getRequestAuthzMock.mockResolvedValue({
      user: { id: 'coach-1' },
      client: { role: 'coach' },
    })
  })

  it('grants comp sessions to an assigned client', async () => {
    const req = new NextRequest('http://localhost/api/coach/clients/client-1/comp-sessions', {
      method: 'POST',
      body: JSON.stringify({ sessions: 3, note: 'Retention save' }),
    })

    const res = await POST(req, {
      params: Promise.resolve({ id: 'client-1' }),
    })

    expect(requireRoleMock).toHaveBeenCalledWith('coach', ['coach'])
    expect(requireCoachAssignedClientMock).toHaveBeenCalledWith('coach-1', 'client-1')
    expect(res.status).toBe(200)

    await expect(res.json()).resolves.toMatchObject({
      package: {
        client_id: 'client-1',
        sessions_total: 3,
        sessions_remaining: 3,
        source: 'comp',
      },
      grant: {
        client_id: 'client-1',
        coach_id: 'coach-1',
        sessions_granted: 3,
      },
    })
  })

  it('rejects invalid session counts', async () => {
    const req = new NextRequest('http://localhost/api/coach/clients/client-1/comp-sessions', {
      method: 'POST',
      body: JSON.stringify({ sessions: 0 }),
    })

    const res = await POST(req, {
      params: Promise.resolve({ id: 'client-1' }),
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({
      error: 'sessions must be an integer between 1 and 50',
    })
  })
})
