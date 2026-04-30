import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollStore } from '../scrollStore'

// Cosmic sky dome with gradient shader
const SKY_VERT = `
varying vec3 vWorldPos;
void main() {
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const SKY_FRAG = `
uniform float uTime;
uniform float uProgress;
varying vec3 vWorldPos;

vec3 palette(float t) {
  // Deep cosmic palette: dark navy → midnight blue → deep purple
  vec3 a = vec3(0.01, 0.01, 0.06);
  vec3 b = vec3(0.02, 0.04, 0.14);
  vec3 c = vec3(0.04, 0.02, 0.16);
  float blend = clamp(t, 0.0, 1.0);
  return mix(mix(a, b, blend), c, blend * blend);
}

void main() {
  vec3 dir = normalize(vWorldPos);
  float hor = dir.y * 0.5 + 0.5;

  // Base sky color
  vec3 col = palette(hor * 0.8);

  // Tandava: add orange/fire tones on horizon
  float tandava = smoothstep(0.38, 0.55, uProgress);
  vec3 fireHor = vec3(0.35, 0.12, 0.04);
  col = mix(col, fireHor, tandava * (1.0 - hor) * 0.7);

  // Third eye: everything brightens
  float thirdEye = smoothstep(0.6, 0.75, uProgress);
  col = mix(col, vec3(0.25, 0.08, 0.02), thirdEye * (1.0 - hor * 0.7) * 0.8);

  // Dissolution: return to deep cosmic purple
  float diss = smoothstep(0.82, 1.0, uProgress);
  col = mix(col, vec3(0.05, 0.02, 0.12), diss);

  gl_FragColor = vec4(col, 1.0);
}
`

export default function CosmicSky() {
  const matRef = useRef()

  const uniforms = {
    uTime:     { value: 0 },
    uProgress: { value: 0 },
  }

  useFrame(({ clock }) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value     = clock.getElapsedTime()
    matRef.current.uniforms.uProgress.value = scrollStore.progress
  })

  return (
    <mesh scale={[-500, 500, 500]}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={SKY_VERT}
        fragmentShader={SKY_FRAG}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  )
}
