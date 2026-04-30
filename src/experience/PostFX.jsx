import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  EffectComposer,
  Bloom,
  Vignette,
  ChromaticAberration,
} from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import * as THREE from 'three'
import { scrollStore } from '../scrollStore'

// Wrapper that reads scroll and controls effect intensities dynamically
function AdaptiveEffects() {
  const bloomRef = useRef()
  const vigRef   = useRef()

  // ChromaticAberration — use a mutating Vector2 (postprocessing reads it by ref each frame)
  const caOffset = useMemo(() => new THREE.Vector2(0, 0), [])

  useFrame(() => {
    const p = scrollStore.progress

    const awakening = THREE.MathUtils.smoothstep(p, 0.18, 0.32)
    const tandava   = THREE.MathUtils.smoothstep(p, 0.40, 0.56)
    const thirdEye  = THREE.MathUtils.smoothstep(p, 0.62, 0.74)
    const diss      = THREE.MathUtils.smoothstep(p, 0.82, 0.98)

    // Bloom — only very bright things bloom (fire/energy), not regular textures
    if (bloomRef.current) {
      bloomRef.current.intensity =
        0.3
        + awakening * 0.2
        + tandava   * 0.8
        + thirdEye  * 3.0
        + diss      * 0.6
    }

    // Chromatic aberration — mutate the Vector2 in place
    const ca = thirdEye * 0.006 * (1 - diss * 0.8)
    caOffset.set(ca, ca)
  })

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloomRef}
        intensity={0.3}
        luminanceThreshold={0.55}
        luminanceSmoothing={0.9}
        kernelSize={KernelSize.LARGE}
        mipmapBlur
      />

      <ChromaticAberration
        offset={caOffset}
        blendFunction={BlendFunction.NORMAL}
      />

      <Vignette
        ref={vigRef}
        offset={0.38}
        darkness={0.82}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  )
}

export default function PostFX() {
  return <AdaptiveEffects />
}
