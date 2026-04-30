import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { scrollStore } from '../scrollStore'

// Pre-load
useGLTF.preload('/models/trishul/scene.gltf')

export default function TrishulProp() {
  const groupRef = useRef()
  const glowRef  = useRef()

  const { scene } = useGLTF('/models/trishul/scene.gltf')

  // Auto-normalize to 8 world units tall
  const { ns, offX, offY, offZ } = useMemo(() => {
    const box  = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    const ctr  = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(ctr)
    const maxDim = Math.max(size.x, size.y, size.z)
    const target = 8
    const ns = target / (maxDim || 1)
    return {
      ns,
      offX: -ctr.x,
      offY: -box.min.y,
      offZ: -ctr.z,
    }
  }, [scene])

  // Enhance materials with gold emissive
  useEffect(() => {
    scene.traverse((child) => {
      if (!child.isMesh || !child.material) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach(m => {
        if (!m) return
        m.envMapIntensity = 1.2
        if (m.emissive) {
          m.emissive.setRGB(0.35, 0.25, 0.05)
          m.emissiveIntensity = 0.4
        }
        m.needsUpdate = true
      })
    })
  }, [scene])

  const scaleRef = useRef(0.001)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const p = scrollStore.progress

    if (!groupRef.current) return

    // Visible from Scene 2 onwards, feature in Scenes 2-4
    const show = THREE.MathUtils.smoothstep(p, 0.18, 0.32)
    const diss  = THREE.MathUtils.smoothstep(p, 0.84, 0.97)
    const targetScale = ns * show * (1 - diss * 0.9)
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, 0.025)
    groupRef.current.scale.setScalar(scaleRef.current)

    // Slow ceremonial rotation during scene 1–3
    if (p < 0.65) {
      groupRef.current.rotation.y = t * 0.25
    }

    // Float up/down gently
    groupRef.current.position.y = 1.5 + Math.sin(t * 0.6 + 1.2) * 0.25

    // Glow intensifies at Tandava + Third Eye
    if (glowRef.current) {
      const tandava  = THREE.MathUtils.smoothstep(p, 0.40, 0.56)
      const thirdEye = THREE.MathUtils.smoothstep(p, 0.62, 0.74)
      scene.traverse((child) => {
        if (!child.isMesh || !child.material) return
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        mats.forEach(m => {
          if (!m || !m.emissive) return
          m.emissiveIntensity = 0.4 + tandava * 1.2 + thirdEye * 2.5
        })
      })
    }
  })

  return (
    // Positioned to the right of Shiva, slightly in front of mountain
    <group position={[6, 0, 4]}>
      <group ref={groupRef} scale={0.001}>
        <group ref={glowRef} position={[offX, offY, offZ]}>
          <primitive object={scene} />
        </group>
      </group>

      {/* Soft gold point light emanating from trishul */}
      <pointLight color="#ffd080" intensity={1.5} distance={18} decay={2} />
    </group>
  )
}
