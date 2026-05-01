import { Suspense, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import CameraRig from './CameraRig'
import Kailash from './Kailash'
import ShivaFigure from './ShivaFigure'
import SpaceEnvironment from './SpaceEnvironment'
import AshParticles from './AshParticles'
import ThirdEyeEffect from './ThirdEyeEffect'
import DissolutionEffect from './DissolutionEffect'
import PostFX from './PostFX'
import Lighting from './Lighting'
import CosmicTexts from './CosmicTexts'
import CloudCarpet from './CloudCarpet'
import ThemedFog from './ThemedFog'

// Trigger preload early so GLB is cached before components render
useGLTF.preload('/models/snow_mountain.glb')

export default function Experience() {
  const { scene: mtnGLB } = useGLTF('/models/snow_mountain.glb')

  // Dynamically compute mountain peak so all Shiva content sits at the right height
  const { peakY, shivaZ } = useMemo(() => {
    const box  = new THREE.Box3().setFromObject(mtnGLB)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const mScale = 120 / (Math.max(size.x, size.z) || 1)
    // offY = -box.min.y (shifts GLB so base sits at y=0 in the inner group)
    const offY = -box.min.y
    // offZ = -center.z
    const offZ = -center.z
    // Mountain group is at [0,-8,-20]. Inner group scale=mScale, position=[offX,offY,offZ]
    // Peak vertex raw z from debug: ~9.39. World z = (raw_z + offZ) * mScale + (-20)
    // For x=0 alignment, find the peak vertex (highest y) and use its z
    // Approximate: peak raw z = 9.39 (from debug log)
    // For safety, scan the scene bounding box max Y and find its approximate Z position
    // The GLB peak vertex is at raw z≈9.39
    const RAW_PEAK_Z = 9.39  // measured from debug
    const worldPeakY = -8 + (box.max.y + offY) * mScale  // = -8 + (34.69 - 1.26)*0.8386 ≈ 20
    const worldPeakZ = (RAW_PEAK_Z + offZ) * mScale + (-20)  // ≈ (9.39 + 0)*0.8386 - 20 ≈ -12.1
    return {
      // Drop Shiva 1.5 units so feet sink into snow — looks grounded, not floating
      peakY:  worldPeakY - 1.5,
      shivaZ: worldPeakZ,
    }
  }, [mtnGLB])

  return (
    <>
      <CameraRig />

      {/* Space nebula background (far background) */}
      <Suspense fallback={null}>
        <SpaceEnvironment />
      </Suspense>

      <Lighting />

      {/* Fog: theme-aware (deep cosmos vs sunset haze) */}
      <ThemedFog />

      {/* Mount Kailash */}
      <Suspense fallback={null}>
        <Kailash />
      </Suspense>

      {/* Vanta-style cloud carpet around mountain base */}
      <CloudCarpet />

      {/* Sacred ash particles drift near mountain base — in world space, not Shiva-relative */}
      <AshParticles />

      {/* All Shiva-relative content elevated to the mountain peak (shifted slightly right) */}
      <group position={[3.5, peakY, shivaZ]}>
        <Suspense fallback={null}>
          <ShivaFigure />
        </Suspense>
        <ThirdEyeEffect />
        <DissolutionEffect />
      </group>

      {/* Post-processing */}
      <PostFX />

      {/* 3D scene-title text — positioned far to sides/back so it never overlaps mountain or Shiva */}
      <CosmicTexts />
    </>
  )
}
