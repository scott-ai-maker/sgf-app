interface CoachAssignableClient {
  id: string
  role: string | null
  designated_coach_id: string | null
  full_name: string | null
  email: string | null
}

type QueryResult = Promise<{ data: CoachAssignableClient | null; error?: { message: string } | null }>

interface ClientLookupQuery {
  maybeSingle: () => QueryResult
}

interface AssignUpdateChain {
  eq: (column: string, value: string) => {
    eq: (column: string, value: string) => {
      is: (column: string, value: null) => {
        select: (fields: string) => ClientLookupQuery
      }
    }
  }
}

interface ReleaseUpdateChain {
  eq: (column: string, value: string) => {
    eq: (column: string, value: string) => {
      select: (fields: string) => ClientLookupQuery
    }
  }
}

export interface CoachAssignmentsAdmin {
  from: (table: 'clients') => {
    select: (fields: string) => {
      eq: (column: string, value: string) => ClientLookupQuery
    }
    update: (values: { designated_coach_id: string | null }) => AssignUpdateChain | ReleaseUpdateChain
  }
}

export class CoachAssignmentError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function assignClientToCoach(admin: CoachAssignmentsAdmin, clientId: string, coachId: string) {
  const { data: targetClient } = await admin
    .from('clients')
    .select('id, role, designated_coach_id, full_name, email')
    .eq('id', clientId)
    .maybeSingle()

  if (!targetClient || targetClient.role !== 'client') {
    throw new CoachAssignmentError('Client not found', 404)
  }

  if (targetClient.designated_coach_id === coachId) {
    return targetClient as CoachAssignableClient
  }

  if (targetClient.designated_coach_id) {
    throw new CoachAssignmentError('Client is already assigned to another coach', 409)
  }

  const assignUpdate = admin.from('clients').update({ designated_coach_id: coachId }) as AssignUpdateChain

  const { data: updatedClient, error } = await assignUpdate
    .eq('id', clientId)
    .eq('role', 'client')
    .is('designated_coach_id', null)
    .select('id, role, designated_coach_id, full_name, email')
    .maybeSingle()

  if (error) {
    throw new CoachAssignmentError(error.message, 500)
  }

  if (!updatedClient) {
    throw new CoachAssignmentError('Client assignment changed. Refresh and try again.', 409)
  }

  return updatedClient as CoachAssignableClient
}

export async function releaseClientFromCoach(admin: CoachAssignmentsAdmin, clientId: string, coachId: string) {
  const { data: targetClient } = await admin
    .from('clients')
    .select('id, role, designated_coach_id, full_name, email')
    .eq('id', clientId)
    .maybeSingle()

  if (!targetClient || targetClient.role !== 'client') {
    throw new CoachAssignmentError('Client not found', 404)
  }

  if (targetClient.designated_coach_id !== coachId) {
    throw new CoachAssignmentError('Client is not assigned to this coach', 403)
  }

  const releaseUpdate = admin.from('clients').update({ designated_coach_id: null }) as ReleaseUpdateChain

  const { data: updatedClient, error } = await releaseUpdate
    .eq('id', clientId)
    .eq('designated_coach_id', coachId)
    .select('id, role, designated_coach_id, full_name, email')
    .maybeSingle()

  if (error) {
    throw new CoachAssignmentError(error.message, 500)
  }

  if (!updatedClient) {
    throw new CoachAssignmentError('Client assignment changed. Refresh and try again.', 409)
  }

  return updatedClient as CoachAssignableClient
}