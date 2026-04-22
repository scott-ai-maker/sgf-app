'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

type AppRole = 'client' | 'coach'

type GeneralSettingsProfile = {
  email: string
  fullName: string
  phone: string
  role: AppRole
  avatarUrl: string | null
  pendingEmail: string | null
}

type GeneralSettingsFormProps = {
  initialProfile: GeneralSettingsProfile
  settingsPath: string
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'Raleway, sans-serif',
  fontWeight: 600,
  fontSize: 12,
  color: 'var(--gray)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'var(--navy)',
  border: '1px solid var(--navy-lt)',
  borderRadius: 2,
  color: 'var(--white)',
  fontFamily: 'Raleway, sans-serif',
  fontWeight: 300,
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.'
  if (!/[0-9]/.test(password)) return 'Password must include a number.'
  return null
}

export default function GeneralSettingsForm({ initialProfile, settingsPath }: GeneralSettingsFormProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [fullName, setFullName] = useState(initialProfile.fullName)
  const [phone, setPhone] = useState(initialProfile.phone)
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null)
  const [pendingEmail, setPendingEmail] = useState(initialProfile.pendingEmail)
  const [profileLoading, setProfileLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordNonce, setPasswordNonce] = useState('')
  const [passwordNeedsNonce, setPasswordNeedsNonce] = useState(false)

  const initials = (fullName || initialProfile.email || 'SG')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || 'SG'

  const displayAvatarUrl = avatarPreviewUrl ?? avatarUrl

  useEffect(() => {
    let active = true

    async function loadLatestAvatar() {
      const response = await fetch('/api/account/avatar')
      const payload = (await response.json().catch(() => null)) as { avatarUrl?: string | null } | null
      if (!active || !response.ok) return
      setAvatarUrl(payload?.avatarUrl ?? null)
    }

    void loadLatestAvatar()

    return () => {
      active = false
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl)
      }
    }
  }, [avatarPreviewUrl])

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileLoading(true)
    setProfileMessage(null)

    const response = await fetch('/api/account/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, phone }),
    })

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; profile?: GeneralSettingsProfile }
      | null

    if (!response.ok) {
      setProfileMessage(payload?.error ?? 'Unable to save your settings right now.')
      setProfileLoading(false)
      return
    }

    if (payload?.profile) {
      setFullName(payload.profile.fullName)
      setPhone(payload.profile.phone)
    }

    setProfileMessage('Profile details updated successfully.')
    setProfileLoading(false)
  }

  function clearAvatarSelection() {
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl)
    }
    setAvatarPreviewUrl(null)
    setSelectedAvatarFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleAvatarSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
    if (!allowedTypes.has(file.type)) {
      setAvatarMessage('Avatar must be PNG, JPEG, or WebP.')
      clearAvatarSelection()
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarMessage('Avatar must be 5MB or smaller.')
      clearAvatarSelection()
      return
    }

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl)
    }

    setAvatarMessage('Preview ready. Upload when you are happy with it.')
    setSelectedAvatarFile(file)
    setAvatarPreviewUrl(URL.createObjectURL(file))
  }

  async function handleAvatarUpload() {
    if (!selectedAvatarFile) return

    setAvatarLoading(true)
    setAvatarMessage(null)

    const formData = new FormData()
    formData.set('avatar', selectedAvatarFile)

    const response = await fetch('/api/account/avatar', {
      method: 'POST',
      body: formData,
    })

    const payload = (await response.json().catch(() => null)) as { error?: string; avatarUrl?: string | null } | null

    if (!response.ok) {
      setAvatarMessage(payload?.error ?? 'Unable to upload avatar.')
      setAvatarLoading(false)
      return
    }

    setAvatarUrl(payload?.avatarUrl ?? null)
    setAvatarMessage('Avatar updated successfully.')
    setAvatarLoading(false)
    clearAvatarSelection()
  }

  async function handleRemoveAvatar() {
    setAvatarLoading(true)
    setAvatarMessage(null)

    const response = await fetch('/api/account/avatar', {
      method: 'DELETE',
    })

    const payload = (await response.json().catch(() => null)) as { error?: string } | null

    if (!response.ok) {
      setAvatarMessage(payload?.error ?? 'Unable to remove avatar.')
      setAvatarLoading(false)
      return
    }

    setAvatarUrl(null)
    clearAvatarSelection()
    setAvatarMessage('Avatar removed.')
    setAvatarLoading(false)
  }

  async function handleEmailChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEmailLoading(true)
    setEmailError(null)
    setEmailMessage(null)

    const trimmedEmail = newEmail.trim().toLowerCase()
    if (!trimmedEmail) {
      setEmailError('Enter the new email address you want to use.')
      setEmailLoading(false)
      return
    }

    if (trimmedEmail === initialProfile.email.toLowerCase()) {
      setEmailError('Enter a different email address from your current one.')
      setEmailLoading(false)
      return
    }

    const callbackUrl = new URL('/auth/callback', window.location.origin)
    callbackUrl.searchParams.set('next', settingsPath)

    const { error } = await supabase.auth.updateUser(
      { email: trimmedEmail },
      { emailRedirectTo: callbackUrl.toString() }
    )

    if (error) {
      setEmailError(error.message)
      setEmailLoading(false)
      return
    }

    setPendingEmail(trimmedEmail)
    setEmailMessage('Verification sent. Your current email stays active until you confirm the new address.')
    setNewEmail('')
    setEmailLoading(false)
  }

  async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordLoading(true)
    setPasswordError(null)
    setPasswordMessage(null)

    const validationError = validatePassword(newPassword)
    if (validationError) {
      setPasswordError(validationError)
      setPasswordLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      setPasswordLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      ...(passwordNonce.trim() ? { nonce: passwordNonce.trim() } : {}),
    })

    if (error) {
      const message = error.message.toLowerCase()
      if (message.includes('reauth') || message.includes('nonce')) {
        setPasswordNeedsNonce(true)
        setPasswordError('Security verification is required. Send a verification code, then enter it below.')
      } else {
        setPasswordError(error.message)
      }
      setPasswordLoading(false)
      return
    }

    setPasswordMessage('Password updated successfully.')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordNonce('')
    setPasswordNeedsNonce(false)
    setPasswordLoading(false)
  }

  async function handleSendPasswordNonce() {
    setPasswordLoading(true)
    setPasswordError(null)
    setPasswordMessage(null)

    const { error } = await supabase.auth.reauthenticate()

    if (error) {
      setPasswordError(error.message)
      setPasswordLoading(false)
      return
    }

    setPasswordNeedsNonce(true)
    setPasswordMessage('Security code sent. Enter it below to finish changing your password.')
    setPasswordLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <section style={{ border: '1px solid var(--navy-lt)', padding: 20, background: 'rgba(13,27,42,0.35)' }}>
        <h2 style={{ margin: '0 0 16px', color: 'var(--white)', fontFamily: 'Bebas Neue, sans-serif', fontSize: 28, letterSpacing: '0.05em' }}>
          Profile
        </h2>
        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', maxWidth: 320, width: '100%', justifySelf: 'center' }}>
            <div
              aria-label="Account avatar"
              style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                border: '1px solid var(--navy-lt)',
                background: displayAvatarUrl
                  ? `center / cover no-repeat url(${JSON.stringify(displayAvatarUrl).slice(1, -1)})`
                  : 'linear-gradient(135deg, rgba(212,160,23,0.18), rgba(18,35,54,0.9))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--gold)',
                fontFamily: 'Bebas Neue, sans-serif',
                fontSize: 36,
                letterSpacing: '0.08em',
                overflow: 'hidden',
              }}
            >
              {!displayAvatarUrl ? initials : null}
            </div>
            {avatarPreviewUrl && (
              <p style={{ margin: 0, color: 'var(--gold)', fontSize: 12, textAlign: 'center' }}>
                Preview selected. Upload to save it.
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarSelection}
              disabled={avatarLoading}
              style={{ width: '100%', color: 'var(--gray)', fontSize: 12 }}
            />
            <button
              type="button"
              onClick={handleAvatarUpload}
              disabled={avatarLoading || !selectedAvatarFile}
              className="sgf-button sgf-button-primary"
              style={{ width: '100%', opacity: avatarLoading || !selectedAvatarFile ? 0.6 : 1 }}
            >
              {avatarLoading ? 'Uploading...' : 'Upload Avatar'}
            </button>
            <button
              type="button"
              onClick={clearAvatarSelection}
              disabled={avatarLoading || !selectedAvatarFile}
              className="sgf-button"
              style={{ width: '100%', opacity: avatarLoading || !selectedAvatarFile ? 0.6 : 1 }}
            >
              Clear Selection
            </button>
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={avatarLoading || !avatarUrl}
              className="sgf-button"
              style={{ width: '100%', opacity: avatarLoading || !avatarUrl ? 0.6 : 1 }}
            >
              {avatarLoading ? 'Working...' : 'Remove Avatar'}
            </button>
            <p style={{ margin: 0, color: 'var(--gray)', fontSize: 12, textAlign: 'center' }}>
              PNG, JPG, or WebP up to 5MB.
            </p>
            {avatarMessage && (
              <p
                style={{
                  margin: 0,
                  color:
                    avatarMessage.toLowerCase().includes('success') || avatarMessage.toLowerCase().includes('removed')
                      ? 'var(--success)'
                      : avatarMessage.toLowerCase().includes('preview')
                        ? 'var(--gold)'
                        : 'var(--error)',
                  fontSize: 12,
                  textAlign: 'center',
                }}
              >
                {avatarMessage}
              </p>
            )}
          </div>

          <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <div>
                <label htmlFor="settings-email" style={labelStyle}>
                  Email
                </label>
                <input
                  id="settings-email"
                  value={initialProfile.email}
                  disabled
                  readOnly
                  style={{ ...inputStyle, opacity: 0.75 }}
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="settings-role" style={labelStyle}>
                  Account Role
                </label>
                <input
                  id="settings-role"
                  value={initialProfile.role === 'coach' ? 'Coach' : 'Client'}
                  disabled
                  readOnly
                  style={{ ...inputStyle, opacity: 0.75 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <div>
                <label htmlFor="settings-full-name" style={labelStyle}>
                  Full Name
                </label>
                <input
                  id="settings-full-name"
                  type="text"
                  value={fullName}
                  onChange={event => setFullName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={100}
                  style={inputStyle}
                  autoComplete="name"
                />
              </div>

              <div>
                <label htmlFor="settings-phone" style={labelStyle}>
                  Phone
                </label>
                <input
                  id="settings-phone"
                  type="tel"
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                  maxLength={24}
                  style={inputStyle}
                  autoComplete="tel"
                  placeholder="Optional"
                />
              </div>
            </div>

            {profileMessage && (
              <p style={{ margin: 0, color: profileMessage.includes('success') ? 'var(--success)' : 'var(--error)', fontFamily: 'Raleway, sans-serif', fontSize: 13 }}>
                {profileMessage}
              </p>
            )}

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="submit"
                disabled={profileLoading}
                className="sgf-button sgf-button-primary"
                style={{ minWidth: 160, opacity: profileLoading ? 0.8 : 1 }}
              >
                {profileLoading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section style={{ border: '1px solid var(--navy-lt)', padding: 20, background: 'rgba(13,27,42,0.35)' }}>
        <h2 style={{ margin: '0 0 8px', color: 'var(--white)', fontFamily: 'Bebas Neue, sans-serif', fontSize: 28, letterSpacing: '0.05em' }}>
          Email Change
        </h2>
        <p style={{ margin: '0 0 16px', color: 'var(--gray)', fontSize: 13 }}>
          Your email only changes after you verify the confirmation link. Until then, your current email remains active.
        </p>
        {pendingEmail && (
          <p style={{ margin: '0 0 16px', color: 'var(--gold)', fontSize: 13 }}>
            Pending verification: {pendingEmail}. To replace it, submit a different email below.
          </p>
        )}
        <form onSubmit={handleEmailChange} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ maxWidth: 420 }}>
            <label htmlFor="settings-new-email" style={labelStyle}>
              New Email Address
            </label>
            <input
              id="settings-new-email"
              type="email"
              value={newEmail}
              onChange={event => setNewEmail(event.target.value)}
              style={inputStyle}
              autoComplete="email"
              placeholder="name@example.com"
            />
          </div>
          {emailError && <p style={{ margin: 0, color: 'var(--error)', fontSize: 13 }}>{emailError}</p>}
          {emailMessage && <p style={{ margin: 0, color: 'var(--success)', fontSize: 13 }}>{emailMessage}</p>}
          <div>
            <button type="submit" disabled={emailLoading} className="sgf-button sgf-button-primary" style={{ minWidth: 220, opacity: emailLoading ? 0.8 : 1 }}>
              {emailLoading ? 'Sending Verification...' : 'Send Email Change Verification'}
            </button>
          </div>
        </form>
      </section>

      <section style={{ border: '1px solid var(--navy-lt)', padding: 20, background: 'rgba(13,27,42,0.35)' }}>
        <h2 style={{ margin: '0 0 8px', color: 'var(--white)', fontFamily: 'Bebas Neue, sans-serif', fontSize: 28, letterSpacing: '0.05em' }}>
          Password
        </h2>
        <p style={{ margin: '0 0 16px', color: 'var(--gray)', fontSize: 13 }}>
          Change your password from your current signed-in session. If account security requires re-verification, send a one-time code first.
        </p>
        <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div>
              <label htmlFor="settings-new-password" style={labelStyle}>
                New Password
              </label>
              <input
                id="settings-new-password"
                type="password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                style={inputStyle}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label htmlFor="settings-confirm-password" style={labelStyle}>
                Confirm Password
              </label>
              <input
                id="settings-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                style={inputStyle}
                autoComplete="new-password"
              />
            </div>
          </div>

          {passwordNeedsNonce && (
            <div style={{ maxWidth: 320 }}>
              <label htmlFor="settings-password-nonce" style={labelStyle}>
                Security Code
              </label>
              <input
                id="settings-password-nonce"
                type="text"
                value={passwordNonce}
                onChange={event => setPasswordNonce(event.target.value)}
                style={inputStyle}
                autoComplete="one-time-code"
                placeholder="Enter the email code"
              />
            </div>
          )}

          {passwordError && <p style={{ margin: 0, color: 'var(--error)', fontSize: 13 }}>{passwordError}</p>}
          {passwordMessage && <p style={{ margin: 0, color: 'var(--success)', fontSize: 13 }}>{passwordMessage}</p>}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" disabled={passwordLoading} className="sgf-button sgf-button-primary" style={{ minWidth: 180, opacity: passwordLoading ? 0.8 : 1 }}>
              {passwordLoading ? 'Updating...' : 'Update Password'}
            </button>
            <button type="button" onClick={handleSendPasswordNonce} disabled={passwordLoading} className="sgf-button" style={{ minWidth: 210, opacity: passwordLoading ? 0.8 : 1 }}>
              Send Security Code
            </button>
            <a
              href="/auth/login"
              style={{ color: 'var(--gray)', textDecoration: 'none', fontFamily: 'Raleway, sans-serif', fontSize: 13 }}
            >
              For forgotten passwords, use Forgot Password from login.
            </a>
          </div>
        </form>
      </section>
    </div>
  )
}
