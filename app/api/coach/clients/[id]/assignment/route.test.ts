import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getRequestAuthzMock, requireRoleMock, assignClientToCoachMock, releaseClientFromCoachMock, supabaseAdminMock } = vi.hoisted(() => ({
  getRequestAuthzMock: vi.fn(),
  requireRoleMock: vi.fn(),
  assignClientToCoachMock: vi.fn(),
  releaseClientFromCoachMock: vi.fn(),
  supabaseAdminMock: vi.fn(),
}))

vi.mock('@/lib/authz', async () => {
  const actual = await vi.importActual<typeof import('@/lib/authz')>('@/lib/authz')
  return {
    ...actual,
    getRequestAuthz: getRequestAuthzMock,
    requireRole: requireRoleMock,
  }
})

vi.mock('@/lib/coach-assignments', async () => {
  const actual = await vi.importActual<typeof import('@/lib/coach-assignments')>('@/lib/coach-assignments')
  return {
    ...actual,
    assignClientToCoach: assignClientToCoachMock,
    releaseClientFromCoach: releaseClientFromCoachMock,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: supabaseAdminMock,
}))

import { PATCH, DELETE } from '@/app/api/coach/clients/[id]/assignment/route'
import { AuthzError } from '@/lib/authz'
import { CoachAssignmentError } from '@/lib/coach-assignments'

describe('coach assignment route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabaseAdminMock.mockReturnValue({ from: vi.fn() })
    getRequestAuthzMock.mockResolvedValue({
      user: { id: 'coach-1' },
      client: { role: 'coach' },
    })
  })

  it('returns unauthorized when authz resolution fails', async () => {
    getRequestAuthzMock.mockRejectedValue(new AuthzError('Unauthorized', 401))

    const res = await PATCH(new NextRequest('http://localhost/api/coach/clients/client-1/assignment'), {
      params: Promise.resolve({ id: 'client-1' }),
    })

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('assigns a client for an authenticated coach', async () => {
    assignClientToCoachMock.mockResolvedValue({ id: 'client-1', designated_coach_id: 'coach-1' })

    const res = await PATCH(new NextRequest('http://localhost/api/coach/clients/client-1/assignment'), {
      params: Promise.resolve({ id: 'client-1' }),
    })

    expect(requireRoleMock).toHaveBeenCalledWith('coach', ['coach'])
    expect(assignClientToCoachMock).toHaveBeenCalledWith(expect.any(Object), 'client-1', 'coach-1')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ client: { id: 'client-1', designated_coach_id: 'coach-1' } })
  })

  it('maps assignment conflicts to their status code', async () => {
    assignClientToCoachMock.mockRejectedValue(new CoachAssignmentError('Client is already assigned to another coach', 409))

    const res = await PATCH(new NextRequest('http://localhost/api/coach/clients/client-1/assignment'), {
      params: Promise.resolve({ id: 'client-1' }),
    })

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({ error: 'Client is already assigned to another coach' })
  })

  it('releases a client for the current coach', async () => {
    releaseClientFromCoachMock.mockResolvedValue({ id: 'client-1', designated_coach_id: null })

    const res = await DELETE(new NextRequest('http://localhost/api/coach/clients/client-1/assignment'), {
      params: Promise.resolve({ id: 'client-1' }),
    })

    expect(releaseClientFromCoachMock).toHaveBeenCalledWith(expect.any(Object), 'client-1', 'coach-1')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ client: { id: 'client-1', designated_coach_id: null } })
  })
})