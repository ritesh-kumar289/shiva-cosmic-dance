import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { scrollStore } from '../scrollStore'
import { themeStore } from '../theme/themeStore'

useGLTF.preload('/models/need_some_space.glb')

export default function SpaceEnvironment() {
  const groupRef = useRef()
  const matsRef  = useRef([])
  const themeT   = useRef(themeStore.current === 'light' ? 1 : 0)
  const { scene } = useGLTF('/models/need_some_space.glb')

  // Auto-scale: fill a giant sphere around the scene
  const { ns, offX, offY, offZ } = useMemo(() => {
    const box  = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    const ctr  = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(ctr)
    const maxDim = Math.max(size.x, size.y, size.z)
    const target = 800   // large enough to always surround everything
    const ns = target / (maxDim || 1)
    return { ns, offX: -ctr.x, offY: -ctr.y, offZ: -ctr.z }
  }, [scene])

  useEffect(() => {
    const collected = []
    scene.traverse((child) => {
      // Handle BOTH regular meshes AND point cloud star particles
      const isRenderable = child.isMesh || child.isPoints || child.isLine
      if (!isRenderable || !child.material) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach(m => {
        if (!m) return
        // BackSide renders inside the sphere (skybox)
        if (child.isMesh) m.side = THREE.BackSide
        // depthWrite=false + depthTest=false: renders unconditionally, never blocks other objects
        m.depthWrite = false
        m.depthTest  = false
        // CRITICAL: mark opaque so Three.js renders this in the OPAQUE pass.
        // Opaque pass respects renderOrder=-10 → renders BEFORE mountain (renderOrder=0).
        // Mountain then overwrites these pixels in the color buffer.
        m.transparent = false
        m.opacity     = 1.0
        // Darken so it looks like deep space, not a bright image
        if (m.color) m.color.multiplyScalar(0.3)
        if (m.emissive) { m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = 0 }
        if ('emissiveMap' in m) m.emissiveMap = null
        // Stash the post-darken color so we can blend it toward sunset later
        m.userData.darkColor = m.color ? m.color.clone() : new THREE.Color(0, 0, 0)
        m.needsUpdate = true
        collected.push(m)
      })
      // render BEFORE every other object — renderOrder=-10 guarantees this
      child.renderOrder = -10
    })
    matsRef.current = collected
  }, [scene])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()

    // Slow cosmic drift
    groupRef.current.rotation.y = t * 0.006
    groupRef.current.rotation.x = Math.sin(t * 0.003) * 0.03

    // In sunset/light mode the deep cosmos washes out into a peach sky.
    const target = themeStore.current === 'light' ? 1 : 0
    themeT.current += (target - themeT.current) * 0.06
    const TH = themeT.current
    const sunsetR = 0.96, sunsetG = 0.62, sunsetB = 0.42
    matsRef.current.forEach((m) => {
      if (!m.color || !m.userData.darkColor) return
      const d = m.userData.darkColor
      m.color.setRGB(
        d.r * (1 - TH) + sunsetR * TH,
        d.g * (1 - TH) + sunsetG * TH,
        d.b * (1 - TH) + sunsetB * TH,
      )
    })
  })

  return (
    // renderOrder on group isn't used by R3F for meshes, handled per-mesh above
    <group ref={groupRef} scale={ns}>
      <group position={[offX, offY, offZ]}>
        <primitive object={scene} />
      </group>
    </group>
  )
}
