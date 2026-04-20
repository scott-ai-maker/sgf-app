import { z } from 'zod'

// Dashboard workspace validation
export const DashboardWorkspaceSchema = z.enum(['overview', 'packages', 'sessions'])
export type DashboardWorkspace = z.infer<typeof DashboardWorkspaceSchema>

export function normalizeDashboardWorkspace(value: string | string[] | undefined): DashboardWorkspace {
  try {
    const parsed = DashboardWorkspaceSchema.parse(Array.isArray(value) ? value[0] : value)
    return parsed
  } catch {
    return 'overview'
  }
}

// Fitness workspace validation
export const FitnessWorkspaceSchema = z.enum(['train', 'analyze', 'checkin'])
export type FitnessWorkspace = z.infer<typeof FitnessWorkspaceSchema>

export function normalizeFitnessWorkspace(value: string | string[] | undefined): FitnessWorkspace {
  try {
    const parsed = FitnessWorkspaceSchema.parse(Array.isArray(value) ? value[0] : value)
    return parsed
  } catch {
    return 'train'
  }
}

// Coach focus filter validation
export const CoachFocusFilterSchema = z.enum([
  'all',
  'sessions-this-week',
  'attendance-30d',
  'no-show-30d',
  'onboarding-complete',
  'unread-messages',
  'low-credits',
  'inactive',
  'no-upcoming',
])
export type CoachFocusFilter = z.infer<typeof CoachFocusFilterSchema>

export function normalizeCoachFocusFilter(value: string | string[] | undefined): CoachFocusFilter {
  try {
    const parsed = CoachFocusFilterSchema.parse(Array.isArray(value) ? value[0] : value)
    return parsed
  } catch {
    return 'all'
  }
}

// Coach dashboard tab validation
export const CoachDashboardTabSchema = z.enum(['overview', 'roster', 'intake', 'pipeline'])
export type CoachDashboardTab = z.infer<typeof CoachDashboardTabSchema>

export function normalizeCoachDashboardTab(value: string | string[] | undefined): CoachDashboardTab {
  try {
    const parsed = CoachDashboardTabSchema.parse(Array.isArray(value) ? value[0] : value)
    return parsed
  } catch {
    return 'overview'
  }
}

// Coach client tab validation
export const CoachClientTabSchema = z.enum(['overview', 'program', 'commerce', 'sessions', 'checkins'])
export type CoachClientTab = z.infer<typeof CoachClientTabSchema>

export function normalizeCoachClientTab(value: string | string[] | undefined): CoachClientTab {
  try {
    const parsed = CoachClientTabSchema.parse(Array.isArray(value) ? value[0] : value)
    return parsed
  } catch {
    return 'overview'
  }
}
