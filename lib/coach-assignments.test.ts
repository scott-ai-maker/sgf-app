import { describe, expect, it } from 'vitest'
import { assignClientToCoach, CoachAssignmentError, releaseClientFromCoach } from '@/lib/coach-assignments'

function createAssignAdmin(options: {
  targetClient: Record<string, unknown> | null
  updatedClient?: Record<string, unknown> | null
  updateError?: { message: string } | null
}) {
  const targetMaybeSingle = async () => ({ data: options.targetClient })
  const updatedMaybeSingle = async () => ({
    data: options.updatedClient ?? null,
    error: options.updateError ?? null,
  })

  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: targetMaybeSingle,
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
                    is() {
                      return {
                        select() {
                          return {
                            maybeSingle: updatedMaybeSingle,
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
    },
  }
}

function createReleaseAdmin(options: {
  targetClient: Record<string, unknown> | null
  updatedClient?: Record<string, unknown> | null
  updateError?: { message: string } | null
}) {
  const targetMaybeSingle = async () => ({ data: options.targetClient })
  const updatedMaybeSingle = async () => ({
    data: options.updatedClient ?? null,
    error: options.updateError ?? null,
  })

  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: targetMaybeSingle,
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
                        maybeSingle: updatedMaybeSingle,
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

describe('coach assignment logic', () => {
  it('assigns an unassigned client to the coach', async () => {
    const client = await assignClientToCoach(
      createAssignAdmin({
        targetClient: { id: 'client-1', role: 'client', designated_coach_id: null, full_name: 'Client', email: 'c@example.com' },
        updatedClient: { id: 'client-1', role: 'client', designated_coach_id: 'coach-1', full_name: 'Client', email: 'c@example.com' },
      }),
      'client-1',
      'coach-1'
    )

    expect(client.designated_coach_id).toBe('coach-1')
  })

  it('rejects assignment when client belongs to another coach', async () => {
    await expect(
      assignClientToCoach(
        createAssignAdmin({
          targetClient: { id: 'client-1', role: 'client', designated_coach_id: 'coach-2', full_name: 'Client', email: 'c@example.com' },
        }),
        'client-1',
        'coach-1'
      )
    ).rejects.toMatchObject<CoachAssignmentError>({ status: 409 })
  })

  it('releases only a client assigned to the current coach', async () => {
    const client = await releaseClientFromCoach(
      createReleaseAdmin({
        targetClient: { id: 'client-1', role: 'client', designated_coach_id: 'coach-1', full_name: 'Client', email: 'c@example.com' },
        updatedClient: { id: 'client-1', role: 'client', designated_coach_id: null, full_name: 'Client', email: 'c@example.com' },
      }),
      'client-1',
      'coach-1'
    )

    expect(client.designated_coach_id).toBeNull()
  })

  it('rejects release when the client is assigned to another coach', async () => {
    await expect(
      releaseClientFromCoach(
        createReleaseAdmin({
          targetClient: { id: 'client-1', role: 'client', designated_coach_id: 'coach-2', full_name: 'Client', email: 'c@example.com' },
        }),
        'client-1',
        'coach-1'
      )
    ).rejects.toMatchObject<CoachAssignmentError>({ status: 403 })
  })
})