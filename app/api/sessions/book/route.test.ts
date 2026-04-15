import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getRequestAuthzMock, requireRoleMock, supabaseAdminMock, rpcMock } = vi.hoisted(() => ({
  getRequestAuthzMock: vi.fn(),
  requireRoleMock: vi.fn(),
  supabaseAdminMock: vi.fn(),
  rpcMock: vi.fn(),
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

import { POST } from '@/app/api/sessions/book/route'
import { AuthzError } from '@/lib/authz'

describe('sessions book route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRequestAuthzMock.mockResolvedValue({
      user: { id: 'client-1' },
      client: { role: 'client' },
    })
    supabaseAdminMock.mockReturnValue({ rpc: rpcMock })
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'session-1',
          client_id: 'client-1',
          package_id: 'pkg-1',
          scheduled_at: '2030-01-01T10:00:00.000Z',
          status: 'scheduled',
        },
      ],
      error: null,
    })
  })

  it('returns auth error status from authz layer', async () => {
    getRequestAuthzMock.mockRejectedValue(new AuthzError('Unauthorized', 401))

    const req = new NextRequest('http://localhost/api/sessions/book', {
      method: 'POST',
      body: JSON.stringify({ packageId: 'pkg-1', scheduledAt: '2030-01-01T10:00:00.000Z' }),
    })

    const res = await POST(req)

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('rejects invalid scheduledAt before rpc call', async () => {
    const req = new NextRequest('http://localhost/api/sessions/book', {
      method: 'POST',
      body: JSON.stringify({ packageId: 'pkg-1', scheduledAt: 'not-a-date' }),
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'scheduledAt must be a valid ISO datetime' })
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('maps PACKAGE_NOT_FOUND rpc error to 404', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'PACKAGE_NOT_FOUND' } })

    const req = new NextRequest('http://localhost/api/sessions/book', {
      method: 'POST',
      body: JSON.stringify({ packageId: 'pkg-missing', scheduledAt: '2030-01-01T10:00:00.000Z' }),
    })

    const res = await POST(req)

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'Package not found' })
  })

  it('maps NO_SESSIONS_REMAINING rpc error to 400', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'NO_SESSIONS_REMAINING' } })

    const req = new NextRequest('http://localhost/api/sessions/book', {
      method: 'POST',
      body: JSON.stringify({ packageId: 'pkg-1', scheduledAt: '2030-01-01T10:00:00.000Z' }),
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'No sessions remaining in this package' })
  })

  it('maps SLOT_ALREADY_BOOKED rpc error to 409', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'SLOT_ALREADY_BOOKED' } })

    const req = new NextRequest('http://localhost/api/sessions/book', {
      method: 'POST',
      body: JSON.stringify({ packageId: 'pkg-1', scheduledAt: '2030-01-01T10:00:00.000Z' }),
    })

    const res = await POST(req)

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({ error: 'This slot is already booked' })
  })

  it('maps duplicate-key rpc errors to 409', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "sessions_unique_scheduled_slot_idx"',
        details: 'Key (scheduled_at)=(2030-01-01 10:00:00+00) already exists.',
      },
    })

    const req = new NextRequest('http://localhost/api/sessions/book', {
      method: 'POST',
      body: JSON.stringify({ packageId: 'pkg-1', scheduledAt: '2030-01-01T10:00:00.000Z' }),
    })

    const res = await POST(req)

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({ error: 'This slot is already booked' })
  })

  it('returns booked session when rpc succeeds', async () => {
    const req = new NextRequest('http://localhost/api/sessions/book', {
      method: 'POST',
      body: JSON.stringify({ packageId: 'pkg-1', scheduledAt: '2030-01-01T10:00:00.000Z' }),
    })

    const res = await POST(req)

    expect(requireRoleMock).toHaveBeenCalledWith('client', ['client'])
    expect(rpcMock).toHaveBeenCalledWith('book_client_session', {
      p_client_id: 'client-1',
      p_package_id: 'pkg-1',
      p_scheduled_at: '2030-01-01T10:00:00.000Z',
    })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      success: true,
      session: {
        id: 'session-1',
        client_id: 'client-1',
        package_id: 'pkg-1',
        scheduled_at: '2030-01-01T10:00:00.000Z',
        status: 'scheduled',
      },
    })
  })
})
