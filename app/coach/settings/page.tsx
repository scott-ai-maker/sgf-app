import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import LogoutButton from '@/components/auth/LogoutButton'
import SiteHeader from '@/components/ui/SiteHeader'
import GeneralSettingsForm from '@/components/settings/GeneralSettingsForm'
import { createSignedFitnessPhotoUrl } from '@/lib/fitness-photos'

export const dynamic = 'force-dynamic'

interface CoachSettingsPageProps {
  searchParams: Promise<{ email_updated?: string | string[] | undefined }>
}

export default async function CoachSettingsPage({ searchParams }: CoachSettingsPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('clients')
    .select('email, full_name, phone, role, avatar_path')
    .eq('id', user.id)
    .maybeSingle()

  const avatarUrl = await createSignedFitnessPhotoUrl(supabase, profile?.avatar_path)

  const initialProfile = {
    email: profile?.email ?? user.email ?? '',
    fullName: profile?.full_name ?? '',
    phone: profile?.phone ?? '',
    role: profile?.role === 'coach' ? 'coach' : 'client',
    avatarUrl,
    pendingEmail: user.new_email ?? null,
  } as const

  const resolvedSearchParams = await searchParams
  const emailUpdated = (Array.isArray(resolvedSearchParams.email_updated)
    ? resolvedSearchParams.email_updated[0]
    : resolvedSearchParams.email_updated) === '1'

  return (
    <main style={{ minHeight: '100vh', background: 'var(--navy)' }}>
      <SiteHeader
        badgeText="Coach Console"
        links={[
          { href: '/coach', label: 'Coach Dashboard' },
          { href: '/coach#assigned-clients', label: 'Assigned Clients' },
          { href: '/coach/settings', label: 'Settings' },
        ]}
        actions={<LogoutButton />}
      />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        <h1
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 42,
            color: 'var(--white)',
            letterSpacing: '0.04em',
            marginBottom: 8,
          }}
        >
          GENERAL SETTINGS
        </h1>
        <p
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontWeight: 300,
            fontSize: 15,
            color: 'var(--gray)',
            marginBottom: 24,
          }}
        >
          Update your coach profile details used across the SGF coach console.
        </p>

        {emailUpdated && (
          <div
            style={{
              marginBottom: 24,
              border: '1px solid rgba(46, 204, 113, 0.45)',
              background: 'rgba(46, 204, 113, 0.08)',
              padding: '14px 16px',
              color: 'var(--success)',
              fontFamily: 'Raleway, sans-serif',
              fontSize: 14,
            }}
          >
            Email updated successfully. Your verified login email is now {initialProfile.email}.
          </div>
        )}

        <section style={{ border: '1px solid var(--navy-lt)', background: 'var(--navy-mid)', padding: 24 }}>
          <GeneralSettingsForm initialProfile={initialProfile} settingsPath="/coach/settings" />
        </section>
      </div>
    </main>
  )
}
