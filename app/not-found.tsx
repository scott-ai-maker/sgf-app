import Link from 'next/link'

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--navy)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: '500px', textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '72px',
            color: 'var(--gold)',
            letterSpacing: '0.05em',
            marginBottom: '16px',
            lineHeight: '1',
          }}
        >
          404
        </h1>
        <h2
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '28px',
            color: 'var(--white)',
            letterSpacing: '0.04em',
            marginBottom: '16px',
          }}
        >
          Page Not Found
        </h2>
        <p
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontSize: '15px',
            color: 'var(--gray)',
            marginBottom: '32px',
            lineHeight: '1.6',
          }}
        >
          The page you're looking for doesn't exist or has been moved. Check the URL and try again.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            background: 'var(--gold)',
            color: '#0D1B2A',
            textDecoration: 'none',
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '16px',
            letterSpacing: '0.05em',
            padding: '12px 24px',
            borderRadius: '2px',
          }}
        >
          Back to Home
        </Link>
      </div>
    </main>
  )
}
