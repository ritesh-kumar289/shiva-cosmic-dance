import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { scrollStore } from '../scrollStore'

useGLTF.preload('/models/lord_shiva_with_trishul.glb')

export default function ShivaFigure() {
  const outerGroupRef = useRef()
  const innerGroupRef = useRef()
  const thirdEyeRef   = useRef()
  const ring1Ref      = useRef()
  const ring2Ref      = useRef()

  const { scene, animations } = useGLTF('/models/lord_shiva_with_trishul.glb')
  const { actions, names }    = useAnimations(animations, outerGroupRef)

  const { normalizedScale, offsetX, offsetY, offsetZ, modelHeight } = useMemo(() => {
    const box  = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    const ctr  = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(ctr)
    const maxDim = Math.max(size.x, size.y, size.z)
    const targetH = 12
    const ns = targetH / (size.y || maxDim)
    return {
      normalizedScale: ns,
      offsetX: -ctr.x,
      offsetY: -box.min.y,
      offsetZ: -ctr.z,
      modelHeight: size.y * ns,
    }
  }, [scene])

  useEffect(() => {
    scene.traverse((child) => {
      if (!child.isMesh) return
      child.castShadow    = true
      child.receiveShadow = true
      // Preserve original GLB textures — don't override emissive here
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach(m => {
        if (!m) return
        // Start with zero emissive so original colors show fully
        if (m.emissive) { m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = 0 }
        m.needsUpdate = true
      })
    })
  }, [scene])

  useEffect(() => {
    if (!names.length) return
    const idle = actions[names[0]]
    if (idle) idle.reset().setLoop(THREE.LoopRepeat, Infinity).play()
  }, [actions, names])

  const scaleState = useRef(-1)  // -1 sentinel: snap to target on first frame

  // Mouse-interactive rotation — gently follows cursor like the solar system does
  const mouseTarget = useRef(new THREE.Vector2(0, 0))
  const mouseSmooth = useRef(new THREE.Vector2(0, 0))
  useEffect(() => {
    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth)  * 2 - 1
      const y = (e.clientY / window.innerHeight) * 2 - 1
      mouseTarget.current.set(x, y)
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const p = scrollStore.progress
    mouseSmooth.current.lerp(mouseTarget.current, 0.06)

    // Shiva visible from the start — small scale at p=0, full at p=0.18
    const awakening = THREE.MathUtils.smoothstep(p, 0.0, 0.18)
    // Dissolve faster so Shiva is fully gone before the solar system reveals
    const diss      = THREE.MathUtils.smoothstep(p, 0.76, 0.82)
    const tandava   = THREE.MathUtils.smoothstep(p, 0.40, 0.56) * (1 - THREE.MathUtils.smoothstep(p, 0.62, 0.78))
    const eyeGlow   = THREE.MathUtils.smoothstep(p, 0.60, 0.70) * (1 - THREE.MathUtils.smoothstep(p, 0.78, 0.84))

    // Always at least 65% scale so model is visible even at p=0; fully gone by scene 5
    const visScale  = THREE.MathUtils.lerp(0.65, 1.0, awakening)
    const targetScale = normalizedScale * visScale * (1 - diss)
    if (scaleState.current < 0) scaleState.current = targetScale  // first-frame snap
    scaleState.current = THREE.MathUtils.lerp(scaleState.current, targetScale, 0.055)

    if (innerGroupRef.current) innerGroupRef.current.scale.setScalar(scaleState.current)

    if (outerGroupRef.current) {
      // Very subtle float — only ABOVE baseline so feet don't sink through mountain
      outerGroupRef.current.position.y = Math.max(0, Math.sin(t * 0.45) * 0.12)
      // Mouse-interactive sway: subtle rotation tracking cursor (stronger when scene calmer)
      const interact = (1 - tandava) * (1 - diss)
      const breathY  = (p < 0.38 ? Math.sin(t * 0.1) * 0.22 : 0)
      outerGroupRef.current.rotation.y = breathY + mouseSmooth.current.x * 0.35 * interact
      outerGroupRef.current.rotation.x = -mouseSmooth.current.y * 0.12 * interact
    }

    // Hide entirely once the burst has dissolved Shiva — keeps the solar system clean
    if (innerGroupRef.current) innerGroupRef.current.visible = p < 0.83
    if (ring1Ref.current)      ring1Ref.current.visible      = p < 0.80
    if (ring2Ref.current)      ring2Ref.current.visible      = p < 0.80

    scene.traverse((child) => {
      if (!child.isMesh || !child.material) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach(m => {
        if (!m || !m.emissive) return
        // Only add emissive glow during Tandava/Third Eye — otherwise keep original textures
        if (tandava > 0.05) {
          m.emissive.setRGB(0.4 * tandava, 0.15 * tandava, 0.03 * tandava)
          m.emissiveIntensity = tandava * 0.6 + eyeGlow * 1.5
        } else if (eyeGlow > 0.05) {
          m.emissive.setRGB(0.5 * eyeGlow, 0.35 * eyeGlow, 0.1 * eyeGlow)
          m.emissiveIntensity = eyeGlow * 1.8
        } else if (awakening > 0.05) {
          // Scene 2 awakening: warm ambient glow so original GLB textures show through
          m.emissive.setRGB(0.06 * awakening, 0.04 * awakening, 0.02 * awakening)
          m.emissiveIntensity = awakening * 0.12
        } else {
          m.emissive.setRGB(0, 0, 0)
          m.emissiveIntensity = 0
        }
      })
    })

    if (thirdEyeRef.current) thirdEyeRef.current.material.emissiveIntensity = (1.5 + eyeGlow * 12) * (1 - diss)

    // Fire rings only during Tandava / Third Eye
    if (ring1Ref.current) ring1Ref.current.material.opacity = tandava * 0.4
    if (ring2Ref.current) ring2Ref.current.material.opacity = tandava * 0.22

  })

  const ringY = (modelHeight * 0.5) || 4

  return (
    <group ref={outerGroupRef}>
      <group ref={innerGroupRef} scale={0.001}>
        <group position={[offsetX, offsetY, offsetZ]}>
          <primitive object={scene} />
        </group>
        <mesh
          ref={thirdEyeRef}
          position={[offsetX, offsetY + (11 / normalizedScale) * 0.94, offsetZ + (0.4 / normalizedScale)]}
        >
          <sphereGeometry args={[0.08 / normalizedScale, 10, 10]} />
          <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={1.5} />
        </mesh>
      </group>

      <mesh position={[0, ringY, 0]} ref={ring1Ref}>
        <torusGeometry args={[3.5, 0.07, 8, 72]} />
        <meshStandardMaterial color="#ff6600" emissive="#ff3300" emissiveIntensity={2} transparent opacity={0} />
      </mesh>
      <mesh position={[0, ringY, 0]} rotation={[0.06, 0.1, 0]} ref={ring2Ref}>
        <torusGeometry args={[3.8, 0.035, 8, 72]} />
        <meshStandardMaterial color="#ff8800" emissive="#ff5500" emissiveIntensity={1.5} transparent opacity={0} />
      </mesh>
    </group>
  )
}
