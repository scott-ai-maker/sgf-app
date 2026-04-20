import { NextResponse } from 'next/server'

/**
 * Standard API Response envelope for all endpoints
 * Ensures consistency across the API
 */
export type ApiResponse<T = unknown> = {
  data?: T
  error?: string
  status: 'success' | 'error'
  message?: string
}

/**
 * Create a success response
 */
export function successResponse<T>(data: T, message?: string) {
  return NextResponse.json<ApiResponse<T>>(
    {
      data,
      status: 'success',
      message,
    },
    { status: 200 }
  )
}

/**
 * Create an error response
 */
export function errorResponse(error: string, status: number = 400, message?: string) {
  return NextResponse.json<ApiResponse>(
    {
      error,
      status: 'error',
      message,
    },
    { status }
  )
}

/**
 * Create a 401 Unauthorized response
 */
export function unauthorizedResponse() {
  return errorResponse('Unauthorized', 401)
}

/**
 * Create a 403 Forbidden response
 */
export function forbiddenResponse() {
  return errorResponse('Forbidden', 403)
}

/**
 * Create a 404 Not Found response
 */
export function notFoundResponse() {
  return errorResponse('Not found', 404)
}

/**
 * Create a 500 Internal Server Error response
 */
export function internalErrorResponse(error?: string) {
  return errorResponse(error || 'Internal server error', 500)
}

/**
 * Create a 400 Bad Request response
 */
export function badRequestResponse(error: string) {
  return errorResponse(error, 400)
}

/**
 * Create a 422 Unprocessable Entity response
 */
export function unprocessableResponse(error: string) {
  return errorResponse(error, 422)
}
