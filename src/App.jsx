import { useEffect, useRef, useState, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { scrollStore } from './scrollStore'
import Experience from './experience/Experience'
import Overlay from './overlay/Overlay'
import Loader from './overlay/Loader'
import AudioController from './audio/AudioController'
import ThemeToggle from './theme/ThemeToggle'

export default function App() {
  const [scrollProgress, setScrollProgress] = useState(0)
  const [activeScene, setActiveScene] = useState(0)

  // Track scroll for UI
  useEffect(() => {
    const update = () => {
      const el = document.documentElement
      const raw = window.scrollY / Math.max(1, el.scrollHeight - el.clientHeight)
      const progress = Math.max(0, Math.min(1, raw))

      scrollStore.velocity = Math.abs(progress - scrollStore.prevProgress) * 60
      scrollStore.prevProgress = scrollStore.progress
      scrollStore.progress = progress

      setScrollProgress(progress)
      setActiveScene(Math.min(4, Math.floor(progress * 5)))
    }

    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  return (
    <>
      {/* ── Loader (trishul slides L→R with real asset progress) ─ */}
      <Loader />

      {/* ── Tall scroll container (drives progress 0→1) ─ */}
      <div className="scroll-container">

        {/* Fixed 3-D canvas */}
        <div className="canvas-wrapper">
          <Suspense fallback={null}>
            <Canvas
              camera={{ position: [0, 6, 45], fov: 58, near: 0.1, far: 1000 }}
              gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
              dpr={[1, 1.5]}
              shadows
            >
              <Experience />
            </Canvas>
          </Suspense>
        </div>

        {/* Fixed HTML overlay */}
        <Overlay activeScene={activeScene} scrollProgress={scrollProgress} />

        {/* Background music + scene SFX */}
        <AudioController />

        {/* Theme toggle (sunset / cosmos) */}
        <ThemeToggle />

        {/* Scroll hint */}
        <div className="scroll-hint scroll-hint--visible">
          <span className="scroll-hint__text">SCROLL</span>
          <div className="scroll-hint__line" />
        </div>

      </div>
    </>
  )
}
