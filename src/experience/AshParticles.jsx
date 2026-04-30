import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollStore } from '../scrollStore'

const COUNT = 2000

const VERT = /* glsl */`
attribute float aSpeed;
attribute float aOffset;
attribute vec3  aRandom;

uniform float uTime;
uniform float uProgress;

varying float vAlpha;

void main() {
  vec3 pos = position;

  // Float upward in a loop, with horizontal drift
  float t    = mod(uTime * aSpeed + aOffset, 6.0);
  pos.y     += t * 2.0;
  pos.x     += sin(t * 0.7 + aOffset) * aRandom.x * 1.4;
  pos.z     += cos(t * 0.5 + aOffset * 1.3) * aRandom.z * 1.2;

  // Fade: appear in scene 2, fade out in scene 3
  float show = smoothstep(0.19, 0.30, uProgress) * (1.0 - smoothstep(0.44, 0.56, uProgress));
  vAlpha     = show * (1.0 - t / 6.0) * 0.75;

  vec4 mvPos      = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize    = (3.0 + aRandom.y * 4.0) * (280.0 / -mvPos.z);
  gl_Position     = projectionMatrix * mvPos;
}
`

const FRAG = /* glsl */`
varying float vAlpha;

void main() {
  vec2  center = gl_PointCoord - 0.5;
  float d      = length(center);
  if (d > 0.5) discard;

  float alpha = (1.0 - d * 2.0) * vAlpha;
  gl_FragColor = vec4(0.88, 0.88, 0.92, alpha);
}
`

export default function AshParticles() {
  const pointsRef = useRef()

  const [positions, speeds, offsets, randoms] = useMemo(() => {
    const pos   = new Float32Array(COUNT * 3)
    const spd   = new Float32Array(COUNT)
    const off   = new Float32Array(COUNT)
    const rnd   = new Float32Array(COUNT * 3)

    for (let i = 0; i < COUNT; i++) {
      // Spread near base of Kailash
      pos[i * 3]     = (Math.random() - 0.5) * 24
      pos[i * 3 + 1] = Math.random() * 4 - 4
      pos[i * 3 + 2] = (Math.random() - 0.5) * 24 - 6

      spd[i]         = 0.35 + Math.random() * 0.45
      off[i]         = Math.random() * 6.0

      rnd[i * 3]     = (Math.random() - 0.5)
      rnd[i * 3 + 1] = Math.random()
      rnd[i * 3 + 2] = (Math.random() - 0.5)
    }
    return [pos, spd, off, rnd]
  }, [])

  const uniforms = useMemo(() => ({
    uTime:     { value: 0 },
    uProgress: { value: 0 },
  }), [])

  useFrame(({ clock }) => {
    uniforms.uTime.value     = clock.getElapsedTime()
    uniforms.uProgress.value = scrollStore.progress
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSpeed"   args={[speeds,    1]} />
        <bufferAttribute attach="attributes-aOffset"  args={[offsets,   1]} />
        <bufferAttribute attach="attributes-aRandom"  args={[randoms,   3]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}
