import Link from 'next/link'
import ApplyQuiz from '@/components/marketing/ApplyQuiz'

export default function ApplyPage() {
  return (
    <main className="apply-page" style={{ minHeight: '100vh', background: 'var(--navy)', padding: '2rem 1rem 4rem' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div className="apply-top-links" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <Link
            href="/"
            style={{
              color: 'var(--gray)',
              textDecoration: 'none',
              border: '1px solid var(--navy-lt)',
              padding: '8px 12px',
              fontFamily: 'Raleway, sans-serif',
              fontSize: 13,
            }}
          >
            Back to Home
          </Link>
          <Link
            href="/packages"
            style={{
              color: 'var(--white)',
              textDecoration: 'none',
              border: '1px solid var(--navy-lt)',
              padding: '8px 12px',
              fontFamily: 'Raleway, sans-serif',
              fontSize: 13,
            }}
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
