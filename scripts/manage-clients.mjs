#!/usr/bin/env node

/**
 * Client Management Script
 * - Removes smoketest clients
 * - Adds new real clients
 * - Sends welcome emails
 *
 * Usage:
 * node --env-file=.env.local scripts/manage-clients.mjs [command] [options]
 *
 * Commands:
 *   clean              Remove all smoketest clients
 *   add-clients        Add Scott Gordon (coach) and Lisa Gordon (client)
 *   send-welcomes      Send welcome emails to one client email or default client accounts
 *   all                Execute: clean → add-clients → send-welcomes
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import process from 'node:process'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function createAdminClient() {
  return createSupabaseClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const SMOKETEST_ACCOUNTS = [
  { email: '5c077.60rd0n@gmail.com', name: 'Test Coach' },
  { email: 'da_mona_lisa@msn.com', name: 'Test Lisa' },
  { email: 'connor.gordon2002@gmail.com', name: 'Test Connor' },
]

const NEW_ACCOUNTS = [
  {
    email: 'scott.gordon72@outlook.com',
    name: 'Scott Gordon',
    role: 'coach',
    password: process.env.SCOTT_COACH_PASSWORD || process.env.TEMP_CLIENT_PASSWORD || 'Temp1234!',
  },
  {
    email: 'da_mona_lisa@msn.com',
    name: 'Lisa Gordon',
    role: 'client',
    password: process.env.LISA_CLIENT_PASSWORD || process.env.TEMP_CLIENT_PASSWORD || 'Temp1234!',
  },
]

async function cleanSmokeclients(admin) {
  console.log('\n🧹 Cleaning smoketest clients...')

  for (const account of SMOKETEST_ACCOUNTS) {
    try {
      // Find user in auth.users
      const { data: users, error: fetchError } = await admin.auth.admin.listUsers()
      if (fetchError) {
        console.warn(
          `⚠️ Could not fetch auth users: ${fetchError.message}`
        )
        continue
      }

      const user = users.users.find((u) => u.email === account.email)
      if (!user) {
        console.log(`ℹ️ Auth user not found: ${account.email}`)
        continue
      }

      // Delete auth user (which cascades to clients table via on delete cascade)
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
      if (deleteError) {
        console.error(`❌ Failed to delete ${account.email}: ${deleteError.message}`)
      } else {
        console.log(`✅ Deleted: ${account.email}`)
      }
    } catch (err) {
      console.error(`❌ Error cleaning ${account.email}:`, err.message)
    }
  }
}

async function addNewClients(admin) {
  console.log('\n👥 Adding new clients...')
  const tempPassword = process.env.TEMP_CLIENT_PASSWORD || 'Temp1234!'

  for (const account of NEW_ACCOUNTS) {
    try {
      // Create auth user
      const { data: authUser, error: signUpError } = await admin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: {
          must_reset_password: true,
        },
      })

      if (signUpError) {
        console.error(`❌ Failed to create auth user ${account.email}: ${signUpError.message}`)
        continue
      }

      // Create client record
      const { error: clientError } = await admin
        .from('clients')
        .insert({
          id: authUser.user.id,
          email: account.email,
          full_name: account.name,
          role: account.role,
          designated_coach_id: account.role === 'client' ? null : undefined,
        })

      if (clientError) {
        console.error(`❌ Failed to create client record ${account.email}: ${clientError.message}`)
        // Cleanup: delete the auth user we just created
        await admin.auth.admin.deleteUser(authUser.user.id)
        continue
      }

      console.log(`✅ Created ${account.role}: ${account.email} (ID: ${authUser.user.id})`)
      console.log(`   Temporary password: ${account.password === tempPassword ? tempPassword : '[custom env password]'}`)
      console.log('   Reset required on first access: yes')
    } catch (err) {
      console.error(`❌ Error adding ${account.email}:`, err.message)
    }
  }
}

async function sendWelcomeEmails(admin) {
  console.log('\n📧 Sending welcome emails...')

  if (!process.env.RESEND_API_KEY || !process.env.MARKETING_FROM_EMAIL) {
    console.warn(
      '⚠️ Email not configured. Set RESEND_API_KEY and MARKETING_FROM_EMAIL to send emails.'
    )
    return
  }

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  const baseUrl = process.env.MARKETING_BASE_URL || 'http://127.0.0.1:3000'

  const requestedEmail = process.argv[3]?.trim().toLowerCase() || null
  const defaultClientEmails = NEW_ACCOUNTS.filter(account => account.role === 'client').map(account => account.email)

  let query = admin
    .from('clients')
    .select('email, full_name, role')
    .eq('role', 'client')

  if (requestedEmail) {
    query = query.eq('email', requestedEmail)
  } else {
    query = query.in('email', defaultClientEmails)
  }

  const { data: recipients, error: recipientsError } = await query

  if (recipientsError) {
    console.error(`❌ Failed to load welcome email recipients: ${recipientsError.message}`)
    return
  }

  if (!recipients || recipients.length === 0) {
    console.log(requestedEmail ? `ℹ️ No client found for ${requestedEmail}` : 'ℹ️ No client recipients found')
    return
  }

  for (const recipient of recipients) {
    const firstName = String(recipient.full_name ?? '').trim() || 'there'
    const welcomeEmail = {
      subject: 'Welcome to Scott Gordon Fitness! Start here',
      html: `<h2>Welcome to Scott Gordon Fitness, ${firstName}!</h2>
<p>I&apos;m excited to work with you.</p>
<p>Here&apos;s the fastest way to get moving:</p>
<ol>
  <li><strong>Complete onboarding:</strong> tell me about your goals, equipment, and schedule.</li>
  <li><strong>Get your custom plan:</strong> I&apos;ll build training around your real situation.</li>
  <li><strong>Start logging:</strong> use your dashboard to message, train, and track progress.</li>
</ol>
<p><a href="${baseUrl}/dashboard/onboarding">Complete your onboarding</a></p>
<p>If you have questions, reply to this email or message me in the dashboard.</p>`,
      text: [
        `Welcome to Scott Gordon Fitness, ${firstName}!`,
        '',
        'I am excited to work with you.',
        '',
        'Here is the fastest way to get moving:',
        '1. Complete onboarding: tell me about your goals, equipment, and schedule.',
        '2. Get your custom plan: I will build training around your real situation.',
        '3. Start logging: use your dashboard to message, train, and track progress.',
        '',
        `Complete your onboarding: ${baseUrl}/dashboard/onboarding`,
        '',
        'If you have questions, reply to this email or message me in the dashboard.',
      ].join('\n'),
    }

    try {
      const { data, error } = await resend.emails.send({
        from: process.env.MARKETING_FROM_EMAIL,
        to: recipient.email,
        subject: welcomeEmail.subject,
        html: welcomeEmail.html,
        text: welcomeEmail.text,
        replyTo: process.env.MARKETING_REPLY_TO_EMAIL || 'scott.gordon72@outlook.com',
      })

      if (error) {
        console.error(`❌ Failed to send welcome email to ${recipient.email}: ${error.message}`)
        continue
      }

      console.log(`✅ Welcome email sent to ${recipient.email} (ID: ${data.id})`)
    } catch (err) {
      console.error(`❌ Error sending welcome email to ${recipient.email}:`, err.message)
    }
  }
}

async function showStatus(admin) {
  console.log('\n📊 Current clients in database:')

  const { data: clients, error } = await admin
    .from('clients')
    .select('id, email, full_name, role, created_at, designated_coach_id')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Failed to fetch clients:', error.message)
    return
  }

  if (!clients || clients.length === 0) {
    console.log('  (no clients)')
    return
  }

  for (const client of clients) {
    const roleLabel = client.role === 'coach' ? '🏋️ Coach' : '👤 Client'
    const assignedLabel = client.designated_coach_id ? ` → Coach: ${client.designated_coach_id}` : ''
    console.log(`  ${roleLabel} | ${client.full_name || '(unnamed)'} | ${client.email}${assignedLabel}`)
  }
}

async function main() {
  const command = process.argv[2] || 'all'
  const admin = createAdminClient()

  console.log('🚀 SGF Client Management\n')

  try {
    if (['clean', 'all'].includes(command)) {
      await cleanSmokeclients(admin)
    }

    if (['add-clients', 'all'].includes(command)) {
      await addNewClients(admin)
    }

    if (['send-welcomes', 'all'].includes(command)) {
      await sendWelcomeEmails(admin)
    }

    if (['status'].includes(command)) {
      await showStatus(admin)
    }

    await showStatus(admin)
  } catch (err) {
    console.error('\n❌ Fatal error:', err.message)
    process.exit(1)
  }

  console.log('\n✅ Done!\n')
}

main()
