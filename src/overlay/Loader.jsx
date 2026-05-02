import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'

// Bigger, ornate trishul (Shiva's trident) inline SVG. Slides L→R as assets load.
function TrishulIcon({ size = 56 }) {
  return (
    <svg
      viewBox="0 0 64 96"
      width={size}
      height={size * 1.5}
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 0 14px rgba(120, 170, 255, 0.85))' }}
    >
      {/* Three prongs */}
      <path
        d="M32 6 L36 22 L42 24 L40 14 L48 22 L46 30 L34 30 L32 38 L30 30 L18 30 L16 22 L24 14 L22 24 L28 22 Z"
        fill="url(#trishul-grad)"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      {/* Crossbar */}
      <rect x="14" y="32" width="36" height="2.6" rx="1" fill="url(#trishul-grad)" />
      {/* Staff */}
      <rect x="30.5" y="34" width="3" height="44" rx="0.8" fill="url(#trishul-grad)" />
      {/* Damru-like wrap */}
      <ellipse cx="32" cy="58" rx="4.5" ry="2" fill="rgba(180,210,255,0.8)" />
      <ellipse cx="32" cy="62" rx="4.5" ry="2" fill="rgba(180,210,255,0.8)" />
      {/* Lower spike */}
      <path d="M32 80 L28 86 L32 92 L36 86 Z" fill="url(#trishul-grad)" />
      <defs>
        <linearGradient id="trishul-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#dde9ff" />
          <stop offset="55%"  stopColor="#7aa6ff" />
          <stop offset="100%" stopColor="#3a5fb5" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function Loader() {
  const { progress, active } = useProgress()
  // Smoothed display value (drei progress is jumpy)
  const [shown, setShown] = useState(0)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let raf
    const animate = () => {
      setShown((s) => {
        const target = progress
        // Ease toward target; once we've reached 100 and assets are done, snap.
        if (Math.abs(target - s) < 0.05 && target >= 99.99 && !active) return 100
        return s + (target - s) * 0.08
      })
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [progress, active])

  useEffect(() => {
    // Once everything has finished AND we've smoothed up to ~100, fade out.
    if (!active && shown >= 99.5) {
      const t = setTimeout(() => setHidden(true), 700)
      return () => clearTimeout(t)
    }
  }, [active, shown])

  // Failsafe: if progress reports done but visuals haven't ticked, hide after 12s
  useEffect(() => {
    const t = setTimeout(() => setHidden(true), 12000)
    return () => clearTimeout(t)
  }, [])

  const pct = Math.min(100, Math.max(0, shown))
  // Trishul travels along the track; nudge so it doesn't clip past the right edge
  const trishulPos = pct  // percent

  return (
    <div className={`loader ${hidden ? 'loader--hidden' : ''}`}>
      {/* The attached reference image covers the whole background */}
      <div className="loader__bg" />

      {/* Centered entering text */}
      <div className="loader__body">
        <p className="loader__sub">ENTERING THE COSMIC REALM</p>
      </div>

      {/* Progress bar pinned to bottom */}
      <div className="loader__footer">
        <div className="trishul-track">
          <div className="trishul-track__fill" style={{ width: `${pct}%` }} />
          <div
            className="trishul-track__icon"
            style={{ left: `calc(${trishulPos}% - 28px)` }}
          >
            <TrishulIcon size={44} />
          </div>
        </div>
        <p className="loader__pct">{Math.floor(pct)}%</p>
      </div>
    </div>
  )
}
