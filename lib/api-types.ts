/**
 * Standardized API Response Types
 * Used across all API routes for consistent error handling and data structures
 */

export interface ApiError {
  error: string
}

export interface ApiSuccessResponse<T> {
  data: T
  status?: 'success'
}

export interface ApiPaginatedResponse<T> {
  data: T[]
  total?: number
  page?: number
  pageSize?: number
}

// Auth endpoints
export interface AuthSuccessResponse {
  user: {
    id: string
    email: string
    role: 'client' | 'coach' | 'admin'
  }
  session?: {
    accessToken: string
    expiresIn: number
  }
}

// Messages
export interface MessageResponse {
  id: string
  client_id: string
  coach_id: string
  message: string
  sender_id: string
  read_at: string | null
  created_at: string
}

export interface MessagesListResponse {
  messages: MessageResponse[]
}

// Fitness & Workouts
export interface WorkoutResponse {
  id: string
  user_id: string
  title: string
  exercises: Array<{
    id: string
    name: string
    sets: number
    reps: number
  }>
  created_at: string
}

export interface WorkoutLogResponse {
  id: string
  user_id: string
  created_at: string
  exercises: Array<{
    id: string
    name: string
    sets: number
    reps: number
  }>
}

export interface FitnessProfileResponse {
  user_id: string
  weight_kg: number
  height_m: number
  body_fat_percent: number | null
  experience_level: 'beginner' | 'intermediate' | 'advanced'
  onboarding_completed_at: string | null
}

export interface ProgressPhotoResponse {
  id: string
  user_id: string
  photo_url: string
  taken_at: string
  notes: string | null
}

// Sessions
export interface SessionResponse {
  id: string
  client_id: string
  coach_id: string
  scheduled_at: string
  status: 'scheduled' | 'completed' | 'no_show' | 'cancelled'
  duration_minutes: number
}

export interface SessionsListResponse {
  sessions: SessionResponse[]
}

// Coach Dashboard
export interface ClientResponse {
  id: string
  email: string
  full_name: string
  role: 'client' | 'coach'
  designated_coach_id: string | null
}

export interface ClientsListResponse {
  clients: ClientResponse[]
}

export interface CheckInResponse {
  id: string
  user_id: string
  week_start: string
  overall_mood: number
  sleep_quality: number
  stress_level: number
  soreness_level: number
  energy_level: number
  weight_kg: number | null
  notes: string
}

export interface CheckInsListResponse {
  checkins: CheckInResponse[]
}

// Generic type helpers
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiError
export type ApiListResponse<T> = ApiPaginatedResponse<T> | ApiError

// Status code mapping
export const API_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const
