import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function normalizeOrigin(url: string) {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

function trustedOriginsFromEnv() {
  const origins = new Set<string>()

  const directValues = [
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.MARKETING_BASE_URL,
  ]

  for (const value of directValues) {
    if (!value) continue
    const origin = normalizeOrigin(value)
    if (origin) origins.add(origin)
  }

  const allowlist = process.env.ALLOWED_APP_BASE_URLS
  if (allowlist) {
    for (const value of allowlist.split(',')) {
      const trimmed = value.trim()
      if (!trimmed) continue
      const origin = normalizeOrigin(trimmed)
      if (origin) origins.add(origin)
    }
  }

  return origins
}

function requestOrigin(request: NextRequest) {
  const originHeader = request.headers.get('origin')
  if (originHeader) return normalizeOrigin(originHeader)

  const refererHeader = request.headers.get('referer')
  if (refererHeader) return normalizeOrigin(refererHeader)

  return null
}

function isMethodProtected(method: string) {
  return WRITE_METHODS.has(method.toUpperCase())
}

/**
 * Generate a random CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Validate CSRF token from request
 * Tokens can be passed in:
 * 1. X-CSRF-Token header
 * 2. Form data csrf field
 */
export async function validateCSRFToken(request: NextRequest, sessionToken: string | undefined): Promise<boolean> {
  if (!sessionToken) {
    return false
  }

  // Try to get token from header first (API requests)
  const headerToken = request.headers.get('x-csrf-token')
  if (headerToken) {
    return headerToken === sessionToken
  }

  // Try to get token from form data (form submissions)
  try {
    const contentType = request.headers.get('content-type')
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      const formToken = formData.get('csrf')?.toString()
      return formToken === sessionToken
    } else if (contentType?.includes('application/json')) {
      const body = await request.json()
      return body.csrf === sessionToken
    }
  } catch (e) {
    console.error('Error validating CSRF token:', e)
    return false
  }

  return false
}

/**
 * Middleware to protect against CSRF attacks on state-changing requests
 * Apply to POST, PATCH, PUT, DELETE routes
 *
 * Usage:
 * ```tsx
 * const { valid, error } = await protectCSRF(request)
 * if (!valid) return error
 * // ... rest of handler
 * ```
 */
export async function protectCSRF(request: NextRequest) {
  if (process.env.NODE_ENV === 'test') {
    return { valid: true }
  }

  // Skip CSRF validation for safe methods.
  if (!isMethodProtected(request.method)) {
    return { valid: true }
  }

  // Get CSRF-Session cookie (set by client on initial page load)
  const sessionToken = request.cookies.get('csrf-session')?.value

  // Get CSRF token from request (header or body)
  const clientToken = request.headers.get('x-csrf-token')

  if (sessionToken && clientToken && sessionToken === clientToken) {
    return { valid: true }
  }

  // Fallback protection for clients that rely on same-origin browser requests.
  const origin = requestOrigin(request)
  if (origin) {
    const trustedOrigins = trustedOriginsFromEnv()

    if (trustedOrigins.size > 0 && trustedOrigins.has(origin)) {
      return { valid: true }
    }
  }

  return {
    valid: false,
    error: NextResponse.json(
      { error: 'CSRF token validation failed' },
      { status: 403 }
    ),
  }
}

/**
 * Create CSRF token response headers
 * Sets both header and cookie for client to use
 *
 * Usage in GET endpoint:
 * ```tsx
 * const csrfToken = generateCSRFToken()
 * const response = successResponse(data)
 * response.headers.set('X-CSRF-Token', csrfToken)
 * response.cookies.set('csrf-session', csrfToken)
 * return response
 * ```
 */
export function addCSRFTokenToResponse(response: NextResponse, token: string): NextResponse {
  response.headers.set('x-csrf-token', token)
  response.cookies.set('csrf-session', token, {
    httpOnly: false, // Needs to be accessible to JS for form/fetch
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
  })
  return response
}
