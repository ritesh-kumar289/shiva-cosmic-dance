// ──────────────────────────────────────────────────────────────────────────────
// CosmicParticles — cinematic multi-layer star field + nebula + mouse parallax.
// Three depth layers (far / mid / near) + colorful nebula clusters.
// Each layer reacts to mouse at a different strength so the scene feels 3D.
// ──────────────────────────────────────────────────────────────────────────────
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const COUNT_FAR    = 3000
const COUNT_MID    = 600
const COUNT_NEAR   = 150
const COUNT_NEBULA = 500
const TOTAL = COUNT_FAR + COUNT_MID + COUNT_NEAR + COUNT_NEBULA

const VERT = /* glsl */`
attribute float aSize;
attribute float aPhase;
attribute vec3  aColor;
attribute float aDepth;

uniform float uTime;
uniform vec2  uMouse;
varying vec3  vColor;
varying float vAlpha;
varying float vDepth;

void main() {
  vColor = aColor;
  vDepth = aDepth;
  float twinkle = sin(uTime * 1.6 + aPhase * 6.28318) * 0.35 + 0.65;
  vAlpha = twinkle;

  /* Mouse parallax — near stars move more */
  vec3 pos = position;
  pos.x += uMouse.x * aDepth * 28.0;
  pos.y += uMouse.y * aDepth * 22.0;
  pos.z -= uMouse.x * aDepth *  6.0;

  vec4 mvPos   = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = aSize * (260.0 / -mvPos.z);
  gl_Position  = projectionMatrix * mvPos;
}
`
const FRAG = /* glsl */`
precision highp float;
varying vec3  vColor;
varying float vAlpha;
varying float vDepth;

void main() {
  vec2  c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;

  float edge = mix(0.40, 0.18, vDepth);
  float soft  = 1.0 - smoothstep(edge, 0.5, d);
  float core  = 1.0 - smoothstep(0.0, 0.12, d);
  float alpha = soft + core * vDepth * 0.6;
  gl_FragColor = vec4(vColor, alpha * vAlpha);
}
`

export default function CosmicParticles() {
  const uniforms = useMemo(() => ({
    uTime:  { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
  }), [])

  const mouseTarget = useRef(new THREE.Vector2(0, 0))

  useEffect(() => {
    const onMove = (e) => {
      mouseTarget.current.set(
        (e.clientX / window.innerWidth)  * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      )
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  const [pos, sizes, phases, colors, depths] = useMemo(() => {
    const p   = new Float32Array(TOTAL * 3)
    const s   = new Float32Array(TOTAL)
    const ph  = new Float32Array(TOTAL)
    const col = new Float32Array(TOTAL * 3)
    const dep = new Float32Array(TOTAL)
    let idx = 0

    /* ── FAR LAYER ─────────────────────────────────────────── */
    for (let i = 0; i < COUNT_FAR; i++, idx++) {
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const r     = 240 + Math.random() * 120
      p[idx*3]   = r * Math.sin(phi) * Math.cos(theta)
      p[idx*3+1] = r * Math.sin(phi) * Math.sin(theta) - 10
      p[idx*3+2] = r * Math.cos(phi)
      s[idx]  = 0.4 + Math.random() * 1.6
      ph[idx] = Math.random()
      dep[idx] = 0.0
      const t = Math.random()
      if      (t < 0.06) { col[idx*3]=0.45; col[idx*3+1]=0.60; col[idx*3+2]=1.00 }
      else if (t < 0.10) { col[idx*3]=1.00; col[idx*3+1]=0.85; col[idx*3+2]=0.40 }
      else               { const w=0.80+Math.random()*0.20; col[idx*3]=w; col[idx*3+1]=w; col[idx*3+2]=w+0.06 }
    }

    /* ── MID LAYER ─────────────────────────────────────────── */
    for (let i = 0; i < COUNT_MID; i++, idx++) {
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const r     = 140 + Math.random() * 90
      p[idx*3]   = r * Math.sin(phi) * Math.cos(theta)
      p[idx*3+1] = r * Math.sin(phi) * Math.sin(theta) - 10
      p[idx*3+2] = r * Math.cos(phi)
      s[idx]  = 1.0 + Math.random() * 2.8
      ph[idx] = Math.random()
      dep[idx] = 0.35
      const t = Math.random()
      if      (t < 0.10) { col[idx*3]=0.40; col[idx*3+1]=0.60; col[idx*3+2]=1.00 }
      else if (t < 0.16) { col[idx*3]=1.00; col[idx*3+1]=0.80; col[idx*3+2]=0.30 }
      else               { const w=0.85+Math.random()*0.15; col[idx*3]=w; col[idx*3+1]=w; col[idx*3+2]=w+0.05 }
    }

    /* ── NEAR LAYER — bright large stars ──────────────────── */
    for (let i = 0; i < COUNT_NEAR; i++, idx++) {
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const r     = 80 + Math.random() * 55
      p[idx*3]   = r * Math.sin(phi) * Math.cos(theta)
      p[idx*3+1] = r * Math.sin(phi) * Math.sin(theta) - 5
      p[idx*3+2] = r * Math.cos(phi)
      s[idx]  = 2.5 + Math.random() * 5.0
      ph[idx] = Math.random()
      dep[idx] = 0.85
      const t = Math.random()
      if      (t < 0.22) { col[idx*3]=0.50; col[idx*3+1]=0.70; col[idx*3+2]=1.00 }
      else if (t < 0.38) { col[idx*3]=1.00; col[idx*3+1]=0.88; col[idx*3+2]=0.35 }
      else               { col[idx*3]=0.92; col[idx*3+1]=0.94; col[idx*3+2]=1.00 }
    }

    /* ── NEBULA CLUSTERS — scattered on far background sphere ─────────── */
    // Place clusters on a sphere shell at r=260-320 (same depth as far stars).
    // Previously they were at z=-160..-225 which put them INSIDE the scene.
    // Now they're part of the deep background and scattered in ALL directions.
    const nebPalettes = [
      [0.05, 0.10, 0.45],   // deep blue
      [0.40, 0.05, 0.50],   // purple-magenta
      [0.02, 0.28, 0.45],   // teal
      [0.50, 0.22, 0.02],   // amber
      [0.20, 0.10, 0.55],   // blue-violet
      [0.45, 0.02, 0.25],   // deep rose
      [0.02, 0.35, 0.30],   // green-teal
    ]
    // Predefined angular positions spread around the sphere
    const nebAngles = [
      [0.35, 0.55], [1.10, 0.30], [1.85, 0.70], [2.60, 0.40],
      [3.30, 0.60], [4.10, 0.25], [4.80, 0.75], [5.50, 0.45],
    ]
    for (let i = 0; i < COUNT_NEBULA; i++, idx++) {
      const nb     = nebAngles[i % nebAngles.length]
      const theta  = nb[0] + (Math.random() - 0.5) * 0.6   // scatter around base angle
      const phi    = Math.PI * nb[1] + (Math.random() - 0.5) * 0.4
      const r      = 260 + Math.random() * 70                // r=260..330, deep background
      const cx     = r * Math.sin(phi) * Math.cos(theta)
      const cy     = r * Math.sin(phi) * Math.sin(theta) - 10
      const cz     = r * Math.cos(phi)
      const spread = 60 + Math.random() * 60
      const ncol   = nebPalettes[i % nebPalettes.length]
      p[idx*3]   = cx + (Math.random() - 0.5) * spread
      p[idx*3+1] = cy + (Math.random() - 0.5) * spread * 0.7
      p[idx*3+2] = cz + (Math.random() - 0.5) * spread
      s[idx]  = 8.0 + Math.random() * 22.0
      ph[idx] = Math.random()
      dep[idx] = 0.08
      const bright = 0.12 + Math.random() * 0.28
      col[idx*3]   = ncol[0] * bright
      col[idx*3+1] = ncol[1] * bright
      col[idx*3+2] = ncol[2] * bright
    }

    return [p, s, ph, col, dep]
  }, [])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime()
    uniforms.uMouse.value.x += (mouseTarget.current.x - uniforms.uMouse.value.x) * 0.035
    uniforms.uMouse.value.y += (mouseTarget.current.y - uniforms.uMouse.value.y) * 0.035
  })

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pos,    3]} />
        <bufferAttribute attach="attributes-aSize"    args={[sizes,  1]} />
        <bufferAttribute attach="attributes-aPhase"   args={[phases, 1]} />
        <bufferAttribute attach="attributes-aColor"   args={[colors, 3]} />
        <bufferAttribute attach="attributes-aDepth"   args={[depths, 1]} />
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
