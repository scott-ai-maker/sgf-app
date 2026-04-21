'use client'

import { useEffect, useState } from 'react'

function canAttemptPortraitLock() {
  return typeof window !== 'undefined' && typeof screen !== 'undefined' && 'orientation' in screen
}

function isLikelyPhone() {
  if (typeof window === 'undefined') return false

  const isNarrow = window.matchMedia('(max-width: 900px)').matches
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches
  return isNarrow && isCoarsePointer
}

function isLandscape() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(orientation: landscape)').matches
}

export default function MobilePortraitLock() {
  const [showLandscapeBlocker, setShowLandscapeBlocker] = useState(false)

  useEffect(() => {
    let mounted = true

    async function tryLockPortrait() {
      if (!canAttemptPortraitLock()) return

      try {
        const orientationApi = screen.orientation as ScreenOrientation & {
          lock?: (orientation: OrientationLockType) => Promise<void>
        }

        if (typeof orientationApi.lock === 'function') {
          await orientationApi.lock('portrait')
        }
      } catch {
        // Many browsers only allow locking in installed/fullscreen contexts.
      }
    }

    function updateBlockerState() {
      if (!mounted) return
      setShowLandscapeBlocker(isLikelyPhone() && isLandscape())
    }

    updateBlockerState()
    void tryLockPortrait()

    window.addEventListener('resize', updateBlockerState)
    window.addEventListener('orientationchange', updateBlockerState)

    return () => {
      mounted = false
      window.removeEventListener('resize', updateBlockerState)
      window.removeEventListener('orientationchange', updateBlockerState)
    }
  }, [])

  if (!showLandscapeBlocker) {
    return null
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(13, 27, 42, 0.98)',
        color: 'var(--white)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '24px',
      }}
    >
      <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
        <p style={{ margin: 0, fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.08em', fontSize: 24, color: 'var(--gold)' }}>
          Rotate To Portrait
        </p>
        <p style={{ margin: 0, fontFamily: 'Raleway, sans-serif', fontSize: 15, color: 'var(--gray)' }}>
          This app is optimized for portrait mode on phone.
        </p>
      </div>
    </div>
  )
}
