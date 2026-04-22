function toOrigin(value: string) {
  return new URL(value).origin
}

function parseAllowlist(allowlist: string | undefined) {
  if (!allowlist) return null

  const origins = allowlist
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(toOrigin)

  return new Set(origins)
}

export function getTrustedAppBaseUrl() {
  const configuredBaseUrl =
    process.env.APP_BASE_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? process.env.MARKETING_BASE_URL

  if (!configuredBaseUrl) {
    throw new Error('Missing APP_BASE_URL (or NEXT_PUBLIC_APP_URL / MARKETING_BASE_URL) configuration')
  }

  const configuredOrigin = toOrigin(configuredBaseUrl)
  const allowlistedOrigins = parseAllowlist(process.env.ALLOWED_APP_BASE_URLS)

  if (allowlistedOrigins && allowlistedOrigins.size > 0 && !allowlistedOrigins.has(configuredOrigin)) {
    throw new Error('Configured APP_BASE_URL is not present in ALLOWED_APP_BASE_URLS')
  }

  return configuredOrigin
}