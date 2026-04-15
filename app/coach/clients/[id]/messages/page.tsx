import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import LogoutButton from '@/components/auth/LogoutButton'
import MessageThreadClient from '@/components/messages/MessageThreadClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CoachClientMessagesPage({ params }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { id } = await params

  const admin = supabaseAdmin()

  const { data: client } = await admin
    .from('clients')
    .select('id, full_name, email, designated_coach_id')
    .eq('id', id)
    .maybeSingle()

  if (!client || client.designated_coach_id !== user.id) {
    notFound()
  }

  return (
    <main className="coach-client-messages-page" style={{ minHeight: '100vh', background: 'var(--navy)' }}>
      <nav
        className="coach-client-messages-nav"
        style={{
          borderBottom: '1px solid var(--navy-lt)',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <a
          href={`/coach/clients/${id}`}
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 22,
            color: 'var(--gold)',
            letterSpacing: '0.06em',
            textDecoration: 'none',
          }}
        >
          SGF COACH
        </a>
        <LogoutButton />
      </nav>

      <div className="coach-client-messages-content" style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px' }}>
        <h1
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 38,
            color: 'var(--white)',
            letterSpacing: '0.04em',
            margin: '0 0 8px 0',
          }}
        >
          MESSAGE CLIENT
        </h1>
        <p style={{ fontFamily: 'Raleway, sans-serif', color: 'var(--gray)', margin: '0 0 20px 0' }}>
          {client.full_name || client.email}
        </p>

        <MessageThreadClient currentUserId={user.id} role="coach" clientId={id} />
      </div>
    </main>
  )
}
