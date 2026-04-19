interface PipelineClient {
  id: string
  name: string
  email: string
  href: string
  hint: string
}

interface CoachClientPipelineProps {
  columns: Array<{
    key: string
    title: string
    tone: 'gold' | 'green' | 'gray' | 'red'
    clients: PipelineClient[]
  }>
}

const toneStyle = {
  gold: { border: 'rgba(212,160,23,0.28)', background: 'rgba(212,160,23,0.08)', color: 'var(--gold)' },
  green: { border: 'rgba(72,187,120,0.28)', background: 'rgba(72,187,120,0.08)', color: 'var(--success)' },
  gray: { border: 'rgba(138,153,170,0.24)', background: 'rgba(138,153,170,0.08)', color: 'var(--gray)' },
  red: { border: 'rgba(255,61,87,0.26)', background: 'rgba(255,61,87,0.08)', color: 'var(--error)' },
} as const

export default function CoachClientPipeline({ columns }: CoachClientPipelineProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
      {columns.map(column => {
        const tone = toneStyle[column.tone]

        return (
          <section key={column.key} style={{ border: `1px solid ${tone.border}`, background: tone.background, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.06em', fontSize: 24, color: tone.color }}>{column.title}</h2>
              <span style={{ color: tone.color, fontFamily: 'Bebas Neue, sans-serif', fontSize: 28 }}>{column.clients.length}</span>
            </div>

            {column.clients.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--gray)', fontSize: 13 }}>No clients in this stage.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {column.clients.map(client => (
                  <a key={client.id} href={client.href} style={{ textDecoration: 'none', border: '1px solid rgba(255,255,255,0.08)', background: 'var(--navy)', padding: 10 }}>
                    <div style={{ color: 'var(--white)', fontFamily: 'Raleway, sans-serif', fontWeight: 700, fontSize: 14 }}>{client.name}</div>
                    <div style={{ color: 'var(--gray)', fontFamily: 'Raleway, sans-serif', fontSize: 12, marginTop: 2, overflowWrap: 'anywhere' }}>{client.email}</div>
                    <div style={{ color: tone.color, fontFamily: 'Raleway, sans-serif', fontSize: 12, marginTop: 6 }}>{client.hint}</div>
                  </a>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}