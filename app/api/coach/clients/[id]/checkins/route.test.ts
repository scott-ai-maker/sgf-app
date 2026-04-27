import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getRequestAuthzMock, requireCoachAssignedClientMock, supabaseAdminMock } = vi.hoisted(() => ({
  getRequestAuthzMock: vi.fn(),
  requireCoachAssignedClientMock: vi.fn(),
  supabaseAdminMock: vi.fn(),
}))

const { sendPushToUserMock } = vi.hoisted(() => ({
  sendPushToUserMock: vi.fn(),
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

vi.mock('@/lib/push-notifications', () => ({
  sendPushToUser: sendPushToUserMock,
}))

import { GET, PATCH } from '@/app/api/coach/clients/[id]/checkins/route'
import { AuthzError } from '@/lib/authz'

const coachUser = { user: { id: 'coach-1' }, client: { role: 'coach' } }
const clientId = 'client-1'

function makeAdmin(listReturn: unknown[] = [], updateReturn: unknown = null) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                order() {
                  return {
                    limit: async () => ({ data: listReturn, error: null }),
                  }
                },
              }
            },
          }
        },
        update() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    select() {
                      return {
                        single: async () => ({
                          data: updateReturn,
                          error: updateReturn ? null : { message: 'db error' },
                        }),
                      }
                    },
                  }
                },
              }
            },
          }
        },
      }
    },
  }
}

function makeCtx(id = clientId) {
  return { params: Promise.resolve({ id }) }
}

function makeGetRequest(id = clientId) {
  return new NextRequest(`http://localhost/api/coach/clients/${id}/checkins`)
}

function makePatchRequest(body: object, id = clientId) {
  return new NextRequest(`http://localhost/api/coach/clients/${id}/checkins`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/coach/clients/[id]/checkins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendPushToUserMock.mockResolvedValue({ delivered: 1, skipped: false })
  })

  it('returns 401 when unauthenticated', async () => {
    getRequestAuthzMock.mockRejectedValue(new AuthzError('Unauthorized', 401))
    supabaseAdminMock.mockReturnValue(makeAdmin())
    const res = await GET(makeGetRequest(), makeCtx())
    expect(res.status).toBe(401)
  })

  it('returns 403 when coach is not assigned to client', async () => {
    getRequestAuthzMock.mockResolvedValue(coachUser)
    requireCoachAssignedClientMock.mockRejectedValue(new AuthzError('Forbidden', 403))
    supabaseAdminMock.mockReturnValue(makeAdmin())
    const res = await GET(makeGetRequest(), makeCtx())
    expect(res.status).toBe(403)
  })

  it('returns check-ins list for assigned coach', async () => {
    getRequestAuthzMock.mockResolvedValue(coachUser)
    requireCoachAssignedClientMock.mockResolvedValue(undefined)
    const checkins = [{ id: 'ci-1', week_start: '2026-04-14', sleep_quality: 8 }]
    supabaseAdminMock.mockReturnValue(makeAdmin(checkins))
    const res = await GET(makeGetRequest(), makeCtx())
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ checkins })
  })
})

describe('PATCH /api/coach/clients/[id]/checkins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendPushToUserMock.mockResolvedValue({ delivered: 1, skipped: false })
  })

  it('returns 401 when unauthenticated', async () => {
    getRequestAuthzMock.mockRejectedValue(new AuthzError('Unauthorized', 401))
    supabaseAdminMock.mockReturnValue(makeAdmin())
    const res = await PATCH(makePatchRequest({ checkin_id: 'ci-1', coach_feedback: 'good' }), makeCtx())
    expect(res.status).toBe(401)
  })

  it('returns 403 when not assigned to client', async () => {
    getRequestAuthzMock.mockResolvedValue(coachUser)
    requireCoachAssignedClientMock.mockRejectedValue(new AuthzError('Forbidden', 403))
    supabaseAdminMock.mockReturnValue(makeAdmin())
    const res = await PATCH(makePatchRequest({ checkin_id: 'ci-1', coach_feedback: 'good' }), makeCtx())
    expect(res.status).toBe(403)
  })

  it('returns 400 when checkin_id is missing', async () => {
    getRequestAuthzMock.mockResolvedValue(coachUser)
    requireCoachAssignedClientMock.mockResolvedValue(undefined)
    supabaseAdminMock.mockReturnValue(makeAdmin())
    const res = await PATCH(makePatchRequest({ coach_feedback: 'good' }), makeCtx())
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'checkin_id required' })
  })

  it('returns 400 when no updateable fields provided', async () => {
    getRequestAuthzMock.mockResolvedValue(coachUser)
    requireCoachAssignedClientMock.mockResolvedValue(undefined)
    supabaseAdminMock.mockReturnValue(makeAdmin())
    const res = await PATCH(makePatchRequest({ checkin_id: 'ci-1' }), makeCtx())
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'No fields to update' })
  })

  it('updates coach_feedback on valid request', async () => {
    getRequestAuthzMock.mockResolvedValue(coachUser)
    requireCoachAssignedClientMock.mockResolvedValue(undefined)
    const updated = { id: 'ci-1', coach_feedback: 'Great week!' }
    supabaseAdminMock.mockReturnValue(makeAdmin([], updated))
    const res = await PATCH(makePatchRequest({ checkin_id: 'ci-1', coach_feedback: 'Great week!' }), makeCtx())
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ coach_feedback: 'Great week!' })
    expect(sendPushToUserMock).toHaveBeenCalledWith({
      userId: clientId,
      alert: {
        title: 'Coach feedback posted',
        body: 'Great week!',
      },
      data: {
        type: 'coach_feedback',
        checkinId: 'ci-1',
      },
    })
  })

  it('returns 500 on db error', async () => {
    getRequestAuthzMock.mockResolvedValue(coachUser)
    requireCoachAssignedClientMock.mockResolvedValue(undefined)
    supabaseAdminMock.mockReturnValue(makeAdmin([], null))
    const res = await PATCH(makePatchRequest({ checkin_id: 'ci-1', coach_feedback: 'feedback' }), makeCtx())
    expect(res.status).toBe(500)
  })
})
