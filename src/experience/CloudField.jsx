import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { themeStore } from '../theme/themeStore'
import { scrollStore } from '../scrollStore'

// ─────────────────────────────────────────────────────────────────────
// CloudField — vanta.js-style scattered volumetric clouds.
// Many soft camera-facing puff billboards distributed in a cylindrical
// shell around the scene at every height (ground → above Shiva's head).
// Each puff carves its own organic shape with fbm noise — no rings, no
// central hole, just clouds surrounding the scene from all sides.
// ─────────────────────────────────────────────────────────────────────

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uTheme;
  uniform float uOpacity;
  uniform float uSeed;
  uniform float uYTint;
  uniform vec2  uDrift;
  uniform vec3  uColLow;  uniform vec3 uColMid;  uniform vec3 uColHi;
  uniform vec3  uColLowL; uniform vec3 uColMidL; uniform vec3 uColHiL;

  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float vnoise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
  }
  float fbm(vec2 p){
    float v=0.0, a=0.55;
    mat2 rot=mat2(0.8,-0.6,0.6,0.8);
    for(int i=0;i<5;i++){ v+=a*vnoise(p); p=rot*p*2.07; a*=0.55; }
    return v;
  }

  void main(){
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float puff = 1.0 - smoothstep(0.55, 1.0, r);   // soft circular envelope
    if (puff <= 0.0) discard;

    vec2 q = (vUv + vec2(uSeed * 7.31, uSeed * 3.17)) * 2.6 + uDrift * uTime;
    float n1 = fbm(q);
    float n2 = fbm(q * 1.9 + n1 * 0.7);
    float n  = n1 * 0.55 + n2 * 0.6;

    float clouds = smoothstep(0.42, 0.85, n);
    float a = clouds * puff * uOpacity;
    if (a < 0.01) discard;

    float light = smoothstep(0.30, 0.85, n);
    vec3 dark   = mix(uColLow,  uColMid, light);
    dark        = mix(dark, uColHi, smoothstep(0.78, 1.0, light));
    vec3 sunset = mix(uColLowL, uColMidL, light);
    sunset      = mix(sunset, uColHiL, smoothstep(0.78, 1.0, light));
    vec3 col    = mix(dark, sunset, uTheme);
    col *= (1.0 + uYTint * (light - 0.5) * 0.30);

    gl_FragColor = vec4(col, a);
  }
`

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Scattered puff layout: 4 zones (far surround, mid chest-height, low mist,
// high cirrus) — together they wrap the scene 360° from ground to high sky.
function buildPuffs() {
  const rand = mulberry32(0xC10D)
  const puffs = []

  // Far surround — bulk wrap-around horizon
  for (let i = 0; i < 42; i++) {
    const theta = rand() * Math.PI * 2
    const r     = 22 + rand() * 48
    const y     = -4 + rand() * 32
    const size  = 14 + rand() * 22
    puffs.push({
      pos: [Math.cos(theta) * r, y, Math.sin(theta) * r],
      size, seed: rand(),
      drift: [(rand() - 0.5) * 0.02, (rand() - 0.5) * 0.02],
      yTint: THREE.MathUtils.clamp((y - 8) / 16, -1, 1),
      op: 0.72 + rand() * 0.28,
      parX: 2 + rand() * 6, parZ: 1 + rand() * 3,
    })
  }

  // Mid — closer puffs at chest-to-head height
  for (let i = 0; i < 22; i++) {
    const theta = rand() * Math.PI * 2
    const r     = 14 + rand() * 12
    const y     = -2 + rand() * 12
    const size  = 8  + rand() * 12
    puffs.push({
      pos: [Math.cos(theta) * r, y, Math.sin(theta) * r],
      size, seed: rand(),
      drift: [(rand() - 0.5) * 0.025, (rand() - 0.5) * 0.025],
      yTint: THREE.MathUtils.clamp((y - 4) / 10, -0.6, 0.6),
      op: 0.55 + rand() * 0.30,
      parX: 4 + rand() * 6, parZ: 1 + rand() * 3,
    })
  }

  // Low ground mist — flat, just above snow
  for (let i = 0; i < 14; i++) {
    const theta = rand() * Math.PI * 2
    const r     = 10 + rand() * 35
    const y     = -6 + rand() * 3
    const size  = 22 + rand() * 26
    puffs.push({
      pos: [Math.cos(theta) * r, y, Math.sin(theta) * r],
      size, seed: rand(),
      drift: [(rand() - 0.5) * 0.015, (rand() - 0.5) * 0.015],
      yTint: -0.6,
      op: 0.55 + rand() * 0.25,
      parX: 3 + rand() * 4, parZ: 1 + rand() * 2,
    })
  }

  // High cirrus
  for (let i = 0; i < 16; i++) {
    const theta = rand() * Math.PI * 2
    const r     = 18 + rand() * 40
    const y     = 18 + rand() * 14
    const size  = 18 + rand() * 28
    puffs.push({
      pos: [Math.cos(theta) * r, y, Math.sin(theta) * r],
      size, seed: rand(),
      drift: [(rand() - 0.5) * 0.03, (rand() - 0.5) * 0.01],
      yTint: 0.8,
      op: 0.35 + rand() * 0.25,
      parX: 6 + rand() * 6, parZ: 2 + rand() * 3,
    })
  }

  return puffs
}

function Puff({ cfg }) {
  const meshRef = useRef()
  const matRef  = useRef()
  const themeT  = useRef(themeStore.current === 'light' ? 1 : 0)
  const basePos = useMemo(() => new THREE.Vector3(...cfg.pos), [cfg.pos])

  const uniforms = useMemo(() => ({
    uTime:    { value: 0 },
    uTheme:   { value: themeStore.current === 'light' ? 1 : 0 },
    uOpacity: { value: cfg.op },
    uSeed:    { value: cfg.seed },
    uYTint:   { value: cfg.yTint },
    uDrift:   { value: new THREE.Vector2(cfg.drift[0], cfg.drift[1]) },
    uColLow:  { value: new THREE.Color(0.10, 0.14, 0.30) },
    uColMid:  { value: new THREE.Color(0.55, 0.66, 0.92) },
    uColHi:   { value: new THREE.Color(0.95, 0.97, 1.00) },
    uColLowL: { value: new THREE.Color(0.45, 0.18, 0.32) },
    uColMidL: { value: new THREE.Color(0.98, 0.62, 0.50) },
    uColHiL:  { value: new THREE.Color(1.00, 0.92, 0.78) },
  }), [cfg])

  useFrame(({ clock, camera }) => {
    if (!matRef.current || !meshRef.current) return
    matRef.current.uniforms.uTime.value = clock.getElapsedTime()
    const target = themeStore.current === 'light' ? 1 : 0
    themeT.current += (target - themeT.current) * 0.06
    matRef.current.uniforms.uTheme.value = themeT.current

    const flow = (scrollStore.progress - 0.5) * 2
    meshRef.current.position.set(
      basePos.x - flow * cfg.parX,
      basePos.y,
      basePos.z + flow * cfg.parZ,
    )
    // Billboard towards camera so puffs always read as 3D volumes
    meshRef.current.lookAt(camera.position)
  })

  return (
    <mesh ref={meshRef} position={cfg.pos} renderOrder={2}>
      <planeGeometry args={[cfg.size, cfg.size * 0.7, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export default function CloudField() {
  const puffs = useMemo(() => buildPuffs(), [])
  return (
    <group>
      {puffs.map((cfg, i) => <Puff key={i} cfg={cfg} />)}
    </group>
  )
}
