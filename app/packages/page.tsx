import { PACKAGES } from '@/lib/stripe'
import PurchaseButton from '@/components/packages/PurchaseButton'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'
import MarketingLoginActions from '@/components/ui/MarketingLoginActions'

const PACKAGE_IMAGES: Record<string, string> = {
  starter: '/images/package-starter.jpg',
  momentum: '/images/package-momentum.jpg',
  transformation: '/images/package-transformation.jpg',
}

export default function PackagesPage() {
  return (
    <main className="packages-page" style={{ minHeight: '100vh', background: 'var(--navy)' }}>
      <SiteHeader
        links={[
          { href: '/apply', label: 'Fit Quiz' },
          { href: '/dashboard', label: 'Dashboard' },
        ]}
        actions={<MarketingLoginActions />}
      />

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

      </div>

      <SiteFooter />
    </main>
  )
}
