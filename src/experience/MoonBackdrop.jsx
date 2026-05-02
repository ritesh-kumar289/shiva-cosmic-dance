import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { themeStore } from '../theme/themeStore'

// ──────────────────────────────────────────────────────────────────────────────
// MoonBackdrop — large glowing sphere behind Shiva, like the reference image.
// Uses a procedural shader: fbm noise moon surface + fresnel rim glow.
// Responds to mouse: subtle parallax so it feels like a real object in 3D space.
// ──────────────────────────────────────────────────────────────────────────────

const VERT = /* glsl */`
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vUv      = uv;
  vNormal  = normalize(normalMatrix * normal);
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;

uniform float uTime;
uniform vec3  uCamPos;
uniform float uTheme;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1,0)), u.x),
    mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y
  );
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.55;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = rot * p * 2.13; a *= 0.50; }
  return v;
}

void main() {
  /* Moon surface via noise */
  vec2 uv   = vUv * 2.8;
  float n1  = fbm(uv);
  float n2  = fbm(uv * 2.2 + n1);
  float surf = n1 * 0.62 + n2 * 0.38;

  /* Crater-like dark patches */
  float crat = fbm(uv * 5.0 + 7.31);
  surf = max(0.0, surf - smoothstep(0.52, 0.38, crat) * 0.32);

  /* Moon palette: dark shadow / mid / bright highlight */
  vec3 moonDark  = vec3(0.06, 0.08, 0.16);
  vec3 moonMid   = vec3(0.30, 0.36, 0.52);
  vec3 moonLight = vec3(0.60, 0.66, 0.80);
  vec3 moonCol   = mix(moonDark, moonMid,  smoothstep(0.0, 0.55, surf));
  moonCol        = mix(moonCol,  moonLight, smoothstep(0.55, 1.0, surf));

  /* Fresnel rim glow */
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorldPos);
  float NdV     = max(0.0, dot(N, V));
  float fresnel = pow(1.0 - NdV, 3.0);

  /* Blue glow in dark mode, warm amber in light mode */
  vec3 rimDark  = vec3(0.28, 0.50, 1.00);
  vec3 rimLight = vec3(1.00, 0.75, 0.35);
  vec3 rimCol   = mix(rimDark, rimLight, uTheme);

  /* Outer halo: extra wide additive glow ring */
  float halo = pow(1.0 - NdV, 5.5);

  vec3 col = moonCol
           + rimCol * fresnel * 1.8
           + rimCol * halo    * 0.6;

  /* Limb darkening */
  col *= (0.65 + NdV * 0.35);

  /* Atmosphere-like edge brightness boost */
  col += rimCol * fresnel * 0.3;

  gl_FragColor = vec4(col, 1.0);
}
`

export default function MoonBackdrop({ shivaX = 3.5, shivaY = 17, shivaZ = -12 }) {
  const meshRef    = useRef()
  const matRef     = useRef()
  const themeT     = useRef(themeStore.current === 'light' ? 1 : 0)
  const mouseTgt   = useRef(new THREE.Vector2(0, 0))
  const mouseSmooth = useRef(new THREE.Vector2(0, 0))

  /* Moon rests at Shiva's body level, well behind */
  const moonBase = useMemo(
    () => new THREE.Vector3(shivaX, shivaY + 10, shivaZ - 65),
    [shivaX, shivaY, shivaZ]
  )

  const uniforms = useMemo(() => ({
    uTime:   { value: 0 },
    uCamPos: { value: new THREE.Vector3() },
    uTheme:  { value: 0 },
  }), [])

  useEffect(() => {
    const onMove = (e) => {
      mouseTgt.current.set(
        (e.clientX / window.innerWidth)  * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      )
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame(({ clock, camera }) => {
    if (!meshRef.current || !matRef.current) return
    const t = clock.getElapsedTime()

    uniforms.uTime.value = t
    uniforms.uCamPos.value.copy(camera.position)

    /* Theme */
    const tgt = themeStore.current === 'light' ? 1 : 0
    themeT.current += (tgt - themeT.current) * 0.05
    uniforms.uTheme.value = themeT.current

    /* Smooth mouse parallax */
    mouseSmooth.current.x += (mouseTgt.current.x - mouseSmooth.current.x) * 0.04
    mouseSmooth.current.y += (mouseTgt.current.y - mouseSmooth.current.y) * 0.04

    /* Moon drifts subtly with mouse — feels alive in 3D space */
    meshRef.current.position.x = moonBase.x + mouseSmooth.current.x * 3.5
    meshRef.current.position.y = moonBase.y + mouseSmooth.current.y * 2.5
    meshRef.current.position.z = moonBase.z

    /* Very slow axial rotation */
    meshRef.current.rotation.y = t * 0.008
    meshRef.current.rotation.z = t * 0.003
  })

  return (
    <mesh
      ref={meshRef}
      position={[moonBase.x, moonBase.y, moonBase.z]}
      renderOrder={-5}
    >
      {/* radius=40 makes it huge in the sky */}
      <sphereGeometry args={[40, 72, 72]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  )
}
