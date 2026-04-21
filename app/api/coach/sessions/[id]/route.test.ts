import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getRequestAuthzMock, requireCoachAssignedClientMock, supabaseAdminMock } = vi.hoisted(() => ({
  getRequestAuthzMock: vi.fn(),
  requireCoachAssignedClientMock: vi.fn(),
  supabaseAdminMock: vi.fn(),
}))

vi.mock('@/lib/authz', async () => {
  const actual = await vi.importActual<typeof import('@/lib/authz')>('@/lib/authz')
  return {
    ...actual,
    getRequestAuthz: getRequestAuthzMock,
    requireCoachAssignedClient: requireCoachAssignedClientMock,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: supabaseAdminMock,
}))

import { PATCH } from '@/app/api/coach/sessions/[id]/route'
import { AuthzError } from '@/lib/authz'

const coachUser = { user: { id: 'coach-1' }, client: { role: 'coach' } }

function makeAdmin(
  session: unknown,
  updateReturn: unknown = null,
  pkg: unknown = null,
) {
  const updateObj = {
    eq: () => ({
      select: () => ({
        single: async () => ({
          data: updateReturn,
          error: updateReturn ? null : { message: 'db error' },
        }),
      }),
    }),
  }

  const pkgUpdateObj = {
    eq: () => ({ data: null, error: null }),
  }

  return {
    from(table: string) {
      if (table === 'sessions') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: session, error: null }),
                }
              },
            }
          },
          update() {
            return updateObj
          },
        }
      }
      if (table === 'client_packages') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: pkg, error: null }),
                }
              },
            }
          },
          update() {
            return pkgUpdateObj
          },
        }
      }
      return {}
    },
  }
}

function makeRequest(body: object, id = 'session-1') {
  return [
    new NextRequest(`http://localhost/api/coach/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ] as const
}

describe('PATCH /api/coach/sessions/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    getRequestAuthzMock.mockRejectedValue(new AuthzError('Unauthorized', 401))
    supabaseAdminMock.mockReturnValue(makeAdmin(null))
    const [req, ctx] = makeRequest({ status: 'completed' })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(401)
  })

  it('returns 403 when coach is not assigned to client', async () => {
    getRequestAuthzMock.mockResolvedValue(coachUser)
    const session = { id: 'session-1', client_id: 'client-1', status: 'scheduled', package_id: null }
    supabaseAdminMock.mockReturnValue(makeAdmin(session))
    requireCoachAssignedClientMock.mockRejectedValue(new AuthzError('Forbidden', 403))
    const [req, ctx] = makeRequest({ status: 'completed' })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(403)
  })

  it('returns 404 when session not found', async () => {
    getRequestAuthzMock.mockResolvedValue(coachUser)
    requireCoachAssignedClientMock.mockResolvedValue(undefined)
    supabaseAdminMock.mockReturnValue(makeAdmin(null))
    const [req, ctx] = makeRequest({ status: 'completed' })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid status', async () => {
    getRequestAuthzMock.mockResolvedValue(coachUser)
    requireCoachAssignedClientMock.mockResolvedValue(undefined)
    const session = { id: 'session-1', client_id: 'client-1', status: 'scheduled', package_id: null }
    supabaseAdminMock.mockReturnValue(makeAdmin(session, session))
    const [req, ctx] = makeRequest({ status: 'unknown_status' })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'Invalid status' })
  })

  it('returns 400 when no patchable fields provided', async () => {
    getRequestAuthzMock.mockResolvedValue(coachUser)
    requireCoachAssignedClientMock.mockResolvedValue(undefined)
    const session = { id: 'session-1', client_id: 'client-1', status: 'scheduled', package_id: null }
    supabaseAdminMock.mockReturnValue(makeAdmin(session, session))
    const [req, ctx] = makeRequest({})
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'No fields to update' })
  })

  it('updates notes without deducting credits', async () => {
    getRequestAuthzMock.mockResolvedValue(coachUser)
    requireCoachAssignedClientMock.mockResolvedValue(undefined)
    const session = { id: 'session-1', client_id: 'client-1', status: 'scheduled', package_id: null }
    const updated = { ...session, notes: 'Great session' }
    supabaseAdminMock.mockReturnValue(makeAdmin(session, updated))
    const [req, ctx] = makeRequest({ notes: 'Great session' })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ notes: 'Great session' })
  })

  it('deducts session credit when marking completed with package_id', async () => {
    getRequestAuthzMock.mockResolvedValue(coachUser)
    requireCoachAssignedClientMock.mockResolvedValue(undefined)
    const pkg = { id: 'pkg-1', sessions_remaining: 5 }
    const session = { id: 'session-1', client_id: 'client-1', status: 'scheduled', package_id: 'pkg-1' }
    const updated = { ...session, status: 'completed' }
    const adminMock = makeAdmin(session, updated, pkg)
    const updateSpy = vi.fn().mockReturnValue({ eq: () => ({ data: null, error: null }) })
    // @ts-expect-error - override update on client_packages
    adminMock.from = (table: string) => {
      const real = makeAdmin(session, updated, pkg).from(table)
      if (table === 'client_packages') {
        return { ...real, update: updateSpy }
      }
      return real
    }
    supabaseAdminMock.mockReturnValue(adminMock)
    const [req, ctx] = makeRequest({ status: 'completed' })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(200)
    expect(updateSpy).toHaveBeenCalledWith({ sessions_remaining: 4 })
  })

  it('does NOT deduct credit when already completed (idempotent)', async () => {
    getRequestAuthzMock.mockResolvedValue(coachUser)
    requireCoachAssignedClientMock.mockResolvedValue(undefined)
    const session = { id: 'session-1', client_id: 'client-1', status: 'completed', package_id: 'pkg-1' }
    const updated = { ...session }
    const adminMock = makeAdmin(session, updated, { sessions_remaining: 3 })
    const updateSpy = vi.fn()
    // @ts-expect-error - mock chain override for client_packages update behavior
    adminMock.from = (table: string) => {
      const real = makeAdmin(session, updated, { sessions_remaining: 3 }).from(table)
      if (table === 'client_packages') {
        return { ...real, update: updateSpy }
      }
      return real
    }
    supabaseAdminMock.mockReturnValue(adminMock)
    const [req, ctx] = makeRequest({ status: 'completed' })
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(200)
    // update should NOT be called since session was already completed
    expect(updateSpy).not.toHaveBeenCalled()
  })
})
