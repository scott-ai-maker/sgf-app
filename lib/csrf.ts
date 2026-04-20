import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

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
  // Skip CSRF validation for GET requests
  if (request.method === 'GET' || request.method === 'HEAD') {
    return { valid: true }
  }

  // Get CSRF-Session cookie (set by client on initial page load)
  const sessionToken = request.cookies.get('csrf-session')?.value

  // Get CSRF token from request (header or body)
  const clientToken = request.headers.get('x-csrf-token')

  if (!sessionToken || !clientToken || sessionToken !== clientToken) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'CSRF token validation failed' },
        { status: 403 }
      ),
    }
  }

  return { valid: true }
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
