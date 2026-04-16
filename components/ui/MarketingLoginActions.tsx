import Link from 'next/link'

export default function MarketingLoginActions() {
  return (
    <>
      <Link href="/auth/login?next=/dashboard" className="site-header-auth-link">
        Client Login
      </Link>
      <Link href="/auth/login?next=/coach" className="site-header-auth-link site-header-auth-link-accent">
        Coach Login
      </Link>
    </>
  )
}