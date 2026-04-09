import AuthForm from '@/components/auth/AuthForm'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--navy)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
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
            background: 'var(--navy-mid)',
            padding: 32,
            border: '1px solid var(--navy-lt)',
          }}
        >
          <AuthForm mode="login" />
        </div>
      </div>
    </main>
  )
}
