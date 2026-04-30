import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollStore } from '../scrollStore'

const PARTICLE_COUNT = 18000

const DISS_VERT = /* glsl */`
attribute vec3  aTarget;
attribute vec3  aPortrait;
attribute vec3  aColor;
attribute float aPhase;
attribute float aSize;

uniform float uTime;
uniform float uProgress;
uniform float uShow;
uniform vec2  uMouse;       // -1..1 normalized
uniform vec3  uCenter;      // world-space centre of the portrait

varying float vAlpha;
varying vec3  vColor;

vec3 rotY(vec3 p, float a){
  float c = cos(a), s = sin(a);
  return vec3(p.x*c + p.z*s, p.y, -p.x*s + p.z*c);
}
vec3 rotX(vec3 p, float a){
  float c = cos(a), s = sin(a);
  return vec3(p.x, p.y*c - p.z*s, p.y*s + p.z*c);
}

void main() {
  float scatter  = smoothstep(0.0, 0.5, uProgress);
  float assemble = smoothstep(0.5, 0.95, uProgress);

  vec3 scatPos = position + aTarget * scatter;

  float drift = scatter * (1.0 - assemble);
  scatPos.x += sin(uTime * 0.4 + aPhase * 6.28) * 0.4 * drift;
  scatPos.y += cos(uTime * 0.3 + aPhase * 6.28) * 0.4 * drift;

  // 3D rotation of the assembled solar system: continuous slow spin + mouse parallax
  float spin  = uTime * 0.10 + uMouse.x * 0.85;
  float tilt  = 0.32 + uMouse.y * 0.40;
  vec3 portraitLocal = rotX(rotY(aPortrait, spin), tilt);
  vec3 portraitWorld = portraitLocal + uCenter;

  vec3 finalPos = mix(scatPos, portraitWorld, assemble);

  // micro-shimmer
  finalPos.x += sin(uTime * 1.6 + aPhase * 12.0) * 0.05 * assemble;
  finalPos.y += cos(uTime * 1.4 + aPhase * 9.0)  * 0.05 * assemble;

  vAlpha = uShow * (0.22 + assemble * 0.65);

  float pulse = 0.80 + 0.20 * sin(uTime * 1.2 + aPhase * 6.28);
  vColor = aColor * pulse;

  vec4  mvPos   = modelViewMatrix * vec4(finalPos, 1.0);
  // Depth-aware sizing: closer particles get visibly bigger → strong 3D readout
  gl_PointSize  = aSize * (110.0 / -mvPos.z);
  gl_Position   = projectionMatrix * mvPos;
}
`

const DISS_FRAG = /* glsl */`
varying float vAlpha;
varying vec3  vColor;

void main() {
  vec2  c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float soft = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(vColor, soft * vAlpha);
}
`

// ─────────────────────────────────────────────────────────────────────
// 3D solar-system dot-art (drone-show style):
// • central glowing sun (filled SPHERE, not disc)
// • 5 concentric orbital rings in the XZ plane (true 3D circles)
// • planets sit on the orbits as small SPHERES of varied colour
// • two ringed companion worlds flank the system
// • a thin shell of background stars adds depth
// All coords are local to the system centre (origin); JS scales them.
// ─────────────────────────────────────────────────────────────────────
function shivaFacePoints(n) {
  const pts = []
  const BLUE   = [0.22, 0.55, 1.0]
  const LBLUE  = [0.55, 0.85, 1.0]
  const TEAL   = [0.30, 0.95, 1.0]
  const RED    = [1.0,  0.30, 0.20]
  const ORANGE = [1.0,  0.55, 0.18]
  const PINK   = [1.0,  0.45, 0.75]
  const YELLOW = [1.0,  0.85, 0.35]
  const WHITE  = [0.60, 0.65, 0.75]

  const J = (s = 0.06) => (Math.random() - 0.5) * s
  const push = (x, y, z, color, j = 0.05) =>
    pts.push({ x: x + J(j), y: y + J(j), z: z + J(j), color })

  // Filled SPHERE sampler (uniform volumetric distribution)
  const fillSphere = (cx, cy, cz, radius, count, color, jitter = 0.04) => {
    for (let i = 0; i < count; i++) {
      // rejection sample for uniform sphere volume
      let x, y, z
      do { x = Math.random()*2-1; y = Math.random()*2-1; z = Math.random()*2-1 } while (x*x+y*y+z*z > 1)
      push(cx + x * radius, cy + y * radius, cz + z * radius, color, jitter)
    }
  }
  // Thin TUBE ring in XZ plane (orbital ring with slight thickness)
  const orbitRing = (radius, count, color, thickness = 0.08, jitter = 0.04) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      // small radial + vertical thickness for a tube-like band
      const dr = (Math.random() - 0.5) * thickness
      const dy = (Math.random() - 0.5) * thickness
      const r  = radius + dr
      push(Math.cos(a) * r, dy, Math.sin(a) * r, color, jitter)
    }
  }

  // Proportions of n
  const counts = {
    sun:       Math.floor(n * 0.18),
    sunCore:   Math.floor(n * 0.04),
    sunCorona: Math.floor(n * 0.04),
    orbits:    Math.floor(n * 0.32),
    planets:   Math.floor(n * 0.26),
    sideRings: Math.floor(n * 0.10),
    stars:     Math.floor(n * 0.06),
  }

  // ── CENTRAL SUN (3D sphere with hot yellow core) ──
  fillSphere(0, 0, 0, 0.95, Math.floor(counts.sun * 0.70), RED, 0.05)
  fillSphere(0, 0, 0, 0.65, Math.floor(counts.sun * 0.30), ORANGE, 0.04)
  fillSphere(0, 0, 0, 0.32, counts.sunCore, YELLOW, 0.03)
  // Faint corona ring just outside sun (in orbital plane)
  orbitRing(1.20, counts.sunCorona, ORANGE, 0.10, 0.05)

  // ── ORBITAL RINGS — 5 true circles in XZ plane ──
  const orbitRadii = [1.85, 2.65, 3.55, 4.55, 5.65]
  const perRing = Math.floor(counts.orbits / orbitRadii.length)
  const ringColors = [LBLUE, BLUE, PINK, LBLUE, TEAL]
  orbitRadii.forEach((r, idx) => {
    orbitRing(r, perRing, ringColors[idx], 0.06, 0.03)
  })

  // ── PLANETS as 3D spheres on the orbits ──
  const planets = [
    { o: 0, a:  Math.PI * 0.35, r: 0.30, c: LBLUE  },  // small light planet, near
    { o: 1, a:  Math.PI * 1.25, r: 0.42, c: BLUE   },
    { o: 2, a:  Math.PI * 0.10, r: 0.65, c: RED    },  // big red planet
    { o: 3, a:  Math.PI * 1.85, r: 0.45, c: PINK   },
    { o: 4, a:  Math.PI * 0.85, r: 0.38, c: WHITE  },
  ]
  const perPlanet = Math.floor(counts.planets / planets.length)
  planets.forEach(p => {
    const r = orbitRadii[p.o]
    const px = Math.cos(p.a) * r
    const pz = Math.sin(p.a) * r
    fillSphere(px, 0, pz, p.r,        Math.floor(perPlanet * 0.85), p.c,     0.04)
    fillSphere(px, 0, pz, p.r * 0.45, Math.floor(perPlanet * 0.15), YELLOW,  0.03)
  })

  // ── SIDE RING SYSTEMS — small companions far left & right ──
  const sideRingCount = Math.floor(counts.sideRings / 2)
  // Left companion: pink planet with tilted ring
  {
    const sx = -7.0, sy = 0.4, sz = 0
    fillSphere(sx, sy, sz, 0.42, Math.floor(sideRingCount * 0.55), PINK, 0.04)
    const rcount = Math.floor(sideRingCount * 0.45)
    for (let i = 0; i < rcount; i++) {
      const a = (i / rcount) * Math.PI * 2
      const rr = 0.85 + (Math.random() - 0.5) * 0.05
      // ring in XZ plane tilted ~25° around Z-axis
      const lx = Math.cos(a) * rr, lz = Math.sin(a) * rr, ly = 0
      const tilt = 0.25
      const x = lx * Math.cos(tilt) - ly * Math.sin(tilt)
      const y = lx * Math.sin(tilt) + ly * Math.cos(tilt)
      push(sx + x, sy + y, sz + lz, LBLUE, 0.03)
    }
  }
  // Right companion: light-blue planet with tilted ring
  {
    const sx = 7.0, sy = 0.4, sz = 0
    fillSphere(sx, sy, sz, 0.42, Math.floor(sideRingCount * 0.55), LBLUE, 0.04)
    const rcount = Math.floor(sideRingCount * 0.45)
    for (let i = 0; i < rcount; i++) {
      const a = (i / rcount) * Math.PI * 2
      const rr = 0.85 + (Math.random() - 0.5) * 0.05
      const lx = Math.cos(a) * rr, lz = Math.sin(a) * rr, ly = 0
      const tilt = -0.25
      const x = lx * Math.cos(tilt) - ly * Math.sin(tilt)
      const y = lx * Math.sin(tilt) + ly * Math.cos(tilt)
      push(sx + x, sy + y, sz + lz, PINK, 0.03)
    }
  }

  // ── BACKGROUND STARS — sparse 3D shell wrapping the scene ──
  for (let i = 0; i < counts.stars; i++) {
    const a = Math.random() * Math.PI * 2
    const b = (Math.random() - 0.5) * Math.PI * 0.6
    const r = 9 + Math.random() * 5
    push(Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r * 0.8, Math.sin(a) * Math.cos(b) * r, WHITE, 0.02)
  }

  // Pad remainder hidden (alpha=0 via near-black colour)
  while (pts.length < n) {
    pts.push({ x: 0, y: 0, z: 0, color: [0, 0, 0] })
  }
  return pts.slice(0, n)
}

export default function DissolutionEffect() {
  const ref = useRef()

  const dissUniforms = useMemo(() => ({
    uTime:     { value: 0 },
    uProgress: { value: 0 },
    uShow:     { value: 0 },
    uMouse:    { value: new THREE.Vector2(0, 0) },
    uCenter:   { value: new THREE.Vector3(0, 46, -8) },
  }), [])

  // Smoothed mouse target so motion feels organic, not jittery
  const mouseTarget = useRef(new THREE.Vector2(0, 0))

  useEffect(() => {
    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth)  * 2 - 1
      const y = (e.clientY / window.innerHeight) * 2 - 1
      mouseTarget.current.set(x, -y)
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  const [positions, targets, portraitTargets, colors, phases, sizes] = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3)
    const tgt = new Float32Array(PARTICLE_COUNT * 3)
    const por = new Float32Array(PARTICLE_COUNT * 3)
    const col = new Float32Array(PARTICLE_COUNT * 3)
    const ph  = new Float32Array(PARTICLE_COUNT)
    const sz  = new Float32Array(PARTICLE_COUNT)

    // Start positions across Shiva's body
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const h = Math.random() * 11
      const r = Math.random() * 1.6
      const a = Math.random() * Math.PI * 2
      pos[i * 3]     = Math.cos(a) * r
      pos[i * 3 + 1] = h
      pos[i * 3 + 2] = Math.sin(a) * r

      const sa = Math.random() * Math.PI * 2
      const sb = (Math.random() - 0.5) * Math.PI * 0.7
      const sr = 18 + Math.random() * 32
      tgt[i * 3]     = Math.cos(sa) * Math.cos(sb) * sr
      tgt[i * 3 + 1] = Math.sin(sb) * sr * 0.6 + 6
      tgt[i * 3 + 2] = Math.sin(sa) * Math.cos(sb) * sr

      ph[i] = Math.random()
      sz[i] = 2.4 + Math.random() * 3.0
    }

    // Local-space coords (centred at origin); shader rotates and adds uCenter
    const SCALE = 11.0
    const facePts = shivaFacePoints(PARTICLE_COUNT)
    for (let i = facePts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[facePts[i], facePts[j]] = [facePts[j], facePts[i]]
    }
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const fp = facePts[i]
      por[i * 3]     = fp.x * SCALE
      por[i * 3 + 1] = fp.y * SCALE
      por[i * 3 + 2] = fp.z * SCALE
      col[i * 3]     = fp.color[0]
      col[i * 3 + 1] = fp.color[1]
      col[i * 3 + 2] = fp.color[2]
    }

    return [pos, tgt, por, col, ph, sz]
  }, [])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const p = scrollStore.progress

    const local = THREE.MathUtils.smoothstep(p, 0.80, 1.0)
    const show  = THREE.MathUtils.smoothstep(p, 0.78, 0.83)

    dissUniforms.uTime.value     = t
    dissUniforms.uProgress.value = local
    dissUniforms.uShow.value     = show
    // Smoothly chase the mouse target for buttery parallax
    dissUniforms.uMouse.value.lerp(mouseTarget.current, 0.06)
  })

  return (
    <group position={[0, 0.5, 0]}>
      <points ref={ref} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position"  args={[positions,        3]} />
          <bufferAttribute attach="attributes-aTarget"   args={[targets,          3]} />
          <bufferAttribute attach="attributes-aPortrait" args={[portraitTargets,  3]} />
          <bufferAttribute attach="attributes-aColor"    args={[colors,           3]} />
          <bufferAttribute attach="attributes-aPhase"    args={[phases,           1]} />
          <bufferAttribute attach="attributes-aSize"     args={[sizes,            1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={DISS_VERT}
          fragmentShader={DISS_FRAG}
          uniforms={dissUniforms}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  )
}
