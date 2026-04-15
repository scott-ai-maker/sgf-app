'use client'

import { useMemo, useState } from 'react'

type Choice = { value: string; label: string }

type Question = {
  key: string
  title: string
  description?: string
  choices: Choice[]
}

const QUESTIONS: Question[] = [
  {
    key: 'goal',
    title: 'What is your main goal right now?',
    choices: [
      { value: 'lose_body_fat', label: 'Lose body fat' },
      { value: 'build_muscle', label: 'Build muscle' },
      { value: 'improve_strength', label: 'Improve strength/performance' },
      { value: 'rebuild_consistency', label: 'Rebuild consistency' },
    ],
  },
  {
    key: 'timeline',
    title: 'How quickly do you want visible progress?',
    choices: [
      { value: 'asap', label: 'ASAP (0-30 days)' },
      { value: '1_to_3_months', label: '1-3 months' },
      { value: '3_to_6_months', label: '3-6 months' },
      { value: 'no_strict_timeline', label: 'No strict timeline' },
    ],
  },
  {
    key: 'trainingDays',
    title: 'How many days per week can you realistically train?',
    choices: [
      { value: '2', label: '2' },
      { value: '3', label: '3' },
      { value: '4', label: '4' },
      { value: '5_plus', label: '5+' },
    ],
  },
  {
    key: 'supportLevel',
    title: 'Which support level do you prefer?',
    choices: [
      { value: 'program_only', label: 'Program only + check-ins' },
      { value: 'program_and_messaging', label: 'Program + messaging access' },
      { value: 'hybrid_monthly_calls', label: 'Program + messaging + monthly calls' },
      { value: 'weekly_direct_calls', label: 'Weekly direct calls and hands-on coaching' },
    ],
  },
  {
    key: 'primaryObstacle',
    title: 'What usually stops your progress?',
    choices: [
      { value: 'no_clear_plan', label: 'No clear plan' },
      { value: 'inconsistent_accountability', label: 'Inconsistent accountability' },
      { value: 'nutrition_habits', label: 'Nutrition/lifestyle habits' },
      { value: 'technique_confidence', label: 'Technique/form confidence' },
    ],
  },
  {
    key: 'coachingHistory',
    title: 'Have you worked with a coach before?',
    choices: [
      { value: 'yes_worked', label: 'Yes, and it worked' },
      { value: 'yes_no_consistency', label: 'Yes, but I did not stay consistent' },
      { value: 'no_first_time', label: 'No, first time' },
    ],
  },
  {
    key: 'budgetBand',
    title: 'Monthly investment comfort for coaching?',
    choices: [
      { value: 'under_100', label: 'Under $100' },
      { value: '100_200', label: '$100-$200' },
      { value: '200_400', label: '$200-$400' },
      { value: '400_plus', label: '$400+' },
    ],
  },
  {
    key: 'readiness',
    title: 'How ready are you to start?',
    choices: [
      { value: 'this_week', label: 'This week' },
      { value: 'within_2_weeks', label: 'Within 2 weeks' },
      { value: 'within_30_days', label: 'Within 30 days' },
      { value: 'just_researching', label: 'Just researching' },
    ],
  },
]

type Answers = Record<string, string>

type Tier = 'program_messaging' | 'hybrid' | 'premium_1_1' | 'waitlist'

function recommendationFromAnswers(answers: Answers): Tier {
  if (answers.budgetBand === 'under_100' && answers.readiness === 'just_researching') return 'waitlist'

  if (answers.supportLevel === 'weekly_direct_calls' || answers.budgetBand === '400_plus') return 'premium_1_1'

  if (answers.supportLevel === 'hybrid_monthly_calls' || answers.budgetBand === '200_400') return 'hybrid'

  return 'program_messaging'
}

function recommendationLabel(tier: Tier) {
  if (tier === 'premium_1_1') return 'Premium 1:1'
  if (tier === 'hybrid') return 'Hybrid Coaching'
  if (tier === 'waitlist') return 'Join Waitlist'
  return 'Program + Messaging'
}

function recommendationCta(tier: Tier) {
  if (tier === 'premium_1_1') return { href: '/packages', label: 'Apply for Premium' }
  if (tier === 'hybrid') return { href: '/packages', label: 'Choose Hybrid' }
  if (tier === 'waitlist') return { href: '/#waitlist-hero', label: 'Join Waitlist' }
  return { href: '/packages', label: 'Start Program + Messaging' }
}

export default function ApplyQuiz() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const current = QUESTIONS[step]
  const isLastQuestion = step === QUESTIONS.length - 1
  const canAdvance = Boolean(current && answers[current.key])
  const recommendation = useMemo(() => recommendationFromAnswers(answers), [answers])

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const canSubmit = isEmailValid && submitState !== 'loading'

  async function submitApplication() {
    if (!canSubmit) return
    setSubmitState('loading')

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          firstName,
          goal: answers.goal,
          timeline: answers.timeline,
          trainingDays: answers.trainingDays,
          supportLevel: answers.supportLevel,
          primaryObstacle: answers.primaryObstacle,
          coachingHistory: answers.coachingHistory,
          budgetBand: answers.budgetBand,
          readiness: answers.readiness,
          recommendedTier: recommendation,
        }),
      })

      if (!res.ok) throw new Error('submit_failed')
      setSubmitState('success')
    } catch {
      setSubmitState('error')
    }
  }

  if (step >= QUESTIONS.length) {
    const tierLabel = recommendationLabel(recommendation)
    const cta = recommendationCta(recommendation)

    return (
      <section
        className="apply-quiz-card"
        style={{
          background: 'var(--navy-mid)',
          border: '1px solid var(--navy-lt)',
          padding: '2rem',
          maxWidth: 760,
          width: '100%',
        }}
      >
        <p style={{ fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10 }}>
          Recommended Tier
        </p>
        <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 44, lineHeight: 1, marginBottom: 12 }}>
          {tierLabel}
        </h2>
        <p style={{ color: 'var(--gray)', lineHeight: 1.7, marginBottom: 20 }}>
          Based on your goals, budget, and support preference, this is your highest-fit starting path.
        </p>

        <div className="apply-quiz-form-grid sgf-form-grid" style={{ marginBottom: 14 }}>
          <div>
            <label htmlFor="apply-first-name" className="sgf-form-label">
              First Name (Optional)
            </label>
            <input
              id="apply-first-name"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="Your name"
              className="sgf-form-input"
            />
          </div>
          <div>
            <label htmlFor="apply-email" className="sgf-form-label">
              Email
            </label>
            <input
              id="apply-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="sgf-form-input"
              style={{ borderColor: email.length > 0 && !isEmailValid ? 'var(--error)' : 'var(--navy-lt)' }}
            />
          </div>
        </div>

        {submitState === 'success' && (
          <p style={{ color: 'var(--success)', margin: '0 0 12px', fontSize: 14 }}>
            Submission received. Check your inbox for next steps.
          </p>
        )}
        {submitState === 'error' && (
          <p style={{ color: 'var(--error)', margin: '0 0 12px', fontSize: 14 }}>
            Could not submit right now. Please try again.
          </p>
        )}

        <div className="apply-quiz-actions" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={submitApplication}
            disabled={!canSubmit}
            style={{
              border: 'none',
              background: 'var(--gold)',
              color: 'var(--navy)',
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: 18,
              letterSpacing: '0.08em',
              padding: '12px 22px',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.6,
            }}
          >
            {submitState === 'loading' ? 'Submitting...' : 'Submit & Continue'}
          </button>
          <a
            href={cta.href}
            style={{
              border: '1px solid var(--navy-lt)',
              color: 'var(--white)',
              textDecoration: 'none',
              fontFamily: 'Raleway, sans-serif',
              fontSize: 14,
              padding: '12px 18px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {cta.label}
          </a>
          <button
            type="button"
            onClick={() => {
              setStep(0)
              setSubmitState('idle')
              setEmail('')
              setFirstName('')
            }}
            style={{
              border: '1px solid var(--navy-lt)',
              background: 'transparent',
              color: 'var(--gray)',
              fontFamily: 'Raleway, sans-serif',
              fontSize: 14,
              padding: '12px 18px',
              cursor: 'pointer',
            }}
          >
            Retake Quiz
          </button>
        </div>
      </section>
    )
  }

  return (
    <section
      className="apply-quiz-card"
      style={{
        background: 'var(--navy-mid)',
        border: '1px solid var(--navy-lt)',
        padding: '2rem',
        maxWidth: 760,
        width: '100%',
      }}
    >
      <p style={{ fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10 }}>
        Fit Quiz {step + 1}/{QUESTIONS.length}
      </p>
      <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 38, lineHeight: 1.1, marginBottom: 6 }}>{current.title}</h2>
      {current.description && <p style={{ color: 'var(--gray)', marginBottom: 12 }}>{current.description}</p>}

      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {current.choices.map(choice => {
          const selected = answers[current.key] === choice.value
          return (
            <button
              key={choice.value}
              type="button"
              onClick={() => {
                setAnswers(prev => ({ ...prev, [current.key]: choice.value }))
              }}
              style={{
                border: `1px solid ${selected ? 'var(--gold)' : 'var(--navy-lt)'}`,
                background: selected ? 'rgba(195, 159, 69, 0.12)' : 'var(--navy)',
                color: selected ? 'var(--white)' : 'var(--gray)',
                textAlign: 'left',
                padding: '12px 14px',
                cursor: 'pointer',
                fontFamily: 'Raleway, sans-serif',
                fontSize: 14,
              }}
            >
              {choice.label}
            </button>
          )
        })}
      </div>

      <div className="apply-quiz-nav" style={{ display: 'flex', gap: 12, marginTop: 18 }}>
        <button
          type="button"
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          style={{
            border: '1px solid var(--navy-lt)',
            background: 'transparent',
            color: 'var(--gray)',
            fontFamily: 'Raleway, sans-serif',
            fontSize: 14,
            padding: '10px 16px',
            cursor: step === 0 ? 'not-allowed' : 'pointer',
            opacity: step === 0 ? 0.5 : 1,
          }}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => setStep(s => s + 1)}
          disabled={!canAdvance}
          style={{
            border: 'none',
            background: 'var(--gold)',
            color: 'var(--navy)',
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 18,
            letterSpacing: '0.08em',
            padding: '10px 20px',
            cursor: canAdvance ? 'pointer' : 'not-allowed',
            opacity: canAdvance ? 1 : 0.6,
          }}
        >
          {isLastQuestion ? 'See Recommendation' : 'Next'}
        </button>
      </div>
    </section>
  )
}
