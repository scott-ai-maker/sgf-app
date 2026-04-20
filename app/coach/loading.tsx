export default function CoachLoading() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--navy)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header skeleton */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              height: 50,
              background: 'var(--navy-mid)',
              marginBottom: 12,
              borderRadius: 4,
              animation: 'pulse 2s infinite',
            }}
          />
          <div style={{ height: 20, background: 'var(--navy-mid)', width: '25%', borderRadius: 4, animation: 'pulse 2s infinite' }} />
        </div>

        {/* Tab navigation skeleton */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              style={{
                height: 40,
                background: 'var(--navy-mid)',
                borderRadius: 4,
                width: 120,
                animation: 'pulse 2s infinite',
              }}
            />
          ))}
        </div>

        {/* Stats grid skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              style={{
                height: 100,
                background: 'var(--navy-mid)',
                borderRadius: 4,
                animation: 'pulse 2s infinite',
              }}
            />
          ))}
        </div>

        {/* Client rows skeleton */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              style={{
                height: 80,
                background: 'var(--navy-mid)',
                animation: 'pulse 2s infinite',
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </main>
  )
}
