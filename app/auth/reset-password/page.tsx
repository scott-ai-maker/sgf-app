import ResetPasswordForm from '@/components/auth/ResetPasswordForm'

export const dynamic = 'force-dynamic'

export default function ResetPasswordPage() {
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
          Reset your password
        </p>
        <div
          style={{
            background: 'var(--navy-mid)',
            padding: 32,
            border: '1px solid var(--navy-lt)',
          }}
        >
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  )
}
