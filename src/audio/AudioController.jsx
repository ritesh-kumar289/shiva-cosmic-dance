import { useEffect, useRef, useState } from 'react'
import { scrollStore } from '../scrollStore'

// ─────────────────────────────────────────────────────────────────────────────
//  AudioController
//  • Plays a looping background bed: Enigma — "The Child In Us" (mp3 in /public)
//  • Layers procedurally synthesized SFX over scene events (Om, bells, blast)
//  • Auto-arms on the first user gesture (browser autoplay policies)
//  • Exposes a top-right mute / unmute toggle
// ─────────────────────────────────────────────────────────────────────────────

const MUSIC_URL = '/audio/child-in-us.mp3'

export default function AudioController() {
  const [muted, setMuted] = useState(false)
  const [started, setStarted] = useState(false)
  const ctxRef = useRef(null)
  const masterRef = useRef(null)
  const musicRef = useRef(null)        // <audio> element
  const musicGainRef = useRef(null)    // GainNode the audio element flows through
  const stateRef = useRef({ lastBell: 0, blastDone: false, awakenDone: false, omPlayed: false, finalOmDone: false })

  // ── Lazy-build the audio graph on first user gesture ────────────────────
  const ensureStarted = () => {
    if (ctxRef.current) {
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
      const a = musicRef.current
      if (a && a.paused) a.play().catch(() => {})
      return ctxRef.current
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    const ctx = new Ctx()
    ctxRef.current = ctx

    // Master bus
    const master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.85
    masterRef.current = master
    master.connect(ctx.destination)

    // Background music routed through Web Audio
    const audioEl = new Audio(MUSIC_URL)
    audioEl.crossOrigin = 'anonymous'
    audioEl.loop = true
    audioEl.preload = 'auto'
    audioEl.volume = 1.0
    musicRef.current = audioEl

    const musicSrc = ctx.createMediaElementSource(audioEl)
    const musicGain = ctx.createGain()
    musicGain.gain.value = 0.65
    musicGainRef.current = musicGain

    const shelf = ctx.createBiquadFilter()
    shelf.type = 'lowshelf'
    shelf.frequency.value = 220
    shelf.gain.value = 1.5

    musicSrc.connect(shelf).connect(musicGain).connect(master)

    audioEl.play().catch(() => {})

    setStarted(true)
    return ctx
  }

  useEffect(() => {
    const m = masterRef.current
    if (!m || !ctxRef.current) return
    const t = ctxRef.current.currentTime
    m.gain.cancelScheduledValues(t)
    m.gain.linearRampToValueAtTime(muted ? 0 : 0.85, t + 0.4)
  }, [muted])

  useEffect(() => {
    const arm = () => { ensureStarted() }
    window.addEventListener('pointerdown', arm)
    window.addEventListener('keydown', arm)
    window.addEventListener('wheel', arm, { passive: true })
    window.addEventListener('touchstart', arm, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', arm)
      window.removeEventListener('keydown', arm)
      window.removeEventListener('wheel', arm)
      window.removeEventListener('touchstart', arm)
    }
  }, [])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const ctx = ctxRef.current
      if (!ctx || ctx.state !== 'running') return
      const p = scrollStore.progress
      const t = ctx.currentTime
      const s = stateRef.current

      // Music dynamics: slight swell during awakening + finale, dip during blast
      const blast = Math.max(0, Math.min(1, (p - 0.70) / 0.06)) * Math.max(0, 1 - (p - 0.78) / 0.06)
      const finale = Math.max(0, Math.min(1, (p - 0.80) / 0.10))
      const target = 0.55 + 0.10 * smooth(p, 0.1, 0.4) + 0.10 * finale - 0.30 * blast
      if (musicGainRef.current) {
        musicGainRef.current.gain.setTargetAtTime(Math.max(0.05, target), t, 0.6)
      }

      // Scene one-shot SFX
      if (p > 0.005 && !s.omPlayed) {
        playOm(ctx, masterRef.current, 0.45)
        s.omPlayed = true
      }
      if (p > 0.22 && !s.awakenDone) {
        playDamru(ctx, masterRef.current, 0.18)
        s.awakenDone = true
      }
      if (p > 0.44 && p < 0.62 && t - s.lastBell > 5.5) {
        playDamru(ctx, masterRef.current, 0.10)
        s.lastBell = t
      }
      if (p > 0.72 && p < 0.80 && !s.blastDone) {
        playBlast(ctx, masterRef.current)
        s.blastDone = true
      }
      if (p > 0.90 && !s.finalOmDone) {
        playOm(ctx, masterRef.current, 0.55)
        s.finalOmDone = true
      }

      // Reset latches on rewind
      if (p < 0.40) s.blastDone = false
      if (p < 0.20) s.awakenDone = false
      if (p < 0.85) s.finalOmDone = false
      if (p < 0.003) s.omPlayed = false
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <button
      data-ui="true"
      onClick={(e) => { e.stopPropagation(); ensureStarted(); setMuted(m => !m) }}
      className={`audio-toggle ${muted ? 'audio-toggle--muted' : 'audio-toggle--on'}`}
      aria-label={muted ? 'Unmute ambient music' : 'Mute ambient music'}
      title={muted ? 'Unmute' : 'Mute'}
    >
      <span className="audio-toggle__icon" aria-hidden="true">
        {muted ? (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H3v6h3l5 4V5z"/>
            <line x1="22" y1="9" x2="16" y2="15"/>
            <line x1="16" y1="9" x2="22" y2="15"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H3v6h3l5 4V5z"/>
            <path d="M15.5 8.5a5 5 0 0 1 0 7"/>
            <path d="M18.5 5.5a9 9 0 0 1 0 13"/>
          </svg>
        )}
      </span>
      <span className="audio-toggle__bars" aria-hidden="true">
        <span /><span /><span /><span />
      </span>
      <span className="audio-toggle__lbl">
        {started ? (muted ? 'MUTED' : 'PLAYING') : 'TAP'}
      </span>
    </button>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function smooth(x, a, b) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function makeNoiseBuffer(ctx, durationSec) {
  const len = Math.floor(ctx.sampleRate * durationSec)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function playOm(ctx, dest, amp = 0.5) {
  const t = ctx.currentTime
  const out = ctx.createGain()
  out.gain.setValueAtTime(0, t)
  out.gain.linearRampToValueAtTime(amp, t + 0.6)
  out.gain.linearRampToValueAtTime(amp * 0.7, t + 4.0)
  out.gain.linearRampToValueAtTime(0, t + 7.0)
  out.connect(dest)
  ;[110, 165, 220, 330].forEach((f, i) => {
    const o = ctx.createOscillator()
    o.type = i === 0 ? 'sine' : 'triangle'
    o.frequency.value = f
    const g = ctx.createGain()
    g.gain.value = i === 0 ? 0.55 : 0.18 / i
    o.connect(g).connect(out)
    o.start(t); o.stop(t + 7.2)
  })
}

function playBell(ctx, dest, freq = 880, amp = 0.35) {
  const t = ctx.currentTime
  const out = ctx.createGain()
  out.gain.setValueAtTime(0, t)
  out.gain.linearRampToValueAtTime(amp, t + 0.01)
  out.gain.exponentialRampToValueAtTime(0.0001, t + 2.5)
  out.connect(dest)
  ;[1, 2.7, 4.1, 5.4].forEach((mul, i) => {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq * mul
    const g = ctx.createGain()
    g.gain.value = 1 / (i + 1.5)
    o.connect(g).connect(out)
    o.start(t); o.stop(t + 2.6)
  })
}

function playDamru(ctx, dest, amp = 0.14) {
  // Damru = small two-headed drum: a quick rattling roll of short hits.
  const t0 = ctx.currentTime
  const out = ctx.createGain()
  out.gain.value = amp
  out.connect(dest)
  const hits = 7
  for (let i = 0; i < hits; i++) {
    // Accelerating then decelerating roll
    const u = i / (hits - 1)
    const spacing = 0.11 - 0.05 * Math.sin(u * Math.PI)
    const t = t0 + i * spacing
    const vel = 0.6 + 0.4 * Math.sin(u * Math.PI)
    // Body: short pitched thump (alternating high/low head)
    const o = ctx.createOscillator()
    o.type = 'sine'
    const baseF = i % 2 === 0 ? 220 : 160
    o.frequency.setValueAtTime(baseF * 1.6, t)
    o.frequency.exponentialRampToValueAtTime(baseF * 0.6, t + 0.09)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0, t)
    og.gain.linearRampToValueAtTime(0.55 * vel, t + 0.005)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.11)
    o.connect(og).connect(out)
    o.start(t); o.stop(t + 0.13)
    // Click: filtered noise burst for the leather snap
    const buf = makeNoiseBuffer(ctx, 0.06)
    const src = ctx.createBufferSource(); src.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.Q.value = 1.4
    bp.frequency.value = i % 2 === 0 ? 1800 : 1200
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0, t)
    ng.gain.linearRampToValueAtTime(0.35 * vel, t + 0.003)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    src.connect(bp).connect(ng).connect(out)
    src.start(t); src.stop(t + 0.07)
  }
}

function playBlast(ctx, dest) {
  const t = ctx.currentTime
  const out = ctx.createGain()
  out.gain.setValueAtTime(0, t)
  out.gain.linearRampToValueAtTime(0.85, t + 0.02)
  out.gain.exponentialRampToValueAtTime(0.0001, t + 3.0)
  out.connect(dest)

  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(120, t)
  o.frequency.exponentialRampToValueAtTime(28, t + 1.4)
  o.connect(out); o.start(t); o.stop(t + 3.1)

  const buf = makeNoiseBuffer(ctx, 3.2)
  const src = ctx.createBufferSource(); src.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'; bp.Q.value = 1.2
  bp.frequency.setValueAtTime(2400, t)
  bp.frequency.exponentialRampToValueAtTime(180, t + 2.5)
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(0, t)
  ng.gain.linearRampToValueAtTime(0.45, t + 0.05)
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 2.8)
  src.connect(bp).connect(ng).connect(dest)
  src.start(t); src.stop(t + 3.0)
}
