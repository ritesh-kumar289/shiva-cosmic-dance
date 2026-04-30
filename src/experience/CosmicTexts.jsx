import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { scrollStore } from '../scrollStore'

// ─────────────────────────────────────────────────────────────────────
// Particle-based 3D scene texts — Devanagari rasterised on canvas,
// then sampled at a SPARSE grid stride so glyphs read as luminous
// dot-art (not a solid filled fill). Mouse position drives a
// rippling dispersion through the dots so text "breathes" toward
// the cursor.
// ─────────────────────────────────────────────────────────────────────

const HINDI_FONT_STACK = '"Noto Sans Devanagari", "Mangal", "Nirmala UI", sans-serif'

// kind: 'main' big mantra • 'sub' sanskrit phrase • 'mantra' shorter chant • 'desc' meaning gloss
const ENTRIES = [
  // ── Scene 1 — VOID / OPENING — Pancakshara & Mahamantra ────────
  // Camera now sits much closer (z 7-34) so texts moved forward + tighter sides
  { kind: 'main',   text: 'ॐ नमः शिवाय',                                         range: [0.00, 0.20], pos: [-14, 26, -16], size: 4.0, color: [0.55, 0.85, 1.0] },
  { kind: 'sub',    text: 'पञ्चाक्षर मन्त्र',                                          range: [0.02, 0.20], pos: [ 14, 24, -16], size: 1.4, color: [0.45, 0.75, 1.0] },
  { kind: 'mantra', text: 'हर हर महादेव',                                          range: [0.04, 0.20], pos: [ 14, 20, -16], size: 1.2, color: [0.85, 0.92, 1.0] },
  { kind: 'desc',   text: 'अनादि • अनन्त • स्वयम्भू',                                range: [0.06, 0.20], pos: [-14, 21, -16], size: 0.9, color: [0.70, 0.85, 1.0] },

  // ── Scene 2 — AWAKENING — Rudra Gayatri ────────────────────────
  { kind: 'main',   text: 'रुद्राय नमः',                                              range: [0.22, 0.42], pos: [ 14, 28, -16], size: 3.5, color: [1.0, 0.78, 0.55] },
  { kind: 'sub',    text: 'तत्पुरुषाय विद्महे',                                          range: [0.24, 0.40], pos: [-15, 22, -16], size: 1.2, color: [1.0, 0.65, 0.45] },
  { kind: 'mantra', text: 'महादेवाय धीमहि',                                         range: [0.26, 0.40], pos: [-15, 19, -16], size: 1.1, color: [1.0, 0.90, 0.65] },
  { kind: 'desc',   text: 'तन्नो रुद्रः प्रचोदयात्',                                       range: [0.28, 0.40], pos: [-15, 16, -16], size: 0.95,color: [0.95, 0.80, 0.65] },
  { kind: 'mantra', text: 'सत्यं शिवं सुन्दरम्',                                         range: [0.30, 0.40], pos: [ 14, 18, -16], size: 1.05,color: [1.0, 0.80, 0.60] },

  // ── Scene 3 — TANDAVA — Nataraja & Shiva Tandava ───────────────
  { kind: 'main',   text: 'ॐ नटराजाय नमः',                                       range: [0.44, 0.62], pos: [-28, 44, -28], size: 6.5, color: [1.0, 0.55, 0.35] },
  { kind: 'sub',    text: 'जटाटवीगलज्जल',                                         range: [0.46, 0.60], pos: [ 28, 42, -28], size: 1.9, color: [1.0, 0.50, 0.30] },
  { kind: 'mantra', text: 'प्रवाहपावितस्थले',                                          range: [0.48, 0.60], pos: [ 28, 38, -28], size: 1.8, color: [1.0, 0.75, 0.50] },
  { kind: 'desc',   text: 'गलेऽवलम्ब्य लम्बितां',                                      range: [0.50, 0.60], pos: [-28, 38, -28], size: 1.3, color: [1.0, 0.70, 0.50] },
  { kind: 'mantra', text: 'डमड्डमड्डमड्डमन्निनादवड्डमर्वयम्',                         range: [0.52, 0.60], pos: [-28, 34, -28], size: 1.5, color: [1.0, 0.78, 0.55] },

  // ── Scene 4 — THIRD EYE — Mahamrityunjaya ──────────────────────
  { kind: 'main',   text: 'त्र्यम्बकं यजामहे',                                          range: [0.66, 0.78], pos: [ 26, 34, -18], size: 5.8, color: [1.0, 0.55, 0.55] },
  { kind: 'sub',    text: 'सुगन्धिं पुष्टिवर्धनम्',                                       range: [0.68, 0.78], pos: [-26, 32, -18], size: 1.8, color: [1.0, 0.50, 0.50] },
  { kind: 'mantra', text: 'उर्वारुकमिव बन्धनान्',                                      range: [0.70, 0.78], pos: [-26, 28, -18], size: 1.7, color: [1.0, 0.85, 0.75] },
  { kind: 'desc',   text: 'मृत्योर्मुक्षीय मामृतात्',                                       range: [0.72, 0.78], pos: [ 26, 30, -18], size: 1.4, color: [1.0, 0.75, 0.75] },
  { kind: 'mantra', text: 'महामृत्युञ्जय',                                              range: [0.74, 0.78], pos: [ 26, 26, -18], size: 1.6, color: [1.0, 0.70, 0.65] },

  // ── Scene 5 — DISSOLUTION / COSMOS — texts intentionally removed
  //    so the cosmic solar system reveals itself without overlay clutter.
]

// ── shader ────────────────────────────────────────────────────────
const VERT = /* glsl */`
attribute vec3  aOrigin;
attribute float aPhase;
uniform float uTime;
uniform float uAlpha;
uniform float uPointMul;
uniform vec2  uMouse;     // -1..1 normalized
uniform float uHover;     // 0..1 strength
varying float vAlpha;

void main() {
  vec3 p = aOrigin;

  // Per-dot shimmer — keeps gaps visible so glyphs never look solid
  p.x += sin(uTime * 1.4 + aPhase * 12.0) * 0.020;
  p.y += cos(uTime * 1.1 + aPhase * 9.0)  * 0.020;

  // Mouse-driven dispersion ripples through the dots
  vec2 dir = uMouse * uHover;
  float wave = sin(aPhase * 14.0 + uTime * 1.6) * 0.5 + 0.5;
  p.x += dir.x * (0.30 + wave * 0.45);
  p.y += dir.y * (0.30 + wave * 0.45);
  p.z += sin(aPhase * 9.0 + uTime * 0.8) * 0.05 * uHover;

  vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uPointMul * (110.0 / -mvPos.z);
  gl_Position  = projectionMatrix * mvPos;

  float twinkle = 0.65 + 0.35 * sin(uTime * 1.6 + aPhase * 6.28);
  vAlpha = uAlpha * twinkle;
}
`
const FRAG = /* glsl */`
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float core = 1.0 - smoothstep(0.0, 0.18, d);
  float halo = 1.0 - smoothstep(0.0, 0.5, d);
  float a = halo * 0.55 + core * 0.45;
  gl_FragColor = vec4(uColor, a * vAlpha);
}
`

// Sparse-stride sampler so glyphs stay obviously made of dots.
function sampleTextPoints(text, kind, sizeUnits) {
  const canvas = document.createElement('canvas')
  const fontPx = kind === 'main' ? 240 : kind === 'mantra' ? 150 : kind === 'sub' ? 140 : 100
  const ctx = canvas.getContext('2d')
  ctx.font = `700 ${fontPx}px ${HINDI_FONT_STACK}`
  const metrics = ctx.measureText(text)
  const padX = Math.ceil(fontPx * 0.4)
  const padY = Math.ceil(fontPx * 0.5)
  const w = Math.ceil(metrics.width) + padX * 2
  const h = Math.ceil(fontPx * 1.6) + padY
  canvas.width  = w
  canvas.height = h
  ctx.font         = `700 ${fontPx}px ${HINDI_FONT_STACK}`
  ctx.textBaseline = 'middle'
  ctx.textAlign    = 'left'
  ctx.fillStyle    = '#ffffff'
  ctx.fillText(text, padX, h / 2)

  const img = ctx.getImageData(0, 0, w, h).data

  // Bigger stride for big titles so they read as airy dot-art
  const stride = kind === 'main' ? 9 : kind === 'mantra' ? 7 : kind === 'sub' ? 7 : 6
  const pts = []
  for (let y = 0; y < h; y += stride) {
    for (let x = 0; x < w; x += stride) {
      const a = img[(y * w + x) * 4 + 3]
      if (a > 150) {
        const jx = (Math.random() - 0.5) * stride * 0.30
        const jy = (Math.random() - 0.5) * stride * 0.30
        pts.push((x + jx) - w / 2, (y + jy) - h / 2)
      }
    }
  }

  const scale = (sizeUnits * 1.4) / h
  const count = pts.length / 2
  const positions = new Float32Array(count * 3)
  const phases    = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3]     =  pts[i * 2]     * scale
    positions[i * 3 + 1] = -pts[i * 2 + 1] * scale
    positions[i * 3 + 2] =  (Math.random() - 0.5) * 0.20
    phases[i]            =  Math.random()
  }
  return { positions, phases }
}

function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

// Shared module-level mouse target; bound once.
const MOUSE = new THREE.Vector2(0, 0)
let _mouseBound = false
function bindMouse() {
  if (_mouseBound || typeof window === 'undefined') return
  _mouseBound = true
  window.addEventListener('pointermove', (e) => {
    MOUSE.set(
      (e.clientX / window.innerWidth)  * 2 - 1,
      -((e.clientY / window.innerHeight) * 2 - 1),
    )
  })
}

function CosmicTextParticles({ entry }) {
  const groupRef = useRef()
  const matRef   = useRef()

  const { positions, phases } = useMemo(
    () => sampleTextPoints(entry.text, entry.kind, entry.size),
    [entry.text, entry.kind, entry.size]
  )

  useEffect(bindMouse, [])

  const sizeBase = entry.kind === 'main'   ? 3.0
                 : entry.kind === 'mantra' ? 2.3
                 : entry.kind === 'sub'    ? 2.0
                 :                           1.5

  const uniforms = useMemo(() => ({
    uTime:     { value: 0 },
    uAlpha:    { value: 0 },
    uColor:    { value: new THREE.Color(entry.color[0], entry.color[1], entry.color[2]) },
    uPointMul: { value: sizeBase },
    uMouse:    { value: new THREE.Vector2(0, 0) },
    uHover:    { value: 0 },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [entry.color, entry.kind])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const p = scrollStore.progress
    const [a, b] = entry.range
    const fadeIn  = smoothstep(a - 0.04, a + (b - a) * 0.18, p)
    const fadeOut = 1 - smoothstep(a + (b - a) * 0.78, b + 0.02, p)
    const alpha   = Math.max(0, Math.min(fadeIn, fadeOut))

    if (matRef.current) {
      const u = matRef.current.uniforms
      u.uTime.value  = t
      u.uAlpha.value = alpha
      u.uMouse.value.lerp(MOUSE, 0.08)
      u.uHover.value = THREE.MathUtils.lerp(u.uHover.value, alpha, 0.05)
    }
    if (groupRef.current) {
      groupRef.current.position.y = entry.pos[1] + Math.sin(t * 0.4 + entry.pos[0] * 0.05) * 0.4
      groupRef.current.position.z = entry.pos[2] + (1 - alpha) * -6
    }
  })

  return (
    <group ref={groupRef} position={entry.pos}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <points frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            <bufferAttribute attach="attributes-aOrigin"  args={[positions, 3]} />
            <bufferAttribute attach="attributes-aPhase"   args={[phases,    1]} />
          </bufferGeometry>
          <shaderMaterial
            ref={matRef}
            vertexShader={VERT}
            fragmentShader={FRAG}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      </Billboard>
    </group>
  )
}

export default function CosmicTexts() {
  const lines = useMemo(() => ENTRIES, [])
  return (
    <group>
      {lines.map((e, i) => <CosmicTextParticles key={i} entry={e} />)}
    </group>
  )
}
