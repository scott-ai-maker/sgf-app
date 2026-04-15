import Link from 'next/link'
import ApplyQuiz from '@/components/marketing/ApplyQuiz'
import SiteHeader from '@/components/ui/SiteHeader'

export default function ApplyPage() {
  return (
    <main className="apply-page" style={{ minHeight: '100vh', background: 'var(--navy)', padding: '2rem 1rem 4rem' }}>
      <SiteHeader
        links={[
          { href: '/packages', label: 'Packages' },
          { href: '/auth/login', label: 'Sign In' },
        ]}
      />
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div className="apply-top-links" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <Link
            href="/"
            className="sgf-button sgf-button-secondary"
          >
            Back to Home
          </Link>
          <Link
            href="/packages"
            className="sgf-button sgf-button-secondary"
          >
            View Packages
          </Link>
        </div>

        <p style={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
          Scott Gordon Fitness
        </p>
        <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(2.8rem, 8vw, 5rem)', lineHeight: 0.95, marginBottom: 10 }}>
          Find Your Best Coaching
          <br />
          Starting Tier
        </h1>
        <p style={{ color: 'var(--gray)', fontSize: 16, lineHeight: 1.75, marginBottom: 28, maxWidth: 720 }}>
          Take this 2-minute fit quiz and get matched to the coaching offer that best fits your goals, budget, and preferred support level.
        </p>

        <ApplyQuiz />
      </div>
    </main>
  )
}
