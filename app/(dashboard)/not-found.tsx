import Link from 'next/link'
import SiteHeader from '@/components/ui/SiteHeader'
import LogoutButton from '@/components/auth/LogoutButton'

export default function DashboardNotFound() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--navy)' }}>
      <SiteHeader
        links={[{ href: '/dashboard', label: 'Dashboard' }]}
        actions={<LogoutButton />}
      />
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 48,
            color: 'var(--gold)',
            letterSpacing: '0.05em',
            marginBottom: 16,
          }}
        >
          PAGE NOT FOUND
        </h1>
        <p
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontSize: 15,
            color: 'var(--gray)',
            marginBottom: 32,
            lineHeight: 1.6,
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist. Check the URL and try again.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-block',
            background: 'var(--gold)',
            color: '#0D1B2A',
            textDecoration: 'none',
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 16,
            letterSpacing: '0.05em',
            padding: '12px 24px',
            borderRadius: 2,
          }}
        >
          Back to Dashboard
        </Link>
      </div>
    </main>
  )
}
