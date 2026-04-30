import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollStore } from '../scrollStore'

const COUNT = 3500

const VERT = /* glsl */`
attribute float aSize;
attribute float aPhase;
attribute vec3  aColor;

uniform float uTime;
varying vec3  vColor;
varying float vAlpha;

void main() {
  vColor = aColor;
  float twinkle = sin(uTime * 1.5 + aPhase * 6.28) * 0.35 + 0.65;
  vAlpha = twinkle;

  vec4 mvPos    = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize  = aSize * (200.0 / -mvPos.z);
  gl_Position   = projectionMatrix * mvPos;
}
`
const FRAG = /* glsl */`
varying vec3  vColor;
varying float vAlpha;

void main() {
  vec2  c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;

  float soft  = 1.0 - smoothstep(0.2, 0.5, d);
  gl_FragColor = vec4(vColor, soft * vAlpha * 0.9);
}
`

export default function CosmicParticles() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])

  const [pos, sizes, phases, colors] = useMemo(() => {
    const p   = new Float32Array(COUNT * 3)
    const s   = new Float32Array(COUNT)
    const ph  = new Float32Array(COUNT)
    const col = new Float32Array(COUNT * 3)

    for (let i = 0; i < COUNT; i++) {
      // Sphere shell far behind the scene — never in front of mountain/Shiva
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const r     = 200 + Math.random() * 150   // 200–350 units, always behind scene

      p[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) - 10
      p[i * 3 + 2] = r * Math.cos(phi)

      s[i]  = 0.8 + Math.random() * 3.5
      ph[i] = Math.random()

      // Mostly white, occasional blue/gold
      const type = Math.random()
      if (type < 0.08) {
        col[i * 3] = 0.4; col[i * 3 + 1] = 0.55; col[i * 3 + 2] = 1.0 // blue
      } else if (type < 0.13) {
        col[i * 3] = 1.0; col[i * 3 + 1] = 0.88; col[i * 3 + 2] = 0.3 // gold
      } else {
        const w = 0.85 + Math.random() * 0.15
        col[i * 3] = w; col[i * 3 + 1] = w; col[i * 3 + 2] = w + 0.05
      }
    }
    return [p, s, ph, col]
  }, [])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos,    3]} />
        <bufferAttribute attach="attributes-aSize"    args={[sizes,  1]} />
        <bufferAttribute attach="attributes-aPhase"   args={[phases, 1]} />
        <bufferAttribute attach="attributes-aColor"   args={[colors, 3]} />
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
