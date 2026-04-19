import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getRequestAuthzMock, supabaseAdminMock } = vi.hoisted(() => ({
  getRequestAuthzMock: vi.fn(),
  supabaseAdminMock: vi.fn(),
}))

vi.mock('@/lib/authz', async () => {
  const actual = await vi.importActual<typeof import('@/lib/authz')>('@/lib/authz')
  return { ...actual, getRequestAuthz: getRequestAuthzMock }
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: supabaseAdminMock,
}))

import { POST } from '@/app/api/fitness/skip-exercise/route'
import { AuthzError } from '@/lib/authz'

const authedUser = { user: { id: 'user-1' }, client: { role: 'client' } }

function makeAdmin(insertReturn: unknown = null) {
  return {
    from() {
      return {
        insert() {
          return {
            select() {
              return {
                single: async () => ({
                  data: insertReturn,
                  error: insertReturn ? null : { message: 'db error' },
                }),
              }
            },
          }
        },
      }
    },
  }
}

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/fitness/skip-exercise', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validPayload = {
  exercise_name: 'Squat',
  session_date: '2026-04-19',
  reason: 'injury',
}

describe('POST /api/fitness/skip-exercise', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    getRequestAuthzMock.mockRejectedValue(new AuthzError('Unauthorized', 401))
    supabaseAdminMock.mockReturnValue(makeAdmin())
    const res = await POST(makeRequest(validPayload))
    expect(res.status).toBe(401)
  })

  it('rejects missing exercise_name', async () => {
    getRequestAuthzMock.mockResolvedValue(authedUser)
    supabaseAdminMock.mockReturnValue(makeAdmin())
    const res = await POST(makeRequest({ session_date: '2026-04-19', reason: 'injury' }))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('exercise_name') })
  })

  it('rejects invalid session_date', async () => {
    getRequestAuthzMock.mockResolvedValue(authedUser)
    supabaseAdminMock.mockReturnValue(makeAdmin())
    const res = await POST(makeRequest({ exercise_name: 'Squat', session_date: 'bad-date', reason: 'injury' }))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('session_date') })
  })

  it('rejects invalid reason', async () => {
    getRequestAuthzMock.mockResolvedValue(authedUser)
    supabaseAdminMock.mockReturnValue(makeAdmin())
    const res = await POST(makeRequest({ exercise_name: 'Squat', session_date: '2026-04-19', reason: 'lazy' }))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('reason') })
  })

  it('defaults reason to "other" when omitted', async () => {
    getRequestAuthzMock.mockResolvedValue(authedUser)
    const record = { id: 'skip-1', exercise_name: 'Squat', reason: 'other' }
    supabaseAdminMock.mockReturnValue(makeAdmin(record))
    const res = await POST(makeRequest({ exercise_name: 'Squat', session_date: '2026-04-19' }))
    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({ reason: 'other' })
  })

  it('creates a skip log with valid payload', async () => {
    getRequestAuthzMock.mockResolvedValue(authedUser)
    const record = { id: 'skip-1', ...validPayload, user_id: 'user-1' }
    supabaseAdminMock.mockReturnValue(makeAdmin(record))
    const res = await POST(makeRequest(validPayload))
    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toMatchObject({ exercise_name: 'Squat', reason: 'injury' })
  })

  it('returns 500 on db error', async () => {
    getRequestAuthzMock.mockResolvedValue(authedUser)
    supabaseAdminMock.mockReturnValue(makeAdmin(null))
    const res = await POST(makeRequest(validPayload))
    expect(res.status).toBe(500)
  })
})
