import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { scrollStore } from '../scrollStore'
import { themeStore } from '../theme/themeStore'

export default function Lighting() {
  const ambRef     = useRef()
  const moonRef    = useRef()
  const fireRef    = useRef()
  const blueRef    = useRef()
  const fillRef    = useRef()  // constant front fill — shows Shiva's real textures

  const { scene: mtnGLB } = useGLTF('/models/snow_mountain.glb')
  const { peakY, shivaZ } = useMemo(() => {
    const box  = new THREE.Box3().setFromObject(mtnGLB)
    const size   = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const mScale = 120 / (Math.max(size.x, size.z) || 1)
    const offZ   = -center.z
    const sz     = (9.39 + offZ) * mScale + (-20)
    return { peakY: -8 + (box.max.y + (-box.min.y)) * mScale - 1.5, shivaZ: sz }
  }, [mtnGLB])

  const themeT = useRef(themeStore.current === 'light' ? 1 : 0)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const p = scrollStore.progress

    // Smoothly blend between dark (0) and sunset (1) themes
    const themeTarget = themeStore.current === 'light' ? 1 : 0
    themeT.current += (themeTarget - themeT.current) * 0.06
    const TH = themeT.current

    // Void (0–0.2): very dark
    // Awakening (0.2–0.4): blue moonlight grows
    // Tandava (0.4–0.6): fire/orange dominates
    // Third Eye (0.6–0.8): intense white flash
    // Dissolution (0.8–1.0): deep violet

    const awakening = THREE.MathUtils.smoothstep(p, 0.18, 0.35)
    const tandava   = THREE.MathUtils.smoothstep(p, 0.38, 0.56) * (1 - THREE.MathUtils.smoothstep(p, 0.62, 0.78))
    const thirdEye  = THREE.MathUtils.smoothstep(p, 0.60, 0.70) * (1 - THREE.MathUtils.smoothstep(p, 0.78, 0.84))
    const diss      = THREE.MathUtils.smoothstep(p, 0.82, 0.98)

    if (ambRef.current) {
      // Boost ambient significantly so GLB textures are readable at all times
      const ambIntensity = 0.35
        + awakening * 0.25
        + tandava   * 0.20
        + thirdEye  * 0.55
        + diss      * 0.05
      // Light mode reads brighter overall (daylit sunset)
      ambRef.current.intensity = ambIntensity + TH * 0.55
      // Cool moonlit colour vs warm sunset peach
      const r = (0.7 + tandava * 0.3 + thirdEye * 0.3) * (1 - TH) + 1.00 * TH
      const g = (0.7 + awakening * 0.1 + thirdEye * 0.2) * (1 - TH) + 0.78 * TH
      const b = (0.85 + awakening * 0.1 + diss * 0.1)    * (1 - TH) + 0.62 * TH
      ambRef.current.color.setRGB(r, g, b)
    }

    // Constant front fill light — makes Shiva's textures always visible
    if (fillRef.current) {
      fillRef.current.intensity = (0.7 + awakening * 0.6 + tandava * 0.5) + TH * 0.4
      const fr = (0.9 + tandava * 0.1) * (1 - TH) + 1.00 * TH
      const fg = 0.85                  * (1 - TH) + 0.70 * TH
      const fb = (0.8 - tandava * 0.2) * (1 - TH) + 0.50 * TH
      fillRef.current.color.setRGB(fr, fg, fb)
    }

    if (moonRef.current) {
      // Directional moonlight: always on at decent strength so mountain is lit
      moonRef.current.intensity = (0.3 + awakening * 0.4 * (1 - tandava * 0.4)) + TH * 0.6
      // In sunset mode this becomes a low warm sun
      const mr = 0.7 * (1 - TH) + 1.00 * TH
      const mg = 0.8 * (1 - TH) + 0.65 * TH
      const mb = 1.0 * (1 - TH) + 0.45 * TH
      moonRef.current.color.setRGB(mr, mg, mb)
    }

    if (blueRef.current) {
      // Blue point light at Shiva position
      const pulse = Math.sin(t * 1.8) * 0.2 + 1.0
      blueRef.current.intensity = awakening * 1.5 * pulse * (1 - tandava * 0.5)
      blueRef.current.color.setRGB(0.15, 0.4, 1.0)
    }

    if (fireRef.current) {
      // Fire point light from below during Tandava + Third Eye
      const flicker = Math.sin(t * 12.5) * 0.15 + Math.sin(t * 7.3) * 0.1 + 1
      fireRef.current.intensity = tandava * 3.5 * flicker + thirdEye * 5
      fireRef.current.color.setRGB(1.0, 0.35 + thirdEye * 0.4, 0.05)
    }
  })

  return (
    <>
      <ambientLight ref={ambRef} intensity={0.35} />

      {/* Constant front-facing fill — always illuminates Shiva's textures */}
      <directionalLight
        ref={fillRef}
        position={[5, 15, 25]}
        intensity={0.7}
      />

      {/* Moon / sky light */}
      <directionalLight
        ref={moonRef}
        position={[-20, 40, -10]}
        intensity={0.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {/* Shiva blue aura light — positioned at Shiva's chest height */}
      <pointLight ref={blueRef} position={[0, peakY + 6, shivaZ]} intensity={0} distance={35} decay={2} />

      {/* Fire / Tandava light — at Shiva's feet during Tandava + Third Eye */}
      <pointLight ref={fireRef} position={[0, peakY + 1, shivaZ]} intensity={0} distance={30} decay={2} />
    </>
  )
}
