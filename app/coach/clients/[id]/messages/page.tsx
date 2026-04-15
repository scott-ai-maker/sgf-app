import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import LogoutButton from '@/components/auth/LogoutButton'
import MessageThreadClient from '@/components/messages/MessageThreadClient'
import SiteHeader from '@/components/ui/SiteHeader'

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
      <SiteHeader
        badgeText="Coach Messaging"
        links={[
          { href: '/coach', label: 'Coach Dashboard' },
          { href: `/coach/clients/${id}`, label: 'Client Details' },
        ]}
        actions={<LogoutButton />}
      />

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
