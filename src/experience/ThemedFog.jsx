import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { themeStore } from '../theme/themeStore'

const DARK  = new THREE.Color('#020410')
const LIGHT = new THREE.Color('#f3a06b')

export default function ThemedFog() {
  const { scene } = useThree()
  const ref = useRef({ t: themeStore.current === 'light' ? 1 : 0, fog: null })

  if (!ref.current.fog) {
    ref.current.fog = new THREE.Fog(DARK.clone(), 150, 600)
    scene.fog = ref.current.fog
  }

  useFrame(() => {
    const target = themeStore.current === 'light' ? 1 : 0
    ref.current.t += (target - ref.current.t) * 0.06
    const f = ref.current.fog
    f.color.copy(DARK).lerp(LIGHT, ref.current.t)
    // Pull fog closer in light mode so distant nebula is hidden behind warm haze
    f.near = THREE.MathUtils.lerp(150, 80,  ref.current.t)
    f.far  = THREE.MathUtils.lerp(600, 380, ref.current.t)
  })

  return null
}
