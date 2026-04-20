export default function DashboardLoading() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--navy)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
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
          <div style={{ height: 20, background: 'var(--navy-mid)', width: '30%', borderRadius: 4, animation: 'pulse 2s infinite' }} />
        </div>

        {/* Workspace tabs skeleton */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                height: 80,
                background: 'var(--navy-mid)',
                borderRadius: 4,
                flex: 1,
                animation: 'pulse 2s infinite',
              }}
            />
          ))}
        </div>

        {/* Stats grid skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, marginBottom: 24 }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                height: 120,
                background: 'var(--navy-mid)',
                animation: 'pulse 2s infinite',
              }}
            />
          ))}
        </div>

        {/* Content skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                height: 150,
                background: 'var(--navy-mid)',
                borderRadius: 4,
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
