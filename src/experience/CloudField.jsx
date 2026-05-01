import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { themeStore } from '../theme/themeStore'
import { scrollStore } from '../scrollStore'

// ─────────────────────────────────────────────────────────────────────
// CloudField — vanta.js-style volumetric clouds rendered as multiple
// stacked horizontal noise sheets that completely surround the scene.
// Each layer is a large horizontal plane sampled with fbm noise, given
// a soft annular mask so the mountain and Shiva remain unobstructed.
// Layers parallax against the page scroll at different rates so the
// scene feels deep and alive.
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
  uniform float uDensity;       // 0..1: base coverage
  uniform float uScale;         // noise scale
  uniform float uHoleInner;     // inner mask radius (carve the centre out)
  uniform float uHoleOuter;     // outer fade
  uniform float uYTint;         // -1..1: lower layers darker, upper warmer
  uniform vec3  uColLow;        // shadow / valley colour
  uniform vec3  uColMid;        // bulk cloud colour
  uniform vec3  uColHi;         // sun-touched highlights
  uniform vec3  uColLowL;
  uniform vec3  uColMidL;
  uniform vec3  uColHiL;
  uniform vec2  uDrift;         // wind direction

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
    for(int i=0;i<6;i++){ v+=a*vnoise(p); p=rot*p*2.07; a*=0.55; }
    return v;
  }

  void main(){
    vec2 q = vUv * uScale + uDrift * uTime;
    float n1 = fbm(q);
    float n2 = fbm(q*1.7 + n1*0.8 + vec2(13.0,-7.0));
    float clouds = smoothstep(0.55 - uDensity*0.30, 0.95 - uDensity*0.20, n1*0.6 + n2*0.7);

    // Annular mask: hollow centre + soft outer fade
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float inner = smoothstep(uHoleInner - 0.10, uHoleInner + 0.18, r);
    float outer = 1.0 - smoothstep(uHoleOuter, 1.0, r);
    float mask  = inner * outer;

    // Lighting: lower noise = shadow, mid = body, peaks = highlight
    float light = smoothstep(0.30, 0.85, n2 * 0.55 + n1 * 0.55);
    vec3 dark   = mix(uColLow,  uColMid, light);
    dark        = mix(dark, uColHi, smoothstep(0.75, 1.0, light));
    vec3 sunset = mix(uColLowL, uColMidL, light);
    sunset      = mix(sunset, uColHiL, smoothstep(0.75, 1.0, light));
    vec3 col    = mix(dark, sunset, uTheme);

    // Subtle tint by altitude (lower layers cooler/heavier)
    col *= (1.0 + uYTint * (light - 0.5) * 0.25);

    float a = clouds * mask * uOpacity;
    a *= smoothstep(0.0, 0.22, mask);
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a);
  }
`

// Layer definitions — each is one horizontal noise sheet. Y-stacked from
// just above the snow ground up into the upper sky so the scene feels
// completely surrounded by cloud.
const LAYERS = [
  // y, size,      density, scale, holeIn, holeOut, drift,        opacity, parX, parZ, yTint
  // Base carpet — the dense floor of cloud, replaces previous CloudCarpet
  { y: -6.4, size: 460, density: 0.95, scale: 6.5, holeIn: 0.18, holeOut: 0.78, drift:[ 0.012, 0.008], op: 1.00, parX: 4, parZ: 2, yTint:-0.4 },
  // Mid-low ring — wraps lower slopes, sparse so peaks read clearly
  { y: -2.0, size: 380, density: 0.55, scale: 5.0, holeIn: 0.34, holeOut: 0.85, drift:[-0.009, 0.014], op: 0.65, parX: 6, parZ: 1, yTint:-0.2 },
  // Mid ring — flanks the mountain belly
  { y:  4.0, size: 360, density: 0.45, scale: 4.5, holeIn: 0.42, holeOut: 0.90, drift:[ 0.014,-0.006], op: 0.50, parX: 8, parZ: 2, yTint: 0.0 },
  // Upper ring — high cirrus catching the sun
  { y: 14.0, size: 340, density: 0.40, scale: 3.8, holeIn: 0.46, holeOut: 0.92, drift:[-0.011, 0.010], op: 0.40, parX:10, parZ: 3, yTint: 0.4 },
  // Cap — far above for downward looks (so looking from top there is cloud above & below)
  { y: 28.0, size: 320, density: 0.35, scale: 3.2, holeIn: 0.50, holeOut: 0.95, drift:[ 0.008, 0.013], op: 0.30, parX:12, parZ: 4, yTint: 0.6 },
]

function Layer({ cfg }) {
  const meshRef = useRef()
  const matRef  = useRef()
  const themeT  = useRef(themeStore.current === 'light' ? 1 : 0)

  const uniforms = useMemo(() => ({
    uTime:      { value: 0 },
    uTheme:     { value: themeStore.current === 'light' ? 1 : 0 },
    uOpacity:   { value: cfg.op },
    uDensity:   { value: cfg.density },
    uScale:     { value: cfg.scale },
    uHoleInner: { value: cfg.holeIn },
    uHoleOuter: { value: cfg.holeOut },
    uYTint:     { value: cfg.yTint },
    uDrift:     { value: new THREE.Vector2(cfg.drift[0], cfg.drift[1]) },
    // Moonlit cool palette: shadow → body → highlight
    uColLow:    { value: new THREE.Color(0.08, 0.12, 0.28) },
    uColMid:    { value: new THREE.Color(0.55, 0.66, 0.92) },
    uColHi:     { value: new THREE.Color(0.92, 0.96, 1.00) },
    // Sunset warm palette
    uColLowL:   { value: new THREE.Color(0.45, 0.18, 0.32) },
    uColMidL:   { value: new THREE.Color(0.98, 0.62, 0.50) },
    uColHiL:    { value: new THREE.Color(1.00, 0.92, 0.78) },
  }), [cfg])

  useFrame(({ clock }) => {
    if (!matRef.current || !meshRef.current) return
    matRef.current.uniforms.uTime.value = clock.getElapsedTime()
    const target = themeStore.current === 'light' ? 1 : 0
    themeT.current += (target - themeT.current) * 0.06
    matRef.current.uniforms.uTheme.value = themeT.current

    // Parallax with scroll — each layer drifts at its own rate
    const flow = (scrollStore.progress - 0.5) * 2
    meshRef.current.position.x =        -flow * cfg.parX
    meshRef.current.position.z = -10  +  flow * cfg.parZ
  })

  return (
    <mesh
      ref={meshRef}
      position={[0, cfg.y, -10]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={2}
    >
      <planeGeometry args={[cfg.size, cfg.size * 0.78, 1, 1]} />
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
  return (
    <group>
      {LAYERS.map((cfg, i) => <Layer key={i} cfg={cfg} />)}
    </group>
  )
}
