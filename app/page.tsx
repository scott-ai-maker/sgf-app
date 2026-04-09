import WaitlistForm from '@/components/WaitlistForm'

export default function Home() {
  return (
    <>
      {/* Gold top bar */}
      <div style={{ height: 3, background: 'linear-gradient(to right, var(--gold), transparent)' }} />

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1.5rem 3rem',
        background: 'linear-gradient(to bottom, rgba(13,27,42,0.95), transparent)',
      }}>
        <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.4rem', letterSpacing: '0.15em' }}>
          Scott Gordon <span style={{ color: 'var(--gold)' }}>Fitness</span>
        </div>
        <div style={{
          fontSize: '0.65rem', letterSpacing: '0.25em', textTransform: 'uppercase',
          color: 'var(--gray)', border: '1px solid var(--navy-lt)', padding: '0.4rem 1rem', borderRadius: 2,
        }}>
          Online Coaching · Coming Soon
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        position: 'relative', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '8rem 3rem 4rem', maxWidth: 900,
      }}>
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
          Online coaching built around you — personalized programming, real accountability, and a coach who's done the work himself. Spots are limited.
        </p>
        <WaitlistForm id="hero" />
        <p style={{ marginTop: '0.75rem', fontSize: '0.72rem', letterSpacing: '0.1em', color: 'var(--gray)' }}>
          No spam. No pressure. First to know when coaching opens.
        </p>
      </section>

      {/* Stats */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'center' }}>
        {[
          { num: '1:1', label: 'Personalized Coaching' },
          { num: '100%', label: 'Online & Flexible' },
          { num: '12+', label: 'Years of Experience' },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, maxWidth: 280, padding: '3rem 2rem', textAlign: 'center',
            borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}>
            <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '3rem', color: 'var(--gold)', lineHeight: 1 }}>{s.num}</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.68rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--gray)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pillars */}
      <section style={{ padding: '6rem 3rem', maxWidth: 1100, margin: '0 auto' }}>
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '1rem' }}>What's Included</p>
        <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1, marginBottom: '3.5rem' }}>
          Everything You Need.<br />Nothing You Don't.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5px', background: 'rgba(255,255,255,0.06)' }}>
          {[
            { icon: '⚡', title: 'Custom Programming', desc: 'Weekly training plans built around your goals, schedule, and equipment. No templates.' },
            { icon: '📊', title: 'Session Tracking', desc: 'Log every session, track progress, and see exactly how far you\'ve come.' },
            { icon: '🎯', title: 'Direct Access', desc: 'Scheduled calls, form reviews, and direct messaging. Real coaching, not bots.' },
            { icon: '📅', title: 'Easy Scheduling', desc: 'Book sessions, manage your package, and stay on track — all from one dashboard.' },
          ].map((p, i) => (
            <div key={i} style={{ background: 'var(--navy)', padding: '2.5rem 2rem' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '1.25rem' }}>{p.icon}</div>
              <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.4rem', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>{p.title}</div>
              <div style={{ fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--gray)' }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Bio */}
      <div style={{ background: 'var(--navy-mid)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '6rem 3rem' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.4em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '1.5rem' }}>Your Coach</p>
          <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '1.5rem', lineHeight: 1.1 }}>Scott Gordon</h2>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.85, color: 'var(--gray)', marginBottom: '1rem' }}>
            I'm a <strong style={{ color: 'var(--white)', fontWeight: 600 }}>certified personal trainer</strong> with over a decade of experience helping people build real, sustainable fitness — from complete beginners to competitive athletes.
          </p>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.85, color: 'var(--gray)', marginBottom: '1rem' }}>
            I know what it takes to <strong style={{ color: 'var(--white)', fontWeight: 600 }}>rebuild from scratch</strong>. To show up when motivation fades. To train with intention and see results that stick.
          </p>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.85, color: 'var(--gray)' }}>
            Online coaching means <strong style={{ color: 'var(--white)', fontWeight: 600 }}>expert guidance without the commute</strong> — a program that fits your life, not the other way around.
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
      <section style={{ padding: '6rem 3rem', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 'clamp(2.5rem, 5vw, 4.5rem)', lineHeight: 1, marginBottom: '1rem' }}>
          Ready to <span style={{ color: 'var(--gold)' }}>Start?</span>
        </h2>
        <p style={{ color: 'var(--gray)', fontSize: '0.95rem', marginBottom: '2.5rem' }}>Join the waitlist. Spots are limited and filling fast.</p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <WaitlistForm id="cta" />
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '2rem 3rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem',
      }}>
        <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.1rem', letterSpacing: '0.15em', color: 'var(--gray)' }}>
          Scott Gordon <span style={{ color: 'var(--gold)' }}>Fitness</span>
        </div>
        <div style={{ fontSize: '0.7rem', letterSpacing: '0.1em', color: 'var(--gray)', opacity: 0.6 }}>
          © 2025 Scott Gordon Fitness · scottgordonfitness.com
        </div>
      </footer>
    </>
  )
}
