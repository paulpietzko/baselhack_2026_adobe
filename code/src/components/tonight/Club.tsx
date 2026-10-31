import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  MathUtils,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Group,
  type InstancedMesh,
  type Mesh,
  type PerspectiveCamera,
} from 'three'
import { H, canvasTexture } from '../acme/Venue'
import { nightSound } from '../../lib/nightSound'

type Vec3 = [number, number, number]

const LEVEL_OF = { entrance: 0, 'main-hall': 3, rooftop: 4 }
const pulse = () => (1 - (nightSound.beats() % 1)) ** 3

/** Lights fade with height: fakes light through haze without post-processing */
const beamMaterial = (opacity: number) =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    uniforms: { color: { value: new Color('#fff') }, strength: { value: opacity } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vN = normalMatrix * normal;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    // Fades along its length and towards its edges, so a cone reads as light in haze
    fragmentShader: `
      uniform vec3 color; uniform float strength; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
        gl_FragColor = vec4(color, pow(vUv.y, 1.6) * edge * strength);
      }`,
  })

function Beam({ at, length, spread, color, strength, speed = 0.7, phase = 0 }: { at: Vec3; length: number; spread: number; color: string; strength: number; speed?: number; phase?: number }) {
  const ref = useRef<Mesh>(null!)
  const material = useMemo(() => beamMaterial(strength), [strength])
  const target = useMemo(() => new Color(color), [color])
  // Pivots at its tip, up in the rig
  const geometry = useMemo(() => new CylinderGeometry(0.02, spread, length, 20, 1, true).translate(0, -length / 2, 0), [spread, length])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime * speed + phase
    ref.current.rotation.z = Math.sin(t) * 0.55
    ref.current.rotation.x = Math.cos(t * 0.8) * 0.35
    ;(material.uniforms.color.value as Color).lerp(target, 1 - Math.exp(-5 * dt))
    material.uniforms.strength.value = strength * (0.55 + 0.45 * pulse())
  })
  return (
    <group position={at}>
      <mesh ref={ref} material={material} geometry={geometry} />
    </group>
  )
}

/** LED wall behind the DJ, pulsing with the kick */
function LedWall({ color, at, width }: { color: string; at: Vec3; width: number }) {
  const target = useMemo(() => new Color(color), [color])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        toneMapped: false,
        uniforms: { t: { value: 0 }, beat: { value: 0 }, color: { value: new Color(color) } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `
          uniform float t; uniform float beat; uniform vec3 color; varying vec2 vUv;
          void main() {
            vec2 cell = fract(vUv * vec2(90.0, 40.0)) - 0.5;
            float led = smoothstep(0.5, 0.2, length(cell));
            vec2 id = floor(vUv * vec2(90.0, 40.0)) / vec2(90.0, 40.0);
            float d = length((id - 0.5) * vec2(2.2, 1.0));
            float rings = sin(d * 26.0 - t * 5.0) * 0.5 + 0.5;
            float bars = step(id.y, 0.25 + 0.5 * abs(sin(id.x * 22.0 + t * 1.4)) * (0.4 + 0.6 * beat));
            float v = max(rings * rings * (0.25 + 0.75 * beat), bars * 0.75);
            gl_FragColor = vec4(mix(color, vec3(1.0), v * 0.25) * v * led * 1.7, 1.0);
          }`,
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )
  useFrame(({ clock }, dt) => {
    material.uniforms.t.value = clock.elapsedTime
    material.uniforms.beat.value = pulse()
    ;(material.uniforms.color.value as Color).lerp(target, 1 - Math.exp(-5 * dt))
  })
  return (
    <mesh position={at} material={material}>
      <planeGeometry args={[width, 2.2]} />
    </mesh>
  )
}

/** Small seeded generator, so the crowd stands in the same place every time */
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}

const body = new CapsuleGeometry(0.135, 0.8, 3, 10)
const head = new SphereGeometry(0.1, 12, 10)
const arm = new CapsuleGeometry(0.026, 0.42, 2, 6)
// Silhouettes: the room's light catches their edges, the LED wall sits behind them
const clothes = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 })
const hair = new MeshStandardMaterial({ color: '#171218', roughness: 0.6 })
const OUTFIT_TONES = ['#1d1a24', '#2c141c', '#141c2a', '#182420', '#2c2230', '#3a2028']

/** The people who are already there, moving to the music */
function Crowd({ y, count, area, keepClear, seed }: { y: number; count: number; area: [number, number, number, number]; keepClear: boolean; seed: number }) {
  const bodies = useRef<InstancedMesh>(null!)
  const heads = useRef<InstancedMesh>(null!)
  const arms = useRef<InstancedMesh>(null!)
  const people = useMemo(() => {
    const rand = seeded(seed)
    return Array.from({ length: count }, () => ({
      x: MathUtils.lerp(area[0], area[2], rand()),
      z: MathUtils.lerp(area[1], area[3], rand()),
      height: 0.92 + rand() * 0.16,
      phase: rand() * 2,
      sway: 0.4 + rand() * 0.8,
      turn: rand() * 0.8 - 0.4,
      // Some have their hands up, the way a crowd does
      hands: rand() > 0.72,
    }))
  }, [count, area, seed])
  const dummy = useMemo(() => new Object3D(), [])

  useEffect(() => {
    const color = new Color()
    people.forEach((_, i) => bodies.current.setColorAt(i, color.set(OUTFIT_TONES[i % OUTFIT_TONES.length])))
    bodies.current.instanceColor!.needsUpdate = true
  }, [people])

  useFrame(() => {
    const beats = nightSound.beats()
    people.forEach((p, i) => {
      const hop = Math.abs(Math.sin((beats + p.phase) * Math.PI)) * 0.06
      const lean = Math.sin(((beats + p.phase) * Math.PI) / 2) * 0.05 * p.sway
      // Room is made in the middle of the floor when the crew steps out to try a look
      const scale = keepClear && p.z > -0.35 && p.x > -3 && p.x < 1 ? 0.0001 : p.height
      const place = (mesh: InstancedMesh, index: number, px: number, py: number, rz = 0) => {
        dummy.position.set(px, y + py * scale + hop, p.z)
        dummy.rotation.set(0, p.turn, rz)
        dummy.scale.setScalar(scale)
        dummy.updateMatrix()
        mesh.setMatrixAt(index, dummy.matrix)
      }
      place(bodies.current, i, p.x + lean, 0.64)
      place(heads.current, i, p.x + lean * 1.5, 1.33)
      const lift = p.hands ? 2.95 + Math.sin((beats + p.phase) * Math.PI) * 0.1 : 0.14
      const armY = p.hands ? 1.36 : 0.86
      place(arms.current, i * 2, p.x + lean - 0.15, armY, -lift)
      place(arms.current, i * 2 + 1, p.x + lean + 0.15, armY, lift)
    })
    bodies.current.instanceMatrix.needsUpdate = true
    heads.current.instanceMatrix.needsUpdate = true
    arms.current.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={bodies} args={[body, clothes, count]} frustumCulled={false} />
      <instancedMesh ref={heads} args={[head, hair, count]} frustumCulled={false} />
      <instancedMesh ref={arms} args={[arm, hair, count * 2]} frustumCulled={false} />
    </>
  )
}

/** Black box around an open indoor floor: once you're in, the city goes away */
function Enclosure({ y, divider }: { y: number; divider?: number }) {
  const walls: [Vec3, Vec3, [number, number]][] = [
    ...(divider ? ([[[divider, y + 1.17, 0], [0, -Math.PI / 2, 0], [5.2, 2.36]]] as [Vec3, Vec3, [number, number]][]) : []),
    [[0, y + 1.17, -2.56], [0, 0, 0], [7.2, 2.36]],
    [[-3.56, y + 1.17, 0], [0, Math.PI / 2, 0], [5.2, 2.36]],
    [[3.56, y + 1.17, 0], [0, -Math.PI / 2, 0], [5.2, 2.36]],
    [[0, y + 2.34, 0], [Math.PI / 2, 0, 0], [7.2, 5.2]],
  ]
  return (
    <>
      {walls.map(([position, rotation, size], i) => (
        <mesh key={i} position={position} rotation={rotation}>
          <planeGeometry args={size} />
          <meshStandardMaterial color="#0c0a10" roughness={0.9} side={DoubleSide} />
        </mesh>
      ))}
    </>
  )
}

const BULBS = 14

/** Warm string lights over the terrace */
function StringLights({ y }: { y: number }) {
  const ref = useRef<InstancedMesh>(null!)
  useEffect(() => {
    const m = new Matrix4()
    let n = 0
    ;[-1.7, -0.7, 0.3].forEach((z) => {
      for (let i = 0; i < BULBS; i++) {
        const k = i / (BULBS - 1)
        m.setPosition(MathUtils.lerp(-3.4, 1, k), y + 2.45 - Math.sin(k * Math.PI) * 0.3, z)
        ref.current.setMatrixAt(n++, m)
      }
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [y])
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, BULBS * 3]}>
        <sphereGeometry args={[0.018, 8, 6]} />
        <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
      </instancedMesh>
      <pointLight position={[-1.2, y + 2.1, 0.2]} intensity={7} distance={7} color="#ffc680" />
    </>
  )
}

/** Dark facade with lit windows for the offices between the club's floors */
function useWindows() {
  return useMemo(() => {
    const rand = seeded(7)
    const texture = canvasTexture(512, 128, (g) => {
      g.fillStyle = '#0f0e14'
      g.fillRect(0, 0, 512, 128)
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 16; col++) {
          const lit = rand()
          g.fillStyle = lit > 0.62 ? (lit > 0.85 ? '#ffd9a0' : '#c98f58') : '#1d1c26'
          g.fillRect(col * 32 + 4, row * 42 + 7, 24, 28)
        }
    })
    texture.wrapS = texture.wrapT = RepeatWrapping
    return texture
  }, [])
}

function radialGlow() {
  return canvasTexture(256, 256, (g) => {
    const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    rg.addColorStop(0, 'rgba(255,255,255,.75)')
    rg.addColorStop(0.5, 'rgba(255,255,255,.18)')
    rg.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = rg
    g.fillRect(0, 0, 256, 256)
  })
}

/** Light spilling onto the street, which roots a 3D model in the map below it */
export function GroundGlow({ show, color, radius, y = -0.26 }: { show: boolean; color: string; radius: number; y?: number }) {
  const ref = useRef<MeshBasicMaterial>(null!)
  const map = useMemo(radialGlow, [])
  useFrame((_, dt) => {
    ref.current.opacity = MathUtils.damp(ref.current.opacity, show ? 0.45 + 0.35 * pulse() : 0, 3, dt)
  })
  return (
    <mesh position-y={y} rotation-x={-Math.PI / 2} scale={radius}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial ref={ref} map={map} color={color} opacity={0} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </mesh>
  )
}

/** Sky beams that say "here" from across the city */
export function Searchlights({ show, color, spots }: { show: boolean; color: string; spots: Vec3[] }) {
  const ref = useRef<Group>(null!)
  useFrame((_, dt) => {
    const s = MathUtils.damp(ref.current.scale.y, show ? 1 : 0.001, 2.5, dt)
    ref.current.scale.y = s
    ref.current.visible = s > 0.02
  })
  return (
    <group ref={ref} scale-y={0.001}>
      {spots.map((at, i) => (
        <group key={i} rotation-x={Math.PI}>
          <Beam at={[at[0], -at[1], -at[2]]} length={34} spread={1.5} color={color} strength={0.22} speed={0.28} phase={i * 2.1} />
        </group>
      ))}
    </group>
  )
}

/** Everything that makes Hafenlicht a night out instead of a floor plan */
export function ClubNight({ built, open, color, keepClear }: { built: boolean; open: string | null; color: string; keepClear: boolean }) {
  const windows = useWindows()
  const neon = useMemo(() => new MeshBasicMaterial({ color, toneMapped: false }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const target = useMemo(() => new Color(color), [color])
  const openLevel = open ? LEVEL_OF[open as keyof typeof LEVEL_OF] : null
  const above = (level: number) => openLevel !== null && level > openLevel
  useFrame((_, dt) => {
    neon.color.lerp(target, 1 - Math.exp(-5 * dt))
  })
  const stripes = [0, 1, 2, 3, 4].filter((l) => !above(l))
  const mainY = LEVEL_OF['main-hall'] * H
  const roofY = LEVEL_OF.rooftop * H
  return (
    <group visible={built}>
      {[1, 2].filter((l) => !above(l)).map((l) => (
        <mesh key={l} position-y={l * H + 1.175}>
          <boxGeometry args={[7.3, 2.36, 5.3]} />
          <meshBasicMaterial map={windows} toneMapped={false} />
        </mesh>
      ))}
      {/* One neon line around every storey */}
      {stripes.map((l) => (
        <NeonRing key={l} y={l * H - 0.05} material={neon} />
      ))}

      {!above(3) && (
        <>
          <Crowd y={mainY} count={44} area={[-3.3, -1.4, 1.2, 0.35]} keepClear={keepClear} seed={11} />
          <LedWall color={color} at={[-1, mainY + 1.14, -2.5]} width={5} />
          <Beam at={[-2.4, mainY + 2.3, -0.4]} length={2.5} spread={0.7} color={color} strength={0.5} />
          <Beam at={[-1, mainY + 2.3, -1]} length={2.5} spread={0.7} color="#ffffff" strength={0.28} speed={1.1} phase={1} />
          <Beam at={[0.4, mainY + 2.3, -0.4]} length={2.5} spread={0.7} color={color} strength={0.5} phase={2.2} />
          <pointLight position={[-1, mainY + 1.4, -1.9]} intensity={9} distance={7} color={color} />
        </>
      )}
      {open === 'main-hall' && <Enclosure y={mainY} divider={1.42} />}
      {open === 'entrance' && <Enclosure y={0} />}

      <Crowd y={roofY} count={18} area={[-3.2, -1.2, 0.8, 0.3]} keepClear={keepClear} seed={29} />
      <StringLights y={roofY} />
    </group>
  )
}

function NeonRing({ y, material }: { y: number; material: MeshBasicMaterial }) {
  const sides: [Vec3, Vec3][] = [
    [[0, y, 2.68], [7.42, 0.06, 0.06]],
    [[0, y, -2.68], [7.42, 0.06, 0.06]],
    [[3.68, y, 0], [0.06, 0.06, 5.42]],
    [[-3.68, y, 0], [0.06, 0.06, 5.42]],
  ]
  return (
    <>
      {sides.map(([position, size], i) => (
        <mesh key={i} position={position} material={material}>
          <boxGeometry args={size} />
        </mesh>
      ))}
    </>
  )
}

/**
 * The camera behaves like your head: wider lens inside, a gentle look-around that follows the pointer,
 * and the whole picture shifts so the subject stays clear of the tiles.
 */
export function Lens({ fov, look, shift }: { fov: number; look: number; shift: number }) {
  const { camera, size } = useThree()
  const pointer = useRef({ x: 0, y: 0 })
  const eased = useRef({ x: 0, y: 0, shift: 0, look: 0 })
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])
  useFrame((_, dt) => {
    const cam = camera as PerspectiveCamera
    const e = eased.current
    e.x = MathUtils.damp(e.x, pointer.current.x, 2.4, dt)
    e.y = MathUtils.damp(e.y, pointer.current.y, 2.4, dt)
    e.look = MathUtils.damp(e.look, look, 2, dt)
    e.shift = MathUtils.damp(e.shift, shift, 2.4, dt)
    cam.fov = MathUtils.damp(cam.fov, fov, 2, dt)
    cam.setViewOffset(size.width, size.height, e.shift, 0, size.width, size.height)
    cam.rotateY(-e.x * e.look)
    cam.rotateX(-e.y * e.look * 0.5)
  })
  return null
}

const projected = new Vector3()

/** Keeps DOM labels pinned to points in the 3D world */
export function Anchors({ points, elements, show }: { points: Record<string, Vec3>; elements: RefObject<Record<string, HTMLElement | null>>; show: boolean }) {
  const { camera, size } = useThree()
  useFrame(() => {
    Object.entries(points).forEach(([id, p]) => {
      const el = elements.current[id]
      if (!el) return
      projected.set(...p).project(camera)
      el.style.transform = `translate(${((projected.x + 1) / 2) * size.width}px, ${((1 - projected.y) / 2) * size.height}px) translate(-100%, -50%)`
      el.style.opacity = show ? '1' : '0'
      el.style.pointerEvents = show ? 'auto' : 'none'
    })
  })
  return null
}
