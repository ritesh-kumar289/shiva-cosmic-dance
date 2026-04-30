import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollStore } from '../scrollStore'

const FIRE_COUNT = 1200

// Fire particle shader — burst from third-eye position
const FIRE_VERT = /* glsl */`
attribute float aSpeed;
attribute float aAngle;
attribute float aOffset;
attribute float aSize;

uniform float uTime;
uniform float uIntensity;

varying float vAlpha;
varying float vHeat;

void main() {
  float t   = mod(uTime * aSpeed + aOffset, 1.0);
  float ang = aAngle;

  // Burst outward in a cone from origin
  vec3 dir  = vec3(sin(ang) * 0.6, cos(ang * 0.5) * 0.8 + t * 0.3, cos(ang) * 0.6);
  vec3 pos  = position + dir * t * 6.0;

  // Slight turbulence
  pos.x += sin(t * 8.0 + aOffset * 3.14) * 0.3;
  pos.y += cos(t * 6.0 + aOffset * 2.0)  * 0.2;

  vAlpha = (1.0 - t) * uIntensity;
  vHeat  = 1.0 - t;

  vec4 mvPos   = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = aSize * (150.0 / -mvPos.z) * (1.0 - t * 0.5);
  gl_Position  = projectionMatrix * mvPos;
}
`
const FIRE_FRAG = /* glsl */`
varying float vAlpha;
varying float vHeat;

void main() {
  vec2  c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;

  float core  = 1.0 - smoothstep(0.0, 0.5, d);
  // Hot white core → orange → red
  vec3  col   = mix(vec3(1.0, 0.25, 0.05), vec3(1.0, 0.75, 0.15), vHeat);
  col         = mix(col, vec3(1.0, 1.0, 0.9), vHeat * vHeat * core);

  gl_FragColor = vec4(col, core * vAlpha);
}
`

// Shockwave ring shader
const RING_VERT = /* glsl */`
uniform float uScale;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 pos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`
const RING_FRAG = /* glsl */`
uniform float uAlpha;
uniform float uProgress;
varying vec2  vUv;

void main() {
  float inner = smoothstep(0.0, 0.08, vUv.y);
  float outer = 1.0 - smoothstep(0.92, 1.0, vUv.y);
  float band  = inner * outer;

  vec3 col = mix(vec3(1.0, 0.45, 0.05), vec3(1.0, 0.9, 0.5), uProgress);
  gl_FragColor = vec4(col, band * uAlpha);
}
`

export default function ThirdEyeEffect() {
  const fireRef   = useRef()
  const ring1Ref  = useRef()
  const ring2Ref  = useRef()
  const ring3Ref  = useRef()

  // Third eye position: Shiva's forehead, world space
  // Shiva is at y=0.5 + float, forehead at y≈0.5+9.4 ≈ 10 (but figure is local-space)
  // Shiva group is at position=[0, 0.5, 0], forehead = [0, 7.32, 0.53] * scale(1) + [0, 0.5, 0]
  const ORIGIN = useMemo(() => new THREE.Vector3(0, 8.0, 0.5), [])

  const uniforms = useMemo(() => ({
    uTime:      { value: 0 },
    uIntensity: { value: 0 },
  }), [])

  const ringUnif1 = useMemo(() => ({ uAlpha: { value: 0 }, uProgress: { value: 0 } }), [])
  const ringUnif2 = useMemo(() => ({ uAlpha: { value: 0 }, uProgress: { value: 0 } }), [])
  const ringUnif3 = useMemo(() => ({ uAlpha: { value: 0 }, uProgress: { value: 0 } }), [])

  const ringScales = useRef([0.1, 0.1, 0.1])

  const [positions, speeds, angles, offsets, sizes] = useMemo(() => {
    const pos  = new Float32Array(FIRE_COUNT * 3)
    const spd  = new Float32Array(FIRE_COUNT)
    const ang  = new Float32Array(FIRE_COUNT)
    const off  = new Float32Array(FIRE_COUNT)
    const sz   = new Float32Array(FIRE_COUNT)

    for (let i = 0; i < FIRE_COUNT; i++) {
      pos[i * 3]     = ORIGIN.x + (Math.random() - 0.5) * 0.1
      pos[i * 3 + 1] = ORIGIN.y + (Math.random() - 0.5) * 0.1
      pos[i * 3 + 2] = ORIGIN.z
      spd[i]         = 0.6 + Math.random() * 1.0
      ang[i]         = Math.random() * Math.PI * 2
      off[i]         = Math.random()
      sz[i]          = 3 + Math.random() * 6
    }
    return [pos, spd, ang, off, sz]
  }, [ORIGIN])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const p = scrollStore.progress

    // Active in scene 4: 0.6–0.80
    const eyeOpen  = THREE.MathUtils.smoothstep(p, 0.60, 0.68)
    const eyeClose = 1.0 - THREE.MathUtils.smoothstep(p, 0.78, 0.82)
    const intensity = eyeOpen * eyeClose

    uniforms.uTime.value      = t
    uniforms.uIntensity.value = intensity

    // Shockwave rings — staggered expansion
    const rings    = [ring1Ref, ring2Ref, ring3Ref]
    const ringUnifs = [ringUnif1, ringUnif2, ringUnif3]
    const delays   = [0, 0.12, 0.24]

    rings.forEach((ref, i) => {
      if (!ref.current) return
      const local = Math.max(0, eyeOpen - delays[i]) / (1 - delays[i])
      const s     = local * 22
      ref.current.scale.setScalar(s)
      ringUnifs[i].uAlpha.value    = (1.0 - local) * intensity * 0.6
      ringUnifs[i].uProgress.value = local
    })
  })

  return (
    <group position={[0, 0.5, 0]}>
      {/* Fire particles */}
      <points ref={fireRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aSpeed"   args={[speeds,   1]} />
          <bufferAttribute attach="attributes-aAngle"   args={[angles,   1]} />
          <bufferAttribute attach="attributes-aOffset"  args={[offsets,  1]} />
          <bufferAttribute attach="attributes-aSize"    args={[sizes,    1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={FIRE_VERT}
          fragmentShader={FIRE_FRAG}
          uniforms={uniforms}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* Shockwave rings */}
      {[ring1Ref, ring2Ref, ring3Ref].map((ref, i) => (
        <mesh key={i} ref={ref} position={[0, 8.0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1, 0.06, 8, 80]} />
          <shaderMaterial
            vertexShader={RING_VERT}
            fragmentShader={RING_FRAG}
            uniforms={[ringUnif1, ringUnif2, ringUnif3][i]}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}
