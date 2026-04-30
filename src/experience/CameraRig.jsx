import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { scrollStore } from '../scrollStore'

function lerp3(a, b, t) {
  return new THREE.Vector3(
    THREE.MathUtils.lerp(a.x, b.x, t),
    THREE.MathUtils.lerp(a.y, b.y, t),
    THREE.MathUtils.lerp(a.z, b.z, t),
  )
}

function easeInOutQuint(t) {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2
}

export default function CameraRig() {
  const { camera } = useThree()
  const { scene: mtnGLB } = useGLTF('/models/snow_mountain.glb')

  const rig = useMemo(() => {
    const box    = new THREE.Box3().setFromObject(mtnGLB)
    const size   = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const mScale  = 120 / (Math.max(size.x, size.z) || 1)
    const offZ    = -center.z
    const pk      = -8 + (box.max.y + (-box.min.y)) * mScale
    const sz      = (9.39 + offZ) * mScale + (-20)
    // Shiva is at world Y = pk - 1.5 (slightly buried to avoid floating)
    const feet    = pk - 1.5
    const mid     = feet + 6
    const head    = feet + 11
    const eye     = feet + 10.5
    const SX      = 3.5  // Shiva is shifted right by this much

    // CINEMATIC KEYFRAMES — each has a scroll position p, camera pos, and lookAt
    // Scene 1 dolly-in is smoothed: keyframes are evenly spaced and z progresses gently
    // so scrolling toward Shiva feels the same speed as scrolling away.
    const KF = [
      // ── SCENE 1: THE VOID — director-style cinematic intro ──
      // Push in from a wide reverential establishing shot, swing low, rise to a face close-up.
      { p: 0.000, pos: new THREE.Vector3( SX,      mid + 4,    34), look: new THREE.Vector3( SX, mid,      sz) }, // wide hero
      { p: 0.030, pos: new THREE.Vector3( SX - 7,  mid + 3,    26), look: new THREE.Vector3( SX, mid,      sz) }, // dolly-in left arc
      { p: 0.060, pos: new THREE.Vector3( SX - 9,  feet + 2,   20), look: new THREE.Vector3( SX, mid + 1,  sz) }, // low hero, looking up
      { p: 0.090, pos: new THREE.Vector3( SX + 6,  feet + 1,   17), look: new THREE.Vector3( SX, head - 1, sz) }, // swing right, low up-shot
      { p: 0.120, pos: new THREE.Vector3( SX + 4,  head + 0.5, 13), look: new THREE.Vector3( SX, head,     sz) }, // rise to face level
      { p: 0.150, pos: new THREE.Vector3( SX,      eye,         9), look: new THREE.Vector3( SX, eye,      sz) }, // close-up: eye-line
      { p: 0.180, pos: new THREE.Vector3( SX - 3,  eye + 0.4,   7), look: new THREE.Vector3( SX, eye,      sz) }, // tighter, slight off-axis
      { p: 0.205, pos: new THREE.Vector3( SX - 5,  mid + 1,    11), look: new THREE.Vector3( SX, mid + 1,  sz) }, // pull back, prep scene 2
      // ── SCENE 2: AWAKENING — reverential body shots, varied angles ──
      { p: 0.235, pos: new THREE.Vector3( SX + 9,  feet + 1,   16), look: new THREE.Vector3( SX, mid,      sz) }, // right side, hero low
      { p: 0.265, pos: new THREE.Vector3( SX + 14, feet - 1,   12), look: new THREE.Vector3( SX, head - 2, sz) }, // worm's-eye, dramatic up
      { p: 0.295, pos: new THREE.Vector3( SX + 4,  feet + 0.2, 10), look: new THREE.Vector3( SX, head,     sz) }, // close push-in to torso
      { p: 0.325, pos: new THREE.Vector3( SX - 11, mid - 1,    14), look: new THREE.Vector3( SX, mid + 1,  sz) }, // sweep to left side
      { p: 0.355, pos: new THREE.Vector3( SX - 14, eye - 0.3,  10), look: new THREE.Vector3( SX, eye,      sz) }, // 3/4 left face close
      { p: 0.385, pos: new THREE.Vector3( SX - 6,  head + 1,   16), look: new THREE.Vector3( SX, mid,      sz) }, // rise overhead, look down
      // ── BRIDGE 2→33 — gentle arc that sweeps from FRONT around to BEHIND the summit
      // (instead of teleporting through the figure in 0.04 of scroll)
      { p: 0.41, pos: new THREE.Vector3( SX+22, mid+2,    34),       look: new THREE.Vector3( SX, mid,      sz) },
      { p: 0.43, pos: new THREE.Vector3( SX+30, mid+2,    14),       look: new THREE.Vector3( SX, mid,      sz) },
      // ── SCENE 3: TANDAVA — CINEMATIC ORBIT ──
      { p: 0.46, pos: new THREE.Vector3( SX+28, mid+2,    sz+18),    look: new THREE.Vector3( SX, mid,   sz) },
      { p: 0.50, pos: new THREE.Vector3( SX+12, head+1,   sz-22),    look: new THREE.Vector3( SX, mid,   sz) },
      { p: 0.54, pos: new THREE.Vector3( SX,    head+2,   sz-30),    look: new THREE.Vector3( SX, mid-1, sz+5) },
      { p: 0.58, pos: new THREE.Vector3( SX-28, mid-2,    sz+20),    look: new THREE.Vector3( SX, mid,   sz) },
      { p: 0.62, pos: new THREE.Vector3( SX-6,  feet+1,   sz+26),    look: new THREE.Vector3( SX, head,  sz) },
      { p: 0.64, pos: new THREE.Vector3( SX,    eye+0.5,  sz+22),    look: new THREE.Vector3( SX, eye,   sz) },
      // ── SCENE 4: THIRD EYE ──
      { p: 0.66, pos: new THREE.Vector3( SX,    eye+0.3,  12+sz), look: new THREE.Vector3( SX, eye,   sz) },
      { p: 0.71, pos: new THREE.Vector3( SX+1,  eye+0.1,   8+sz), look: new THREE.Vector3( SX, eye,   sz) },
      { p: 0.76, pos: new THREE.Vector3( SX-12, eye+6,    32+sz), look: new THREE.Vector3( SX, mid,   sz) },
      { p: 0.80, pos: new THREE.Vector3( SX+6,  mid+4,    46),    look: new THREE.Vector3( SX, mid,   sz) },
      // ── SCENE 5: DISSOLUTION → COSMIC PORTRAIT ──
      // Portrait centred at world (SX, pk + 26, sz - 6); spans ≈ 35 wide × 45 tall after SCALE 5.6
      { p: 0.84, pos: new THREE.Vector3( SX,    mid+6,    58),    look: new THREE.Vector3( SX, mid,      sz)   },
      { p: 0.88, pos: new THREE.Vector3( SX-14, pk+22,    72),    look: new THREE.Vector3( SX, pk+22,    sz-2) },
      { p: 0.92, pos: new THREE.Vector3( SX,    pk+26,    78),    look: new THREE.Vector3( SX, pk+26,    sz-6) },
      // Pull back so the entire portrait fits in frame
      { p: 0.96, pos: new THREE.Vector3( SX,    pk+26,    96),    look: new THREE.Vector3( SX, pk+26,    sz-6) },
      { p: 1.00, pos: new THREE.Vector3( SX,    pk+26,   108),    look: new THREE.Vector3( SX, pk+26,    sz-6) },
    ]

    return { KF, pk, sz, feet, mid, head, eye }
  }, [mtnGLB])

  const currentPos  = useRef(rig.KF[0].pos.clone())
  const currentLook = useRef(rig.KF[0].look.clone())

  // ── DRAG-TO-ORBIT INTERACTIVITY ──
  // Hold the left mouse button anywhere and drag in any direction to swing the
  // camera around its current cinematic look-target. Releasing the mouse causes
  // the offset to decay back to the scripted path.
  const drag = useRef({
    active:    false,
    lastX:     0,
    lastY:     0,
    yaw:       0,   // accumulated horizontal drag (radians)
    pitch:     0,   // accumulated vertical   drag (radians)
    pan:       new THREE.Vector2(0, 0), // sideways pan offset (look-target shift)
  })
  useEffect(() => {
    const onDown = (e) => {
      // Only react to primary (left) button and ignore drags that start on UI
      if (e.button !== 0) return
      const tgt = e.target
      if (tgt && tgt.closest && tgt.closest('[data-ui], button, a, input, textarea')) return
      drag.current.active = true
      drag.current.lastX  = e.clientX
      drag.current.lastY  = e.clientY
      document.body.style.cursor = 'grabbing'
    }
    const onMove = (e) => {
      if (!drag.current.active) return
      const dx = e.clientX - drag.current.lastX
      const dy = e.clientY - drag.current.lastY
      drag.current.lastX = e.clientX
      drag.current.lastY = e.clientY
      // Sensitivity tuned for a gentle cinematic feel
      drag.current.yaw   += dx * 0.0045
      drag.current.pitch += dy * 0.0035
      // Clamp pitch asymmetrically: allow looking UP a lot, but only a little
      // DOWN so the user can't drag the camera underneath the mountain.
      // (Positive pitch = looking down here, negative = looking up.)
      drag.current.pitch = Math.max(-0.9, Math.min(0.18, drag.current.pitch))
      // Soft clamp yaw so we don't spin endlessly far from the scripted angle
      drag.current.yaw   = Math.max(-1.6, Math.min(1.6, drag.current.yaw))
    }
    const onUp = () => {
      drag.current.active = false
      document.body.style.cursor = ''
    }
    window.addEventListener('pointerdown',  onDown)
    window.addEventListener('pointermove',  onMove)
    window.addEventListener('pointerup',    onUp)
    window.addEventListener('pointercancel',onUp)
    window.addEventListener('blur',         onUp)
    return () => {
      window.removeEventListener('pointerdown',  onDown)
      window.removeEventListener('pointermove',  onMove)
      window.removeEventListener('pointerup',    onUp)
      window.removeEventListener('pointercancel',onUp)
      window.removeEventListener('blur',         onUp)
    }
  }, [])

  useFrame(({ clock }) => {
    const p = scrollStore.progress
    const t = clock.getElapsedTime()
    const { KF } = rig

    // Find surrounding keyframe pair
    let i0 = 0
    for (let i = KF.length - 1; i >= 0; i--) {
      if (p >= KF[i].p) { i0 = i; break }
    }
    const i1  = Math.min(i0 + 1, KF.length - 1)
    const span = KF[i1].p - KF[i0].p
    const loc  = span < 0.001 ? 1 : (p - KF[i0].p) / span
    const ease = easeInOutQuint(Math.max(0, Math.min(1, loc)))

    const targetPos  = lerp3(KF[i0].pos,  KF[i1].pos,  ease)
    const targetLook = lerp3(KF[i0].look, KF[i1].look, ease)

    // Subtle camera breathing for life
    targetPos.x += Math.sin(t * 0.18) * 0.3
    targetPos.y += Math.cos(t * 0.12) * 0.2

    // Tandava micro-shake
    const tandava = THREE.MathUtils.smoothstep(p, 0.42, 0.63)
    if (tandava > 0.1) {
      const s = tandava * 0.22
      targetPos.x += (Math.random() - 0.5) * s
      targetPos.y += (Math.random() - 0.5) * s * 0.5
    }

    // Third-eye blast violent camera shake
    const blastIn  = THREE.MathUtils.smoothstep(p, 0.68, 0.76)
    const blastOut = 1 - THREE.MathUtils.smoothstep(p, 0.75, 0.80)
    const blast    = blastIn * blastOut
    if (blast > 0.05) {
      const bs = blast * 1.8
      targetPos.x += (Math.random() - 0.5) * bs
      targetPos.y += (Math.random() - 0.5) * bs * 0.7
      targetPos.z += (Math.random() - 0.5) * bs * 0.5
    }

    const lerpSpd = 0.032 + tandava * 0.008
    currentPos.current.lerp(targetPos,  lerpSpd)
    currentLook.current.lerp(targetLook, lerpSpd * 1.4)

    // Apply drag-orbit on top of the cinematic position. When the user releases
    // the mouse, yaw/pitch decay back to zero so the script resumes seamlessly.
    if (!drag.current.active) {
      drag.current.yaw   *= 0.94
      drag.current.pitch *= 0.94
      if (Math.abs(drag.current.yaw)   < 0.0005) drag.current.yaw   = 0
      if (Math.abs(drag.current.pitch) < 0.0005) drag.current.pitch = 0
    }
    const yaw   = drag.current.yaw
    const pitch = drag.current.pitch
    let finalPos = currentPos.current
    if (yaw !== 0 || pitch !== 0) {
      // Orbit current position around the look target
      const offset = new THREE.Vector3().subVectors(currentPos.current, currentLook.current)
      // Yaw around world-up
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
      // Pitch around the right vector (perpendicular to offset and up)
      const right = new THREE.Vector3().crossVectors(offset, new THREE.Vector3(0, 1, 0)).normalize()
      if (right.lengthSq() > 0.0001) offset.applyAxisAngle(right, pitch)
      finalPos = new THREE.Vector3().addVectors(currentLook.current, offset)
    }

    // Hard floor: never let the camera dip below the mountain base, regardless
    // of how the user drags. rig.feet is roughly the Shiva foot / summit-base
    // height; we keep the camera at least a bit above that so the horizon
    // line is preserved and the user can't peek underneath the GLB.
    const minY = rig.feet - 1.5
    if (finalPos.y < minY) finalPos.y = minY

    camera.position.copy(finalPos)
    camera.lookAt(currentLook.current)
  })

  return null
}
