import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { scrollStore } from '../scrollStore'
import { themeStore } from '../theme/themeStore'

useGLTF.preload('/models/snow_mountain.glb')

export default function Kailash() {
  const groupRef = useRef()
  const groundRef = useRef()
  const themeT = useRef(themeStore.current === 'light' ? 1 : 0)
  const { scene } = useGLTF('/models/snow_mountain.glb')

  // Auto-scale based on actual GLB bounding box — no hardcoded scale
  const { scale, offX, offY, offZ } = useMemo(() => {
    const box    = new THREE.Box3().setFromObject(scene)
    const size   = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    // Target: mountain fills ~120 world units wide — epic backdrop
    const targetWidth = 120
    const s = targetWidth / (Math.max(size.x, size.z) || 1)
    return {
      scale: s,
      offX:  -center.x,
      offY:  -box.min.y,   // feet sit at y=0 within group
      offZ:  -center.z,
    }
  }, [scene])

  useEffect(() => {
    scene.traverse((child) => {
      if (!child.isMesh) return
      child.castShadow    = true
      child.receiveShadow = true
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach(m => {
        if (!m) return
        if (m.color) {
          m.color.setRGB(
            m.color.r * 0.85 + 0.06,
            m.color.g * 0.88 + 0.06,
            m.color.b * 0.90 + 0.12,
          )
        }
        if ('roughness'  in m) m.roughness  = 0.98
        if ('metalness'  in m) m.metalness  = 0.0
        // Also kill texture maps that override roughness/metalness
        if ('roughnessMap' in m) m.roughnessMap = null
        if ('metalnessMap' in m) m.metalnessMap = null
        // Ensure renderOrder so mountain always draws over space background
        child.renderOrder = 1
        m.needsUpdate = true
      })
    })
  }, [scene])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const p = scrollStore.progress
    const t = clock.getElapsedTime()

    // Very slow majestic drift
    groupRef.current.rotation.y = Math.sin(t * 0.05) * 0.012

    // Scene 5 dissolution: mountain slowly sinks
    const diss = THREE.MathUtils.smoothstep(p, 0.82, 0.98)
    groupRef.current.position.y = -8 - diss * 5

    // Theme-aware ground tint (cool snow ↔ warm dune)
    const target = themeStore.current === 'light' ? 1 : 0
    themeT.current += (target - themeT.current) * 0.06
    if (groundRef.current) {
      const c = groundRef.current.material.color
      c.setRGB(
        0.78 * (1 - themeT.current) + 0.95 * themeT.current,
        0.85 * (1 - themeT.current) + 0.62 * themeT.current,
        0.94 * (1 - themeT.current) + 0.50 * themeT.current,
      )
    }
  })

  return (
    <group ref={groupRef} position={[0, -8, -20]} renderOrder={1}>
      <group scale={scale}>
        <group position={[offX, offY, offZ]}>
          <primitive object={scene} />
        </group>
      </group>

      {/* Vast ground plane — tints between snow and warm sand by theme */}
      <mesh ref={groundRef} position={[0, 0, 10]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1200, 800]} />
        <meshStandardMaterial color="#c8d8f0" roughness={0.88} metalness={0.04} />
      </mesh>
    </group>
  )
}
