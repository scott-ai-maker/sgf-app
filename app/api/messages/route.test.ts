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

import { GET, POST } from '@/app/api/messages/route'
import { AuthzError } from '@/lib/authz'

function createMessagesAdmin(messages: unknown[] = []) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    order() {
                      return {
                        limit: async () => ({ data: messages, error: null }),
                      }
                    },
                  }
                },
              }
            },
            single: async () => ({ data: messages[0] ?? null, error: null }),
          }
        },
        insert(payload: unknown) {
          return {
            select() {
              return {
                single: async () => ({ data: payload, error: null }),
              }
            },
          }
        },
      }
    },
  }
}

describe('messages route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabaseAdminMock.mockReturnValue(createMessagesAdmin([{ id: 'msg-1', message_body: 'hello' }]))
  })

  it('returns unauthorized when message authz fails', async () => {
    getRequestAuthzMock.mockRejectedValue(new AuthzError('Unauthorized', 401))

    const res = await GET(new NextRequest('http://localhost/api/messages'))

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('rejects client message reads when no designated coach exists', async () => {
    getRequestAuthzMock.mockResolvedValue({
      user: { id: 'client-1' },
      client: { role: 'client', designated_coach_id: null },
    })

    const res = await GET(new NextRequest('http://localhost/api/messages'))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'No designated trainer assigned yet.' })
  })

  it('requires clientId for coach message thread reads', async () => {
    getRequestAuthzMock.mockResolvedValue({
      user: { id: 'coach-1' },
      client: { role: 'coach', designated_coach_id: null },
    })

    const res = await GET(new NextRequest('http://localhost/api/messages'))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'clientId is required for coach message threads.' })
  })

  it('reads an assigned coach thread', async () => {
    getRequestAuthzMock.mockResolvedValue({
      user: { id: 'coach-1' },
      client: { role: 'coach', designated_coach_id: null },
    })

    const res = await GET(new NextRequest('http://localhost/api/messages?clientId=client-1'))

    expect(requireCoachAssignedClientMock).toHaveBeenCalledWith('coach-1', 'client-1')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ messages: [{ id: 'msg-1', message_body: 'hello' }] })
  })

  it('rejects empty messages before hitting persistence', async () => {
    getRequestAuthzMock.mockResolvedValue({
      user: { id: 'client-1' },
      client: { role: 'client', designated_coach_id: 'coach-1' },
    })

    const req = new NextRequest('http://localhost/api/messages', {
      method: 'POST',
      body: JSON.stringify({ message: '   ' }),
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'message is required' })
  })

  it('requires clientId for coach messages', async () => {
    getRequestAuthzMock.mockResolvedValue({
      user: { id: 'coach-1' },
      client: { role: 'coach', designated_coach_id: null },
    })

    const req = new NextRequest('http://localhost/api/messages', {
      method: 'POST',
      body: JSON.stringify({ message: 'hello' }),
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'clientId is required for coach messages.' })
  })

  it('persists a valid client message', async () => {
    supabaseAdminMock.mockReturnValue(createMessagesAdmin())
    getRequestAuthzMock.mockResolvedValue({
      user: { id: 'client-1' },
      client: { role: 'client', designated_coach_id: 'coach-1' },
    })

    const req = new NextRequest('http://localhost/api/messages', {
      method: 'POST',
      body: JSON.stringify({ message: 'Need to reschedule' }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      message: {
        client_id: 'client-1',
        coach_id: 'coach-1',
        sender_id: 'client-1',
        message_body: 'Need to reschedule',
      },
    })
  })
})