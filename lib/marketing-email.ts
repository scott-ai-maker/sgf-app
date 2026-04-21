import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

type LeadSource = 'apply' | 'waitlist'

type LeadInput = {
  email: string
  firstName?: string | null
  source: LeadSource
  recommendedTier?: string | null
}

type WelcomeInput = {
  email: string
  firstName?: string | null
  coachReplyToEmail?: string | null
}

type PasswordResetInput = {
  email: string
  resetLink: string
}

type QueueRow = {
  id: string
  email: string
  first_name: string | null
  template_key: string
  source: string
}

const DAY_MS = 24 * 60 * 60 * 1000
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const sequenceTemplates = [
  {
    key: 'launch_day_1',
    subject: 'How online coaching with me works',
    body: (name: string, baseUrl: string) => ({
      text: [
        `Hi ${name},`,
        '',
        'Thanks for joining Scott Gordon Fitness.',
        '',
        'My coaching is built for people who want real progress without guessing:',
        '- custom training plan based on your schedule and equipment',
        '- clear progression each week',
        '- direct messaging support for questions and accountability',
        '',
        'The goal is simple: remove confusion and build momentum fast.',
        '',
        `Take the fit quiz: ${baseUrl}/apply`,
      ].join('\n'),
      html: `<p>Hi ${name},</p>
<p>Thanks for joining Scott Gordon Fitness.</p>
<p>My coaching is built for people who want real progress without guessing:</p>
<ul>
  <li>custom training plan based on your schedule and equipment</li>
  <li>clear progression each week</li>
  <li>direct messaging support for questions and accountability</li>
</ul>
<p>The goal is simple: remove confusion and build momentum fast.</p>
<p><a href="${baseUrl}/apply">Take the fit quiz</a></p>`,
    }),
  },
  {
    key: 'launch_day_2',
    subject: 'What changes when you stop winging it',
    body: (_name: string, baseUrl: string) => ({
      text: [
        'Most people do not fail because they are lazy. They fail because they are running without a system.',
        '',
        'Inside coaching, we focus on:',
        '- realistic weekly targets',
        '- a progression plan that adapts to your life',
        '- direct accountability so you do not drift',
        '',
        `See coaching options: ${baseUrl}/packages`,
      ].join('\n'),
      html: `<p>Most people do not fail because they are lazy. They fail because they are running without a system.</p>
<p>Inside coaching, we focus on:</p>
<ul>
  <li>realistic weekly targets</li>
  <li>a progression plan that adapts to your life</li>
  <li>direct accountability so you do not drift</li>
</ul>
<p><a href="${baseUrl}/packages">See coaching options</a></p>`,
    }),
  },
  {
    key: 'launch_day_3',
    subject: 'Founding client rates are open',
    body: (_name: string, baseUrl: string) => ({
      text: [
        'Founding client spots are now open for a limited number of members.',
        '',
        'Current options:',
        '- Program + Messaging',
        '- Hybrid Coaching (most popular)',
        '- Premium 1:1',
        '',
        'Founding rates are locked for 6 months once you join.',
        '',
        `Apply for coaching: ${baseUrl}/apply`,
      ].join('\n'),
      html: `<p>Founding client spots are now open for a limited number of members.</p>
<p>Current options:</p>
<ul>
  <li>Program + Messaging</li>
  <li>Hybrid Coaching (most popular)</li>
  <li>Premium 1:1</li>
</ul>
<p>Founding rates are locked for 6 months once you join.</p>
<p><a href="${baseUrl}/apply">Apply for coaching</a></p>`,
    }),
  },
  {
    key: 'launch_day_4',
    subject: 'Not sure if this is the right fit?',
    body: (_name: string, baseUrl: string) => ({
      text: [
        'This coaching is for you if:',
        '- you want structure and accountability',
        '- you are ready to train consistently',
        '- you want expert feedback without wasting time',
        '',
        'If you are unsure, take the fit quiz and I will point you to the best starting tier.',
        '',
        `Take the fit quiz: ${baseUrl}/apply`,
      ].join('\n'),
      html: `<p>This coaching is for you if:</p>
<ul>
  <li>you want structure and accountability</li>
  <li>you are ready to train consistently</li>
  <li>you want expert feedback without wasting time</li>
</ul>
<p>If you are unsure, take the fit quiz and I will point you to the best starting tier.</p>
<p><a href="${baseUrl}/apply">Take the fit quiz</a></p>`,
    }),
  },
  {
    key: 'launch_day_5',
    subject: 'Last call: founding spots close tonight',
    body: (_name: string, baseUrl: string) => ({
      text: [
        'Quick reminder: founding client pricing closes tonight.',
        '',
        'If you want coaching support this month, now is the best time to join.',
        '',
        `Apply for coaching: ${baseUrl}/apply`,
        `Join waitlist: ${baseUrl}/#waitlist-hero`,
      ].join('\n'),
      html: `<p>Quick reminder: founding client pricing closes tonight.</p>
<p>If you want coaching support this month, now is the best time to join.</p>
<p><a href="${baseUrl}/apply">Apply for coaching</a></p>
<p><a href="${baseUrl}/#waitlist-hero">Join waitlist</a></p>`,
    }),
  },
] as const

type TemplateKey = (typeof sequenceTemplates)[number]['key']

function getBaseUrl() {
  return (
    process.env.MARKETING_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://127.0.0.1:3000'
  )
}

function normalizeEmail(email: string) {
  return email.toLowerCase().trim()
}

function safeName(name?: string | null) {
  const trimmed = (name ?? '').trim()
  return trimmed.length > 0 ? trimmed : 'there'
}

function hasEmailConfig() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MARKETING_FROM_EMAIL)
}

export function getMissingEmailConfigKeys() {
  const missing: string[] = []
  if (!process.env.RESEND_API_KEY) missing.push('RESEND_API_KEY')
  if (!process.env.MARKETING_FROM_EMAIL) missing.push('MARKETING_FROM_EMAIL')
  return missing
}

async function sendEmail(params: {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}) {
  if (!hasEmailConfig()) return { skipped: true as const }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send({
    from: process.env.MARKETING_FROM_EMAIL!,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    replyTo: params.replyTo || process.env.MARKETING_REPLY_TO_EMAIL || undefined,
  })

  if (error) throw error
  return { skipped: false as const, id: data?.id ?? null }
}

export async function sendWelcomeEmail(input: WelcomeInput) {
  const email = normalizeEmail(input.email)
  if (!EMAIL_REGEX.test(email)) {
    throw new Error('Invalid welcome email address')
  }

  const name = safeName(input.firstName)
  const baseUrl = getBaseUrl()
  const replyTo = input.coachReplyToEmail?.trim() || process.env.MARKETING_REPLY_TO_EMAIL || undefined

  return sendEmail({
    to: email,
    subject: 'Welcome to Scott Gordon Fitness! Start here',
    html: `<h2>Welcome to Scott Gordon Fitness, ${name}!</h2>
<p>I&apos;m excited to work with you.</p>
<p>Here&apos;s the fastest way to get moving:</p>
<ol>
  <li><strong>Complete onboarding:</strong> tell me about your goals, schedule, and equipment.</li>
  <li><strong>Get your custom plan:</strong> I&apos;ll build training around your real situation.</li>
  <li><strong>Start logging:</strong> use your dashboard to message, train, and track progress.</li>
</ol>
<p><a href="${baseUrl}/dashboard/onboarding">Complete your onboarding</a></p>
<p>If you have questions, reply to this email or message me in the dashboard.</p>`,
    text: [
      `Welcome to Scott Gordon Fitness, ${name}!`,
      '',
      'I am excited to work with you.',
      '',
      'Here is the fastest way to get moving:',
      '1. Complete onboarding: tell me about your goals, schedule, and equipment.',
      '2. Get your custom plan: I will build training around your real situation.',
      '3. Start logging: use your dashboard to message, train, and track progress.',
      '',
      `Complete your onboarding: ${baseUrl}/dashboard/onboarding`,
      '',
      'If you have questions, reply to this email or message me in the dashboard.',
    ].join('\n'),
    replyTo,
  })
}

export async function sendPasswordResetEmail(input: PasswordResetInput) {
  const email = normalizeEmail(input.email)
  if (!EMAIL_REGEX.test(email)) {
    throw new Error('Invalid password reset email address')
  }

  if (!input.resetLink || !/^https?:\/\//.test(input.resetLink)) {
    throw new Error('Invalid password reset link')
  }

  return sendEmail({
    to: email,
    subject: 'Reset your Scott Gordon Fitness password',
    html: `<h2>Password reset request</h2>
<p>We received a request to reset your password.</p>
<p><a href="${input.resetLink}">Reset your password</a></p>
<p>If the button does not work, copy and paste this URL into your browser:</p>
<p>${input.resetLink}</p>
<p>This link expires in 24 hours.</p>
<p>If you did not request this, you can ignore this email.</p>`,
    text: [
      'Password reset request',
      '',
      'We received a request to reset your password.',
      '',
      `Reset your password: ${input.resetLink}`,
      '',
      'This link expires in 24 hours.',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
  })
}

export async function triggerLeadEmailAutomation(
  supabase: SupabaseClient,
  input: LeadInput
) {
  const email = normalizeEmail(input.email)
  if (!EMAIL_REGEX.test(email)) return

  const name = safeName(input.firstName)
  const baseUrl = getBaseUrl()

  try {
    const confirmation = {
      subject:
        input.source === 'apply'
          ? 'Application received - next steps'
          : 'You are on the SGF waitlist',
      text:
        input.source === 'apply'
          ? [
              `Hi ${name},`,
              '',
              'Thanks for applying for coaching with Scott Gordon Fitness.',
              `Recommended starting tier: ${input.recommendedTier ?? 'program_messaging'}.`,
              'You will receive next steps soon.',
              '',
              `In the meantime, review options: ${baseUrl}/packages`,
            ].join('\n')
          : [
              `Hi ${name},`,
              '',
              'You are officially on the Scott Gordon Fitness waitlist.',
              'We will email you first when new coaching spots open.',
              '',
              `Take the fit quiz any time: ${baseUrl}/apply`,
            ].join('\n'),
      html:
        input.source === 'apply'
          ? `<p>Hi ${name},</p>
<p>Thanks for applying for coaching with Scott Gordon Fitness.</p>
<p>Recommended starting tier: <strong>${input.recommendedTier ?? 'program_messaging'}</strong>.</p>
<p>You will receive next steps soon.</p>
<p><a href="${baseUrl}/packages">Review options</a></p>`
          : `<p>Hi ${name},</p>
<p>You are officially on the Scott Gordon Fitness waitlist.</p>
<p>We will email you first when new coaching spots open.</p>
<p><a href="${baseUrl}/apply">Take the fit quiz</a></p>`,
    }

    await sendEmail({
      to: email,
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
    })
  } catch (err) {
    console.error('Lead confirmation email failed:', err)
  }

  try {
    const internalTo = process.env.MARKETING_INTERNAL_NOTIFY_EMAIL
    if (internalTo) {
      await sendEmail({
        to: internalTo,
        subject: `[SGF] New ${input.source === 'apply' ? 'application' : 'waitlist lead'}: ${email}`,
        text: [
          `Source: ${input.source}`,
          `Email: ${email}`,
          `Name: ${safeName(input.firstName)}`,
          `Recommended tier: ${input.recommendedTier ?? 'n/a'}`,
          `Captured at: ${new Date().toISOString()}`,
        ].join('\n'),
        html: `<p><strong>Source:</strong> ${input.source}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Name:</strong> ${safeName(input.firstName)}</p>
<p><strong>Recommended tier:</strong> ${input.recommendedTier ?? 'n/a'}</p>
<p><strong>Captured at:</strong> ${new Date().toISOString()}</p>`,
      })
    }
  } catch (err) {
    console.error('Internal notify email failed:', err)
  }

  try {
    const sequenceEnabled = process.env.MARKETING_SEQUENCE_ENABLED !== '0'
    if (sequenceEnabled) {
      const now = Date.now()
      const queueRows = sequenceTemplates.map((template, index) => ({
        email,
        first_name: input.firstName?.trim() || null,
        template_key: template.key,
        source: `launch_sequence_${input.source}`,
        send_after: new Date(now + index * DAY_MS).toISOString(),
      }))

      const { error } = await supabase
        .from('marketing_email_queue')
        .upsert(queueRows, { onConflict: 'email,template_key', ignoreDuplicates: true })

      if (error) throw error
    }
  } catch (err) {
    console.error('Sequence queue insert failed:', err)
  }
}

export async function dispatchPendingSequenceEmails(
  supabase: SupabaseClient,
  limit = 25
) {
  const { data, error } = await supabase
    .from('marketing_email_queue')
    .select('id,email,first_name,template_key,source')
    .eq('status', 'pending')
    .lte('send_after', new Date().toISOString())
    .order('send_after', { ascending: true })
    .limit(limit)

  if (error) throw error

  const rows = (data ?? []) as QueueRow[]
  let sent = 0
  let failed = 0

  for (const row of rows) {
    const template = sequenceTemplates.find(t => t.key === row.template_key)
    if (!template) {
      failed += 1
      await supabase
        .from('marketing_email_queue')
        .update({ status: 'failed', attempts: 1, last_error: `Unknown template: ${row.template_key}` })
        .eq('id', row.id)
      continue
    }

    try {
      const payload = template.body(safeName(row.first_name), getBaseUrl())
      const sendResult = await sendEmail({
        to: row.email,
        subject: template.subject,
        html: payload.html,
        text: payload.text,
      })

      await supabase
        .from('marketing_email_queue')
        .update({
          status: 'sent',
          attempts: 1,
          provider_message_id: sendResult.skipped ? null : sendResult.id,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', row.id)

      sent += 1
    } catch (err) {
      failed += 1
      await supabase
        .from('marketing_email_queue')
        .update({
          status: 'failed',
          attempts: 1,
          last_error: err instanceof Error ? err.message : 'Unknown email error',
        })
        .eq('id', row.id)
    }
  }

  return {
    processed: rows.length,
    sent,
    failed,
  }
}
