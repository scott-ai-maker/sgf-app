import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getRequestAuthzMock, supabaseAdminMock, createSignedFitnessPhotoUrlMock } = vi.hoisted(() => ({
  getRequestAuthzMock: vi.fn(),
  supabaseAdminMock: vi.fn(),
  createSignedFitnessPhotoUrlMock: vi.fn(),
}))

vi.mock('@/lib/authz', async () => {
  const actual = await vi.importActual<typeof import('@/lib/authz')>('@/lib/authz')
  return { ...actual, getRequestAuthz: getRequestAuthzMock }
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: supabaseAdminMock,
}))

vi.mock('@/lib/fitness-photos', async () => {
  const actual = await vi.importActual<typeof import('@/lib/fitness-photos')>('@/lib/fitness-photos')
  return {
    ...actual,
    createSignedFitnessPhotoUrl: createSignedFitnessPhotoUrlMock,
  }
})

import { GET, POST } from '@/app/api/fitness/progress-photos/route'
import { AuthzError } from '@/lib/authz'

const authedUser = { user: { id: 'user-1' }, client: { role: 'client' } }

function makeAdmin(rows: unknown[] = [], insertReturn: unknown = null) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                order() {
                  return {
                    limit: async () => ({ data: rows, error: null }),
                  }
                },
              }
            },
          }
        },
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
    storage: {
      from() {
        return {
          upload: async () => ({ error: null }),
        }
      },
    },
  }
}

describe('GET /api/fitness/progress-photos', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    getRequestAuthzMock.mockRejectedValue(new AuthzError('Unauthorized', 401))
    supabaseAdminMock.mockReturnValue(makeAdmin())
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns empty photos list when no photos exist', async () => {
    getRequestAuthzMock.mockResolvedValue(authedUser)
    supabaseAdminMock.mockReturnValue(makeAdmin([]))
    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ photos: [] })
  })

  it('signs stored path photos and returns signed URL', async () => {
    getRequestAuthzMock.mockResolvedValue(authedUser)
    const row = { id: 'p-1', photo_url: 'user-1/progress-photo-1.jpg', taken_at: '2026-04-01', notes: null, created_at: '' }
    supabaseAdminMock.mockReturnValue(makeAdmin([row]))
    createSignedFitnessPhotoUrlMock.mockResolvedValue('https://signed.example.com/photo.jpg')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.photos[0].photo_url).toBe('https://signed.example.com/photo.jpg')
    expect(createSignedFitnessPhotoUrlMock).toHaveBeenCalledOnce()
  })

  it('falls back to raw url when signing returns null', async () => {
    getRequestAuthzMock.mockResolvedValue(authedUser)
    const row = { id: 'p-1', photo_url: 'user-1/progress-photo-1.jpg', taken_at: '2026-04-01', notes: null, created_at: '' }
    supabaseAdminMock.mockReturnValue(makeAdmin([row]))
    createSignedFitnessPhotoUrlMock.mockResolvedValue(null)
    const res = await GET()
    const body = await res.json()
    expect(body.photos[0].photo_url).toBe('user-1/progress-photo-1.jpg')
  })
})

describe('POST /api/fitness/progress-photos (JSON body)', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeJsonRequest(body: object) {
    return new NextRequest('http://localhost/api/fitness/progress-photos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 when unauthenticated', async () => {
    getRequestAuthzMock.mockRejectedValue(new AuthzError('Unauthorized', 401))
    supabaseAdminMock.mockReturnValue(makeAdmin())
    const res = await POST(makeJsonRequest({ photo_url: 'u/f.jpg', taken_at: '2026-04-01' }))
    expect(res.status).toBe(401)
  })

  it('rejects missing photo_url', async () => {
    getRequestAuthzMock.mockResolvedValue(authedUser)
    supabaseAdminMock.mockReturnValue(makeAdmin())
    const res = await POST(makeJsonRequest({ taken_at: '2026-04-01' }))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('photo_url') })
  })

  it('rejects invalid taken_at format', async () => {
    getRequestAuthzMock.mockResolvedValue(authedUser)
    supabaseAdminMock.mockReturnValue(makeAdmin())
    const res = await POST(makeJsonRequest({ photo_url: 'u/f.jpg', taken_at: 'today' }))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('taken_at') })
  })

  it('saves photo and returns signed URL', async () => {
    getRequestAuthzMock.mockResolvedValue(authedUser)
    const record = { id: 'p-1', photo_url: 'user-1/f.jpg', taken_at: '2026-04-01', notes: null }
    supabaseAdminMock.mockReturnValue(makeAdmin([], record))
    createSignedFitnessPhotoUrlMock.mockResolvedValue('https://signed.example.com/f.jpg')
    const res = await POST(makeJsonRequest({ photo_url: 'user-1/f.jpg', taken_at: '2026-04-01' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.photo.photo_url).toBe('https://signed.example.com/f.jpg')
  })

  it('returns 500 on db insert error', async () => {
    getRequestAuthzMock.mockResolvedValue(authedUser)
    supabaseAdminMock.mockReturnValue(makeAdmin([], null))
    const res = await POST(makeJsonRequest({ photo_url: 'user-1/f.jpg', taken_at: '2026-04-01' }))
    expect(res.status).toBe(500)
  })
})
