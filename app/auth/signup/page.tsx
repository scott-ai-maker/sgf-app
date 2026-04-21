import AuthForm from '@/components/auth/AuthForm'
import { Camera, CirclePlay, Users, BriefcaseBusiness } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase'

const SOCIAL_LINKS = [
  { name: 'Instagram', href: 'https://instagram.com/scottgordonfitness', Icon: Camera },
  { name: 'YouTube', href: 'https://youtube.com/@scottgordonfitness', Icon: CirclePlay },
  { name: 'Facebook', href: 'https://facebook.com/scottgordonfitness', Icon: Users },
  { name: 'LinkedIn', href: 'https://linkedin.com/company/scottgordonfitness', Icon: BriefcaseBusiness },
]

export const dynamic = 'force-dynamic'

type SignupPageSearchParams = Promise<{
  coach?: string | string[] | undefined
}>

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function SignupPage({ searchParams }: { searchParams: SignupPageSearchParams }) {
  const resolvedSearchParams = await searchParams
  const requestedCoachId = Array.isArray(resolvedSearchParams.coach)
    ? resolvedSearchParams.coach[0]
    : resolvedSearchParams.coach

  let inviteCoachId: string | undefined
  let inviteCoachName: string | undefined

  if (requestedCoachId && UUID_PATTERN.test(requestedCoachId)) {
    const { data: coach } = await supabaseAdmin()
      .from('clients')
      .select('id, full_name')
      .eq('id', requestedCoachId)
      .eq('role', 'coach')
      .maybeSingle()

    if (coach) {
      inviteCoachId = coach.id
      inviteCoachName = coach.full_name?.trim() || 'your coach'
    }
  }

  return (
    <main
      className="sgf-auth-bg"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div
          aria-hidden
          style={{
            width: 68,
            height: 68,
            margin: '0 auto 14px',
            borderRadius: 2,
            border: '1px solid var(--navy-lt)',
            backgroundImage: "url('/images/logo-mark-source.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <h1
          style={{
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 36,
            color: 'var(--gold)',
            letterSpacing: '0.06em',
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          SCOTT GORDON FITNESS
        </h1>
        <p
          style={{
            fontFamily: 'Raleway, sans-serif',
            fontSize: 14,
            color: 'var(--gray)',
            textAlign: 'center',
            marginBottom: 32,
          }}
        >
          Create your account to get started
        </p>
        {inviteCoachId ? (
          <p
            style={{
              fontFamily: 'Raleway, sans-serif',
              fontSize: 13,
              color: 'var(--gold-lt)',
              textAlign: 'center',
              marginTop: 0,
              marginBottom: 18,
            }}
          >
            You are signing up with {inviteCoachName}. Your account will be connected to that coach automatically.
          </p>
        ) : null}
        <div
          style={{
            background: 'rgba(18, 35, 54, 0.9)',
            padding: 32,
            border: '1px solid var(--navy-lt)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <AuthForm mode="signup" coachId={inviteCoachId} coachName={inviteCoachName} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.55rem', marginTop: '1rem' }}>
          {SOCIAL_LINKS.map(({ name, href, Icon }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={name}
              style={{
                width: 32,
                height: 32,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--navy-lt)',
                color: 'var(--gray)',
                background: 'rgba(13,27,42,0.55)',
              }}
            >
              <Icon size={15} strokeWidth={2} />
            </a>
          ))}
        </div>
      </div>
    </main>
  )
}
