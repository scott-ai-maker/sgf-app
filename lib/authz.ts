import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export type AppRole = 'client' | 'coach'

export interface ClientRecord {
  id: string
  role: AppRole
  email: string | null
  designated_coach_id: string | null
}

export class AuthzError extends Error {
  status: number

  constructor(message: string, status = 403) {
    super(message)
    this.status = status
  }
}

function normalizeRole(role: string | null | undefined): AppRole | null {
  if (role === 'client' || role === 'coach') return role
  return null
}

function unauthorizedRedirect(expectedRole: AppRole, actualRole: AppRole | null): string {
  if (expectedRole === 'client') {
    return actualRole === 'coach' ? '/coach' : '/auth/login'
  }

  return actualRole === 'client' ? '/dashboard' : '/auth/login'
}

export async function requireSurfaceRole(expectedRole: AppRole) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const client = await ensureClientRecord(user)
  const role = normalizeRole(client.role)

  if (role !== expectedRole) {
    redirect(unauthorizedRedirect(expectedRole, role))
  }

  return { supabase, user, role }
}

async function ensureClientRecord(user: User): Promise<ClientRecord> {
  const admin = supabaseAdmin()

  const { data: existing } = await admin
    .from('clients')
    .select('id, role, email, designated_coach_id')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) {
    return {
      id: existing.id,
      role: (existing.role === 'coach' ? 'coach' : 'client') as AppRole,
      email: existing.email,
      designated_coach_id: existing.designated_coach_id,
    }
  }

  const displayName = (user.user_metadata?.full_name || user.user_metadata?.name || '').toString().trim() || null

  const { data: inserted, error } = await admin
    .from('clients')
    .upsert(
      {
        id: user.id,
        email: user.email ?? '',
        full_name: displayName,
        role: 'client',
      },
      { onConflict: 'id' }
    )
    .select('id, role, email, designated_coach_id')
    .single()

  if (error || !inserted) {
    throw new AuthzError('Failed to initialize client profile', 500)
  }

  return {
    id: inserted.id,
    role: (inserted.role === 'coach' ? 'coach' : 'client') as AppRole,
    email: inserted.email,
    designated_coach_id: inserted.designated_coach_id,
  }
}

export async function getRequestAuthz() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new AuthzError('Unauthorized', 401)
  }

  const client = await ensureClientRecord(user)

  return { user, client }
}

export function requireRole(clientRole: AppRole, allowed: AppRole[]) {
  if (!allowed.includes(clientRole)) {
    throw new AuthzError('Forbidden', 403)
  }
}

export async function requireCoachAssignedClient(coachId: string, clientId: string) {
  const { data } = await supabaseAdmin()
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('designated_coach_id', coachId)
    .maybeSingle()

  if (!data) {
    throw new AuthzError('Client is not assigned to this coach', 403)
  }
}
