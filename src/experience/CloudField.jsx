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
    // Anisotropic envelope — wider horizontally and squashed vertically so
    // the silhouette is wispy/elongated, not a perfect ball.
    vec2 c = vUv - 0.5;
    vec2 cs = vec2(c.x * 0.85, c.y * 1.55);   // squash Y to flatten
    float r = length(cs) * 2.0;
    float envelope = 1.0 - smoothstep(0.20, 1.05, r); // very soft, big feather

    // Noise — sample TWICE: once for shape, once to chew up the silhouette
    vec2 q = (vUv + vec2(uSeed * 7.31, uSeed * 3.17)) * 2.4 + uDrift * uTime;
    float n1 = fbm(q);
    float n2 = fbm(q * 2.1 + n1 * 0.9 + vec2(11.0, -3.0));
    float n  = n1 * 0.55 + n2 * 0.6;

    // Edge-eating mask: noise carves chunks out of the envelope so edges
    // are frilly and irregular instead of round.
    float edgeNoise = fbm(q * 1.3 + vec2(uSeed * 9.0, 0.0));
    float bite = smoothstep(0.05, 0.55, envelope * (0.55 + edgeNoise * 0.85));

    // Cloud body — low threshold + wide range = soft wisps, not hard blobs
    float clouds = smoothstep(0.30, 0.78, n);
    float a = clouds * bite * uOpacity;
    if (a < 0.012) discard;

    float light = smoothstep(0.28, 0.82, n);
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

// Scattered puff layout: clouds stay BELOW Shiva's chest (~y=2) so the
// hero figure remains clear above an ocean of cloud at every angle.
function buildPuffs() {
  const rand = mulberry32(0xC10D)
  const puffs = []

  // Far surround — bulk wrap-around horizon (kept low)
  for (let i = 0; i < 50; i++) {
    const theta = rand() * Math.PI * 2
    const r     = 22 + rand() * 48
    const y     = -6 + rand() * 7                  // -6..1 (under chest)
    const size  = 18 + rand() * 26
    puffs.push({
      pos: [Math.cos(theta) * r, y, Math.sin(theta) * r],
      size, seed: rand(),
      aspect: 1.6 + rand() * 1.4,
      drift: [(rand() - 0.5) * 0.02, (rand() - 0.5) * 0.02],
      yTint: THREE.MathUtils.clamp((y + 2) / 6, -1, 1),
      op: 0.55 + rand() * 0.30,
      parX: 2 + rand() * 6, parZ: 1 + rand() * 3,
    })
  }

  // Mid — closer puffs around the mountain flanks (still below chest)
  for (let i = 0; i < 26; i++) {
    const theta = rand() * Math.PI * 2
    const r     = 14 + rand() * 12
    const y     = -4 + rand() * 5                  // -4..1
    const size  = 10 + rand() * 14
    puffs.push({
      pos: [Math.cos(theta) * r, y, Math.sin(theta) * r],
      size, seed: rand(),
      aspect: 1.8 + rand() * 1.6,
      drift: [(rand() - 0.5) * 0.025, (rand() - 0.5) * 0.025],
      yTint: THREE.MathUtils.clamp((y + 2) / 5, -0.6, 0.6),
      op: 0.40 + rand() * 0.30,
      parX: 4 + rand() * 6, parZ: 1 + rand() * 3,
    })
  }

  // Low ground mist — wide thin sheets just above the snow
  for (let i = 0; i < 22; i++) {
    const theta = rand() * Math.PI * 2
    const r     = 10 + rand() * 35
    const y     = -7 + rand() * 4                  // -7..-3
    const size  = 26 + rand() * 30
    puffs.push({
      pos: [Math.cos(theta) * r, y, Math.sin(theta) * r],
      size, seed: rand(),
      aspect: 2.4 + rand() * 1.8,
      drift: [(rand() - 0.5) * 0.015, (rand() - 0.5) * 0.015],
      yTint: -0.6,
      op: 0.45 + rand() * 0.25,
      parX: 3 + rand() * 4, parZ: 1 + rand() * 2,
    })
  }

  // Sea-of-cloud belt — long horizon strips right under chest line
  for (let i = 0; i < 18; i++) {
    const theta = rand() * Math.PI * 2
    const r     = 28 + rand() * 35
    const y     = -1 + rand() * 2.5                // -1..1.5 (chest-line haze)
    const size  = 28 + rand() * 32
    puffs.push({
      pos: [Math.cos(theta) * r, y, Math.sin(theta) * r],
      size, seed: rand(),
      aspect: 3.0 + rand() * 2.0,                  // very long horizontal wisps
      drift: [(rand() - 0.5) * 0.018, (rand() - 0.5) * 0.008],
      yTint: 0.2,
      op: 0.30 + rand() * 0.25,
      parX: 5 + rand() * 5, parZ: 2 + rand() * 2,
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
      {/* Wide & flat — clouds, not balls. Aspect varies per puff. */}
      <planeGeometry args={[cfg.size * cfg.aspect, cfg.size * 0.45, 1, 1]} />
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
