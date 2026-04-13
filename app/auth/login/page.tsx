import AuthForm from '@/components/auth/AuthForm'
import { Facebook, Instagram, Linkedin, Youtube } from 'lucide-react'

const SOCIAL_LINKS = [
  { name: 'Instagram', href: 'https://instagram.com/scottgordonfitness', Icon: Instagram },
  { name: 'YouTube', href: 'https://youtube.com/@scottgordonfitness', Icon: Youtube },
  { name: 'Facebook', href: 'https://facebook.com/scottgordonfitness', Icon: Facebook },
  { name: 'LinkedIn', href: 'https://linkedin.com/company/scottgordonfitness', Icon: Linkedin },
]

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
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.55rem', marginTop: '1rem' }}>
          {SOCIAL_LINKS.map(({ name, href, Icon }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={name}
              style={{
                width: 32,
                height: 32,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--navy-lt)',
                color: 'var(--gray)',
                background: 'rgba(13,27,42,0.55)',
              }}
            >
              <Icon size={15} strokeWidth={2} />
            </a>
          ))}
        </div>
      </div>
    </main>
  )
}
