import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { themeStore } from '../theme/themeStore'
import { scrollStore } from '../scrollStore'

// ─────────────────────────────────────────────────────────────────────
// CloudCarpet — a vanta.js-style cloud layer wrapped around the base of
// Mount Kailash. A horizontal plane sampled with multi-octave value
// noise produces soft, drifting puffs. A radial mask hollows out a
// circle around the mountain so the peaks remain visible. Two palettes
// (moonlit dark / sunset light) blend with a third theme uniform that
// is animated whenever the theme changes.
// ─────────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorld;

  uniform float uTime;
  uniform float uTheme;       // 0 = dark/moonlit, 1 = sunset/light
  uniform vec3  uTopDark;
  uniform vec3  uBaseDark;
  uniform vec3  uTopLight;
  uniform vec3  uBaseLight;
  uniform vec3  uShadow;

  // Hash + value noise (cheap, tileable enough for slow drift)
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.55;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p = rot * p * 2.05;
      a *= 0.55;
    }
    return v;
  }

  void main() {
    // Drift the whole field slowly + offset second octave so puffs roil
    vec2 q = vUv * 6.0;
    vec2 drift = vec2(uTime * 0.012, uTime * 0.008);
    float n1 = fbm(q + drift);
    float n2 = fbm(q * 1.7 - drift * 1.4 + n1 * 0.6);
    float clouds = smoothstep(0.35, 0.85, n1 * 0.6 + n2 * 0.7);

    // Radial mask: hollow out the centre (where the mountain stands) and
    // fade out the edges so the carpet doesn't end in a hard line.
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;            // 0 at centre, 1 at corners
    float innerHole  = smoothstep(0.18, 0.42, r);
    float outerFade  = 1.0 - smoothstep(0.78, 1.0, r);
    float mask = innerHole * outerFade;

    // Two palettes
    vec3 dark   = mix(uBaseDark,  uTopDark,  clouds);
    vec3 sunset = mix(uBaseLight, uTopLight, clouds);
    vec3 col    = mix(dark, sunset, uTheme);

    // Subtle self-shadow on the underside of each puff
    float shadow = smoothstep(0.45, 0.15, n2);
    col = mix(col, uShadow, shadow * 0.18);

    float a = clouds * mask;
    // Softer at the very edges so they melt away
    a *= smoothstep(0.0, 0.25, mask);

    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a);
  }
`

export default function CloudCarpet() {
  const matRef    = useRef()
  const meshRef   = useRef()
  const themeRef  = useRef(themeStore.current === 'light' ? 1 : 0)

  const uniforms = useMemo(() => ({
    uTime:      { value: 0 },
    uTheme:     { value: themeStore.current === 'light' ? 1 : 0 },
    // Moonlit night — cool blue-whites
    uTopDark:   { value: new THREE.Color(0.78, 0.85, 1.00) },
    uBaseDark:  { value: new THREE.Color(0.22, 0.30, 0.55) },
    // Sunset — warm peach over deep magenta
    uTopLight:  { value: new THREE.Color(1.00, 0.86, 0.66) },
    uBaseLight: { value: new THREE.Color(0.92, 0.42, 0.40) },
    uShadow:    { value: new THREE.Color(0.10, 0.05, 0.18) },
  }), [])

  useFrame(({ clock }) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value = clock.getElapsedTime()
    // Smoothly cross-fade theme so the toggle feels filmic
    const target = themeStore.current === 'light' ? 1 : 0
    themeRef.current += (target - themeRef.current) * 0.06
    matRef.current.uniforms.uTheme.value = themeRef.current
    // Parallax: shift the carpet horizontally with scroll. Tiny offset
    // is enough — the field is so large the eye reads it as movement.
    if (meshRef.current) {
      const flow = (scrollStore.progress - 0.5) * 2
      meshRef.current.position.x = -flow * 4
      meshRef.current.position.z = -10 + flow * 2
    }
  })

  // The plane sits just above the snow ground (which is at y=-8). Pushing
  // it to y=-6.4 means looking from above we see clouds first, floor only
  // through the hole the mask carves around the mountain.
  return (
    <mesh
      ref={meshRef}
      position={[0, -6.4, -10]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={2}
    >
      <planeGeometry args={[420, 320, 1, 1]} />
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
