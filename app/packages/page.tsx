import { PACKAGES } from '@/lib/stripe'
import PurchaseButton from '@/components/packages/PurchaseButton'
import Link from 'next/link'
import { Camera, CirclePlay, Users, BriefcaseBusiness } from 'lucide-react'

const PACKAGE_IMAGES: Record<string, string> = {
  starter: '/images/package-starter.jpg',
  momentum: '/images/package-momentum.jpg',
  transformation: '/images/package-transformation.jpg',
}

const BRAND_LOGO = '/images/logo-mark-source.jpg'

const SOCIAL_LINKS = [
  { name: 'Instagram', href: 'https://instagram.com/scottgordonfitness', Icon: Camera },
  { name: 'YouTube', href: 'https://youtube.com/@scottgordonfitness', Icon: CirclePlay },
  { name: 'Facebook', href: 'https://facebook.com/scottgordonfitness', Icon: Users },
  { name: 'LinkedIn', href: 'https://linkedin.com/company/scottgordonfitness', Icon: BriefcaseBusiness },
]

export default function PackagesPage() {
  return (
    <main className="packages-page" style={{ minHeight: '100vh', background: 'var(--navy)' }}>
      {/* Nav */}
      <nav
        className="packages-nav"
        style={{
          borderBottom: '1px solid var(--navy-lt)',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
          }}
        >
          <div
            aria-hidden
            style={{
              width: 32,
              height: 32,
              borderRadius: 2,
              border: '1px solid var(--navy-lt)',
              backgroundImage: `url('${BRAND_LOGO}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 22, color: 'var(--gold)', letterSpacing: '0.06em' }}>SGF</span>
        </Link>
        <div className="packages-nav-links" style={{ display: 'flex', gap: 20 }}>
          <Link
            href="/dashboard"
            style={{
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--gray)',
              textDecoration: 'none',
            }}
          >
            Dashboard
          </Link>
          <Link
            href="/auth/login"
            style={{
              fontFamily: 'Raleway, sans-serif',
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--gray)',
              textDecoration: 'none',
            }}
          >
            Sign In
          </Link>
        </div>
      </nav>

      <div className="packages-content" style={{ maxWidth: 1000, margin: '0 auto', padding: '60px 24px' }}>
        <h1
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 52,
            color: 'var(--white)',
            letterSpacing: '0.04em',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          COACHING PACKAGES
        </h1>
        <p
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontWeight: 300,
            fontSize: 16,
            color: 'var(--gray)',
            textAlign: 'center',
            marginBottom: 56,
          }}
        >
          Choose the package that&apos;s right for your goals.
        </p>

        <div
          className="packages-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1,
            background: 'rgba(255,255,255,0.06)',
          }}
        >
          {PACKAGES.map(pkg => (
            <div
              key={pkg.id}
              className="packages-card"
              style={{
                background: 'var(--navy-mid)',
                padding: '36px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
                border: pkg.popular ? '2px solid var(--gold)' : undefined,
                position: 'relative',
              }}
            >
              <div
                style={{
                  height: 140,
                  margin: '-36px -28px 0',
                  borderBottom: '1px solid var(--navy-lt)',
                  backgroundImage: `linear-gradient(180deg, rgba(13,27,42,0.2), rgba(13,27,42,0.6)), url('${PACKAGE_IMAGES[pkg.id] ?? '/images/package-starter.jpg'}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />

              {pkg.popular && (
                <div
                  style={{
                    position: 'absolute',
                    top: -1,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--gold)',
                    color: '#0D1B2A',
                    fontFamily: 'Bebas Neue, sans-serif',
                    fontSize: 13,
                    letterSpacing: '0.1em',
                    padding: '3px 16px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  MOST POPULAR
                </div>
              )}

              <div>
                <h2
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    fontSize: 28,
                    color: 'var(--white)',
                    letterSpacing: '0.04em',
                    margin: 0,
                    marginBottom: 6,
                  }}
                >
                  {pkg.name}
                </h2>
                <p
                  style={{
                    fontFamily: 'Raleway, sans-serif',
                    fontWeight: 300,
                    fontSize: 14,
                    color: 'var(--gray)',
                    margin: 0,
                  }}
                >
                  {pkg.description}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    fontSize: 52,
                    color: 'var(--gold)',
                    lineHeight: 1,
                  }}
                >
                  ${pkg.price / 100}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontFamily: 'Bebas Neue, sans-serif',
                    fontSize: 32,
                    color: 'var(--white)',
                    lineHeight: 1,
                  }}
                >
                  {pkg.sessions}
                </span>
                <span
                  style={{
                    fontFamily: 'Raleway, sans-serif',
                    fontWeight: 300,
                    fontSize: 14,
                    color: 'var(--gray)',
                  }}
                >
                  one-hour sessions
                </span>
              </div>

              <PurchaseButton packageId={pkg.id} />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center', gap: '0.6rem' }}>
          {SOCIAL_LINKS.map(({ name, href, Icon }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={name}
              style={{
                width: 34,
                height: 34,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--navy-lt)',
                color: 'var(--gray)',
                background: 'rgba(13,27,42,0.55)',
              }}
            >
              <Icon size={16} strokeWidth={2} />
            </a>
          ))}
        </div>
      </div>
    </main>
  )
}
