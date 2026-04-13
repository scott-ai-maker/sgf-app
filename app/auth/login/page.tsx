import AuthForm from '@/components/auth/AuthForm'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <main
      className="sgf-auth-bg"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div
          aria-hidden
          style={{
            width: 68,
            height: 68,
            margin: '0 auto 14px',
            borderRadius: 2,
            border: '1px solid var(--navy-lt)',
            backgroundImage: "url('/images/logo-mark-source.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <h1
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 36,
            color: 'var(--gold)',
            letterSpacing: '0.06em',
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          SCOTT GORDON FITNESS
        </h1>
        <p
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontSize: 14,
            color: 'var(--gray)',
            textAlign: 'center',
            marginBottom: 32,
          }}
        >
          Sign in to your account
        </p>
        <div
          style={{
            background: 'rgba(18, 35, 54, 0.9)',
            padding: 32,
            border: '1px solid var(--navy-lt)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <AuthForm mode="login" />
        </div>
      </div>
    </main>
  )
}
