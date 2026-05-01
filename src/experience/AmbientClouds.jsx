import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { themeStore } from '../theme/themeStore'
import { scrollStore } from '../scrollStore'

// ─────────────────────────────────────────────────────────────────────
// AmbientClouds — sparse billboard puffs scattered around Mount Kailash
// at varied depths and heights. Each puff is a soft radial-gradient
// sprite (procedural canvas texture, no asset). They drift slowly and
// parallax against the page scroll (closer puffs move further) so the
// scene feels alive without ever crowding Shiva or the mountain.
// ─────────────────────────────────────────────────────────────────────

function makeCloudTexture() {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  // 6 overlapping radial gradients form one airy puff
  const blobs = [
    { x: 0.50, y: 0.55, r: 0.46, a: 0.95 },
    { x: 0.34, y: 0.50, r: 0.32, a: 0.75 },
    { x: 0.66, y: 0.50, r: 0.34, a: 0.78 },
    { x: 0.42, y: 0.40, r: 0.26, a: 0.65 },
    { x: 0.58, y: 0.42, r: 0.28, a: 0.70 },
    { x: 0.50, y: 0.62, r: 0.22, a: 0.55 },
  ]
  ctx.clearRect(0, 0, size, size)
  blobs.forEach(b => {
    const g = ctx.createRadialGradient(
      b.x * size, b.y * size, 0,
      b.x * size, b.y * size, b.r * size,
    )
    g.addColorStop(0.0, `rgba(255,255,255,${b.a})`)
    g.addColorStop(0.5, `rgba(255,255,255,${b.a * 0.45})`)
    g.addColorStop(1.0, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  })
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  return tex
}

// Hand-tuned puff layout: keeps the front + centre clear so the
// mountain and Shiva are always readable.
//   pos: [x, y, z]   |   size: [w, h]   |   parallax: how strongly the
// cloud shifts with scroll (closer puffs higher value).
const PUFFS = [
  // Far-back distant haze layer (subtle)
  { pos: [-55,  4, -90], size: [70, 30], op: 0.45, par: 0.4 },
  { pos: [ 50,  6, -95], size: [80, 32], op: 0.40, par: 0.4 },
  { pos: [  0, 10,-110], size: [110,38], op: 0.35, par: 0.3 },

  // Mid-distance flanking the mountain
  { pos: [-42, -2, -55], size: [40, 22], op: 0.70, par: 0.9 },
  { pos: [ 44, -1, -58], size: [44, 24], op: 0.68, par: 0.9 },
  { pos: [-58,  6, -68], size: [50, 26], op: 0.55, par: 0.7 },
  { pos: [ 60,  8, -72], size: [52, 28], op: 0.55, par: 0.7 },

  // Closer puffs, low — wrap the lower slopes
  { pos: [-30, -4, -28], size: [22, 14], op: 0.78, par: 1.5 },
  { pos: [ 32, -5, -32], size: [26, 15], op: 0.75, par: 1.5 },
  { pos: [-40, -3, -38], size: [28, 16], op: 0.70, par: 1.4 },
  { pos: [ 42, -2, -42], size: [30, 17], op: 0.68, par: 1.4 },

  // Foreground wisps high up to frame the top corners (very thin)
  { pos: [-46, 22, -44], size: [32, 18], op: 0.32, par: 1.1 },
  { pos: [ 48, 24, -48], size: [34, 19], op: 0.30, par: 1.1 },
]

export default function AmbientClouds() {
  const groupRef = useRef()
  const themeT   = useRef(themeStore.current === 'light' ? 1 : 0)
  const texture  = useMemo(() => makeCloudTexture(), [])

  // Stable per-puff drift seeds so the scene doesn't reshuffle
  const seeds = useMemo(() => PUFFS.map((_, i) => ({
    phase: i * 1.37,
    speed: 0.06 + (i % 5) * 0.012,
  })), [])

  // Two palette extremes for puff tint
  const dark   = useMemo(() => new THREE.Color(0.78, 0.86, 1.00), [])
  const light  = useMemo(() => new THREE.Color(1.00, 0.84, 0.70), [])
  const tmp    = useMemo(() => new THREE.Color(),                 [])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    const p = scrollStore.progress

    // Theme blend
    const target = themeStore.current === 'light' ? 1 : 0
    themeT.current += (target - themeT.current) * 0.06

    // Parallax: one normalized "flow" value driven by scroll.
    // 0 → original X position, 1 → shifted by `par` units.
    const flow = (p - 0.5) * 2          // -1 .. 1 across the page

    groupRef.current.children.forEach((mesh, i) => {
      const seed = seeds[i]
      const cfg  = PUFFS[i]
      // X drifts gently AND parallaxes with scroll
      const driftX = Math.sin(t * seed.speed + seed.phase) * 1.4
      const driftY = Math.cos(t * seed.speed * 0.7 + seed.phase) * 0.6
      mesh.position.x = cfg.pos[0] + driftX - flow * cfg.par * 6
      mesh.position.y = cfg.pos[1] + driftY
      // Subtle theme tint
      tmp.copy(dark).lerp(light, themeT.current)
      mesh.material.color.copy(tmp)
    })
  })

  return (
    <group ref={groupRef} renderOrder={3}>
      {PUFFS.map((cfg, i) => (
        <sprite key={i} position={cfg.pos} scale={[cfg.size[0], cfg.size[1], 1]}>
          <spriteMaterial
            map={texture}
            transparent
            depthWrite={false}
            opacity={cfg.op}
            color={'#cfdcff'}
            sizeAttenuation
            fog
          />
        </sprite>
      ))}
    </group>
  )
}
