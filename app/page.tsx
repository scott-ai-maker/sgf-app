import WaitlistForm from '@/components/WaitlistForm'
import Link from 'next/link'
import SiteHeader from '@/components/ui/SiteHeader'
import SiteFooter from '@/components/ui/SiteFooter'

const COACH_PORTRAIT_IMAGE = '/images/coach-portrait.jpg?v=0.1.4'

const PILLARS = [
  {
    image: '/images/feature-programming.jpg',
    title: 'Custom Programming',
    desc: 'Weekly training plans built around your goals, schedule, and equipment. No templates.',
  },
  {
    image: '/images/feature-tracking.jpg?v=0.1.5',
    title: 'Session Tracking',
    desc: 'Log every session, track progress, and see exactly how far you\'ve come.',
  },
  {
    image: '/images/feature-coaching.jpg?v=0.1.5',
    title: 'Direct Access',
    desc: 'Scheduled calls, form reviews, and direct messaging. Real coaching, not bots.',
  },
  {
    image: '/images/feature-scheduling.jpg',
    title: 'Easy Scheduling',
    desc: 'Book sessions, manage your package, and stay on track — all from one dashboard.',
  },
]

const HOME_STATS = [
  { num: '1:1', label: 'Personalized Coaching' },
  { num: '100%', label: 'Online & Flexible' },
  { num: '12+', label: 'Years of Experience' },
]

export default function Home() {
  return (
    <>
      {/* Gold top bar */}
      <div style={{ height: 3, background: 'linear-gradient(to right, var(--gold), transparent)' }} />

      <SiteHeader fixed badgeText="Online Coaching · Rolling Intake" />

      {/* Hero */}
      <section
        className="sgf-hero-bg home-hero"
        style={{
        position: 'relative', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '8rem 3rem 4rem',
      }}
      >
        <div className="home-hero-content fade-in-up" style={{ maxWidth: 900 }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '1.5rem' }}>
            Online Personal Training · Est. 2025
          </p>
          <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(4rem, 10vw, 8rem)', lineHeight: 0.95, letterSpacing: '0.02em' }}>
            Train<br />
            <span style={{ WebkitTextStroke: '1px var(--white)', color: 'transparent' }}>Smarter.</span><br />
            Move <span style={{ color: 'var(--gold)' }}>Forward.</span>
          </h1>
          <div style={{ width: 60, height: 2, background: 'var(--gold)', margin: '2rem 0' }} />
          <p style={{ fontSize: 'clamp(1rem, 2vw, 1.15rem)', lineHeight: 1.7, color: 'var(--gray)', maxWidth: 480, marginBottom: '2.5rem' }}>
            Online coaching built around you — personalized programming, real accountability, and a coach who&apos;s done the work himself. Spots are limited.
          </p>
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <Link
              href="/apply"
              className="sgf-button sgf-button-primary"
            >
              Apply for Coaching
            </Link>
            <a
              href="#waitlist-hero"
              className="sgf-button sgf-button-secondary"
            >
              Join Waitlist
            </a>
          </div>
          <WaitlistForm id="hero" />
          <p style={{ marginTop: '0.75rem', fontSize: '0.72rem', letterSpacing: '0.1em', color: 'var(--gray)' }}>
            No spam. No pressure. First to know when coaching opens.
          </p>
        </div>
      </section>

      {/* Stats */}
      <div className="home-stats" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'center' }}>
        {HOME_STATS.map((s, i) => (
          <div key={i} className="home-stat-item" style={{
            flex: 1, maxWidth: 280, padding: '3rem 2rem', textAlign: 'center',
            borderRight: i < HOME_STATS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}>
            <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '3rem', color: 'var(--gold)', lineHeight: 1 }}>{s.num}</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.68rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--gray)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pillars */}
      <section className="home-pillar-section fade-in-up" style={{ padding: '6rem 3rem', maxWidth: 1100, margin: '0 auto' }}>
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '1rem' }}>What&apos;s Included</p>
        <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1, marginBottom: '3.5rem' }}>
          Everything You Need.<br />Nothing You Don&apos;t.
        </h2>
        <div className="home-pillar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5px', background: 'rgba(255,255,255,0.06)' }}>
          {PILLARS.map((p, i) => (
            <div key={i} className="home-pillar-card" style={{ background: 'var(--navy)', padding: '2.5rem 2rem' }}>
              <div
                style={{
                  width: '100%',
                  height: 144,
                  marginBottom: '1.25rem',
                  border: '1px solid var(--navy-lt)',
                  backgroundImage: `linear-gradient(180deg, rgba(13,27,42,0.2), rgba(13,27,42,0.55)), url('${p.image}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.4rem', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>{p.title}</div>
              <div style={{ fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--gray)' }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Bio */}
      <div className="home-bio-section fade-in-up" style={{ background: 'var(--navy-mid)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '6rem 3rem' }}>
        <div className="home-bio-grid" style={{ maxWidth: 1020, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) 1fr', gap: '2.5rem', alignItems: 'center' }}>
          <div
            className="home-bio-photo"
            style={{
              minHeight: 460,
              backgroundImage: `linear-gradient(180deg, rgba(13,27,42,0.22), rgba(13,27,42,0.42)), url('${COACH_PORTRAIT_IMAGE}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '1px solid var(--navy-lt)',
            }}
          />
          <div>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '1.5rem' }}>Your Coach</p>
          <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '1.5rem', lineHeight: 1.1 }}>Scott Gordon</h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.85, color: 'var(--gray)', marginBottom: '1rem' }}>
            I&apos;m a <strong style={{ color: 'var(--white)', fontWeight: 600 }}>certified personal trainer</strong> with over a decade of experience helping people build real, sustainable fitness — from complete beginners to competitive athletes.
          </p>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.85, color: 'var(--gray)', marginBottom: '1rem' }}>
            I know what it takes to <strong style={{ color: 'var(--white)', fontWeight: 600 }}>rebuild from scratch</strong>. To show up when motivation fades. To train with intention and see results that stick.
          </p>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.85, color: 'var(--gray)' }}>
            Online coaching means <strong style={{ color: 'var(--white)', fontWeight: 600 }}>expert guidance without the commute</strong> — a program that fits your life, not the other way around.
          </p>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <section className="sgf-cta-bg home-cta-section" style={{ padding: '6rem 3rem', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', lineHeight: 1, marginBottom: '1rem' }}>
          Ready to <span style={{ color: 'var(--gold)' }}>Start?</span>
        </h2>
        <p style={{ color: 'var(--gray)', fontSize: '0.95rem', marginBottom: '1rem' }}>Apply now for best-fit coaching, or join the waitlist for launch updates.</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.65rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <Link
            href="/apply"
            className="sgf-button sgf-button-primary"
          >
            Apply for Coaching
          </Link>
          <a
            href="#waitlist-cta"
            className="sgf-button sgf-button-secondary"
          >
            Join Waitlist
          </a>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <WaitlistForm id="cta" />
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
    </>
  )
}
