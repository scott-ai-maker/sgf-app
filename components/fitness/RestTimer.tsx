'use client'

import { useState, useEffect, useRef } from 'react'

interface RestTimerProps {
  defaultSeconds?: number
  onDone?: () => void
}

export default function RestTimer({ defaultSeconds = 90, onDone }: RestTimerProps) {
  const [targetSeconds, setTargetSeconds] = useState(defaultSeconds)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  async function playDoneSound() {
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass()
      }

      const ctx = audioContextRef.current
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      const now = ctx.currentTime
      const playBeep = (frequency: number, startAt: number, duration: number) => {
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()

        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, startAt)

        gain.gain.setValueAtTime(0.0001, startAt)
        gain.gain.exponentialRampToValueAtTime(0.2, startAt + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

        oscillator.connect(gain)
        gain.connect(ctx.destination)

        oscillator.start(startAt)
        oscillator.stop(startAt + duration)
      }

      playBeep(880, now, 0.18)
      playBeep(1047, now + 0.24, 0.22)

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([60, 40, 90])
      }
    } catch {
      // Ignore audio failures (e.g., autoplay restrictions) and keep timer behavior intact.
    }
  }

  useEffect(() => {
    if (running && remaining !== null) {
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev === null || prev <= 1) {
            setRunning(false)
            onDone?.()
            void playDoneSound()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running, onDone])

  function start() {
    setRemaining(targetSeconds)
    setRunning(true)
  }

  function stop() {
    setRunning(false)
    setRemaining(null)
  }

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close()
      }
    }
  }, [])

  const mins = remaining !== null ? Math.floor(remaining / 60) : Math.floor(targetSeconds / 60)
  const secs = remaining !== null ? remaining % 60 : targetSeconds % 60
  const pct = remaining !== null ? remaining / targetSeconds : 1
  const done = remaining === 0

  const timerColor = done
    ? 'var(--success)'
    : remaining !== null && remaining < 15
      ? 'var(--error)'
      : 'var(--gold)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0' }}>
      <div
        style={{
          position: 'relative',
          width: 52,
          height: 52,
          flexShrink: 0,
        }}
      >
        <svg width={52} height={52} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={26} cy={26} r={22} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
          <circle
            cx={26}
            cy={26}
            r={22}
            fill="none"
            stroke={timerColor}
            strokeWidth={4}
            strokeDasharray={`${2 * Math.PI * 22}`}
            strokeDashoffset={`${2 * Math.PI * 22 * (1 - pct)}`}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: 13,
            color: timerColor,
          }}
        >
          {done ? '✓' : `${mins}:${String(secs).padStart(2, '0')}`}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--gray)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Rest Timer
        </p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!running && (
            <>
              <select
                value={targetSeconds}
                onChange={e => setTargetSeconds(Number(e.target.value))}
                style={{ padding: '3px 6px', background: 'var(--navy)', border: '1px solid var(--navy-lt)', color: 'var(--white)', fontSize: 12, fontFamily: 'Raleway, sans-serif' }}
              >
                {[30, 45, 60, 90, 120, 150, 180, 240, 300].map(s => (
                  <option key={s} value={s}>{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={start}
                style={{ padding: '3px 10px', background: 'var(--gold)', color: '#0D1B2A', border: 'none', fontFamily: 'Bebas Neue, sans-serif', fontSize: 13, cursor: 'pointer', letterSpacing: '0.06em' }}
              >
                Start
              </button>
            </>
          )}
          {running && (
            <button
              type="button"
              onClick={stop}
              style={{ padding: '3px 10px', background: 'transparent', color: 'var(--error)', border: '1px solid var(--error)', fontFamily: 'Bebas Neue, sans-serif', fontSize: 13, cursor: 'pointer' }}
            >
              Stop
            </button>
          )}
          {done && !running && (
            <button
              type="button"
              onClick={start}
              style={{ padding: '3px 10px', background: 'var(--gold)', color: '#0D1B2A', border: 'none', fontFamily: 'Bebas Neue, sans-serif', fontSize: 13, cursor: 'pointer', letterSpacing: '0.06em' }}
            >
              Restart
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
