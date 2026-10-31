import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useFrame, useThree, type ThreeElements, type ThreeEvent } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PMREMGenerator,
  Plane,
  Raycaster,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type AmbientLight,
  type DirectionalLight,
  type Group,
  type Mesh,
  type PointLight,
  type Points,
  type Ray,
  type Texture,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// wall color + matching upholstery
export const WALLS = {
  concrete: { wall: '#8f8d89', accent: '#6e2f3f' },
  brick: { wall: '#8e4b3d', accent: '#2f4f4a' },
  black: { wall: '#2c2c2e', accent: '#7a5c3a' },
  white: { wall: '#e5e3de', accent: '#2c2c2e' },
}
export const FLOORS = { concrete: '#9a9893', oak: '#8a6446', rubber: '#2f2f32' }
export const LIGHTS = { pink: '#ff2d55', blue: '#0a84ff', purple: '#bf5af2', orange: '#ff9f0a' }
export const AREAS = { bar: 'Bar', lounge: 'Lounge', coat: 'Coat check', ball: 'Disco ball', lasers: 'Lasers' }

export type Area = keyof typeof AREAS
export type Zone = 'dancefloor' | 'booth' | 'bar' | 'lounge' | 'coat'
export type ClubConfig = {
  wall: keyof typeof WALLS
  floor: keyof typeof FLOORS
  light: keyof typeof LIGHTS
  areas: Area[]
  /** Floorplan: x/z position of each zone in meters-ish */
  layout: Record<Zone, [number, number]>
}

type Vec3 = [number, number, number]
type Hover = (label: string | null, e?: ThreeEvent<PointerEvent>) => void
type Drag = ((zone: Zone, obj: Group, ray: Ray) => void) | null

// progress (0–1) drives the assembly while scanning, hover feeds the DOM label, drag moves zones
const Ctx = createContext<{ progress: number; hover: Hover; drag: Drag }>({ progress: 1, hover: () => {}, drag: null })

// Party state shared by everything that glows, eased each frame in <Lights>
const fx = { party: 0, color: new Color(LIGHTS.pink) }
const LED = new MeshStandardMaterial({ color: '#1c1c1e', emissive: '#ffffff', emissiveIntensity: 0 })
const FLOOR_PLANE = new Plane(new Vector3(0, 1, 0), 0)
// Footprint of each zone around its origin [minX, maxX, minZ, maxZ], keeps it inside the 7 × 5 room
const BOUNDS: Record<Zone, [number, number, number, number]> = {
  dancefloor: [-1.4, 1.4, -1.1, 1.1],
  booth: [-1.65, 1.65, -0.55, 0.35],
  bar: [-0.6, 0.95, -1.35, 1.35],
  lounge: [-0.8, 0.8, -1.15, 0.65],
  coat: [-0.5, 0.45, -0.65, 0.65],
}

// ─── Textures ────────────────────────────────────────────────────────────────

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

const plankTexture = () => {
  const t = canvasTexture(512, 512, (g) => {
    for (let i = 0; i < 16; i++) {
      const v = 222 + ((i * 53) % 34)
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(0, i * 32, 512, 31)
      g.fillStyle = 'rgba(0,0,0,.2)'
      g.fillRect((i * 197) % 512, i * 32, 2, 32)
    }
  })
  t.wrapS = t.wrapT = RepeatWrapping
  return t
}

const shadowTexture = () =>
  canvasTexture(256, 256, (g) => {
    const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    rg.addColorStop(0, 'rgba(0,0,0,.28)')
    rg.addColorStop(0.55, 'rgba(0,0,0,.08)')
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = rg
    g.fillRect(0, 0, 256, 256)
  })

const signTexture = () =>
  canvasTexture(512, 128, (g) => {
    g.font = '600 80px -apple-system, Inter, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = '#fff'
    g.fillText('hafenlicht', 256, 64)
  })

// ─── Building blocks ─────────────────────────────────────────────────────────

/** Rounded box whose color eases to new values instead of snapping */
function Block({ size, color, radius = 0.03, map, ...props }: { size: Vec3; color: string; radius?: number; map?: Texture } & ThreeElements['mesh']) {
  const geometry = useMemo(
    () => new RoundedBoxGeometry(...size, 3, Math.min(radius, Math.min(...size) / 2 - 0.001)),
    [size.join(), radius], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const material = useMemo(() => new MeshStandardMaterial({ color, roughness: 0.85, ...(map && { map }) }), [map]) // eslint-disable-line react-hooks/exhaustive-deps
  const target = useMemo(() => new Color(color), [color])
  useFrame((_, dt) => void material.color.lerp(target, 1 - Math.exp(-8 * dt)))
  return <mesh geometry={geometry} material={material} castShadow receiveShadow {...props} />
}

type PopProps = { at: number; show?: boolean; label?: string; zone?: Zone; children: ReactNode } & ThreeElements['group']

/** Drops its children in (or shrinks them away), labels them on hover and, given a zone, lets you drag it */
function Pop({ at, show = true, label, zone, children, ...props }: PopProps) {
  const { progress, hover, drag } = useContext(Ctx)
  const outer = useRef<Group>(null!)
  const inner = useRef<Group>(null!)
  const on = show && progress >= at
  useFrame((_, dt) => {
    const g = inner.current
    const s = MathUtils.damp(g.scale.x, on ? 1 : 0, 8, dt)
    g.scale.setScalar(Math.max(s, 1e-4))
    g.position.y = (1 - s) * 1.5
    g.visible = s > 0.01
  })
  const text = zone && drag ? `${label} · drag to move` : label
  const onHover = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    hover(text!, e)
  }
  return (
    <group ref={outer} {...props}>
      <group
        ref={inner}
        scale={1e-4}
        {...(label && { onPointerOver: onHover, onPointerMove: onHover, onPointerOut: () => hover(null) })}
        {...(zone &&
          drag && {
            onPointerDown: (e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation()
              drag(zone, outer.current, e.ray)
            },
          })}
      >
        {children}
      </group>
    </group>
  )
}

// ─── Club furniture ──────────────────────────────────────────────────────────

const TILE = 0.55
// 5 × 4 LED tiles centred on the zone
const TILES = Array.from({ length: 20 }, (_, i) => [(i % 5) - 2, Math.floor(i / 5) - 1.5] as const)

function Dancefloor() {
  const geometry = useMemo(() => new RoundedBoxGeometry(TILE - 0.03, 0.04, TILE - 0.03, 2, 0.01), [])
  const mats = useMemo(() => TILES.map(() => new MeshStandardMaterial({ color: '#2c2c2e', roughness: 0.25, metalness: 0.3 })), [])
  const lights = useRef<PointLight[]>([])
  // Tiles ripple in the light color once the party is on
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    TILES.forEach(([x, z], i) => {
      const wave = Math.sin(t * 3 + x * 1.7 + z * 1.3) * 0.5 + 0.5
      mats[i].emissive.copy(fx.color)
      mats[i].emissiveIntensity = fx.party * (0.1 + 1.8 * wave ** 3)
    })
    lights.current.forEach((l) => {
      l.color.copy(fx.color)
      l.intensity = 14 * fx.party
    })
  })
  return (
    <>
      {TILES.map(([x, z], i) => (
        <mesh key={i} geometry={geometry} material={mats[i]} position={[x * TILE, 0.02, z * TILE]} receiveShadow />
      ))}
      {[-1, 1].map((x, i) => (
        <pointLight
          key={x}
          ref={(l) => {
            if (l) lights.current[i] = l
          }}
          position={[x, 2.2, 0]}
          distance={6}
        />
      ))}
    </>
  )
}

function DiscoBall() {
  const ref = useRef<Mesh>(null!)
  useFrame((_, dt) => void (ref.current.rotation.y += dt * (0.15 + 1.2 * fx.party)))
  return (
    <>
      <mesh position-y={0.55}>
        <cylinderGeometry args={[0.005, 0.005, 0.5]} />
        <meshBasicMaterial color="#8e8e93" />
      </mesh>
      <mesh ref={ref} castShadow>
        <icosahedronGeometry args={[0.28, 2]} />
        <meshStandardMaterial color="#e5e5ea" metalness={1} roughness={0.15} flatShading />
      </mesh>
    </>
  )
}

function Speaker() {
  return (
    <>
      <Block size={[0.6, 1.6, 0.55]} position={[0, 0.8, 0]} color="#1c1c1e" radius={0.02} />
      {[
        [0.45, 0.22],
        [1.2, 0.12],
      ].map(([y, r]) => (
        <mesh key={y} position={[0, y, 0.28]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[r, r, 0.02, 32]} />
          <meshStandardMaterial color="#3a3a3c" roughness={0.6} />
        </mesh>
      ))}
    </>
  )
}

function Booth() {
  return (
    <>
      <Block size={[2, 1, 0.7]} position={[0, 0.5, 0]} color="#1c1c1e" />
      <mesh position={[0, 0.82, 0.36]} material={LED}>
        <boxGeometry args={[1.9, 0.04, 0.02]} />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 1.02, 0]} castShadow>
          <cylinderGeometry args={[0.17, 0.17, 0.04, 32]} />
          <meshStandardMaterial color="#3a3a3c" />
        </mesh>
      ))}
      <Block size={[0.42, 0.06, 0.36]} position={[0, 1.03, 0]} color="#2c2c2e" radius={0.01} />
      {[-1.35, 1.35].map((x) => (
        <group key={x} position={[x, 0, -0.25]}>
          <Speaker />
        </group>
      ))}
    </>
  )
}

const BEAMS = [-0.5, -0.3, -0.1, 0.1, 0.3, 0.5]

function Lasers() {
  const ref = useRef<Group>(null!)
  const mat = useMemo(() => new MeshBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false }), [])
  useFrame(({ clock }) => {
    ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.7) * 0.35
    ref.current.visible = fx.party > 0.02
    mat.color.copy(fx.color)
    mat.opacity = 0.85 * fx.party
  })
  return (
    <>
      <Block size={[0.3, 0.12, 0.2]} color="#2c2c2e" radius={0.02} />
      <group ref={ref}>
        {BEAMS.map((a) => (
          <group key={a} rotation={[0.1, a, 0]}>
            <mesh material={mat} position-z={1.6}>
              <boxGeometry args={[0.014, 0.014, 3.2]} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  )
}

const BOTTLES = ['#30d158', '#ff9f0a', '#d1d1d6', '#ff453a', '#64d2ff']

function Bar() {
  return (
    <>
      <Block size={[0.6, 1.05, 2.6]} position={[0, 0.525, 0]} color="#2c2c2e" />
      <Block size={[0.78, 0.06, 2.7]} position={[0.05, 1.08, 0]} color="#a07f62" />
      <mesh position={[0.31, 0.95, 0]} material={LED}>
        <boxGeometry args={[0.02, 0.04, 2.5]} />
      </mesh>
      <Block size={[0.3, 1.5, 2.4]} position={[-0.45, 0.75, 0]} color="#3a3a3c" />
      {Array.from({ length: 11 }, (_, i) => (
        <mesh key={i} position={[-0.45, 1.62, -1.05 + i * 0.21]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.24, 12]} />
          <meshStandardMaterial color={BOTTLES[i % BOTTLES.length]} roughness={0.2} />
        </mesh>
      ))}
      {[-0.9, -0.3, 0.3, 0.9].map((z) => (
        <group key={z} position={[0.75, 0, z]}>
          <mesh position-y={0.36} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 0.72, 8]} />
            <meshStandardMaterial color="#8e8e93" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position-y={0.74} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.06, 24]} />
            <meshStandardMaterial color="#1c1c1e" />
          </mesh>
        </group>
      ))}
    </>
  )
}

function Lounge({ accent }: { accent: string }) {
  return (
    <>
      <Block size={[1.6, 0.38, 0.7]} position={[0, 0.19, 0.3]} color={accent} radius={0.08} />
      <Block size={[1.6, 0.45, 0.18]} position={[0, 0.6, 0.56]} color={accent} radius={0.08} />
      <Block size={[0.7, 0.38, 1.1]} position={[0.45, 0.19, -0.6]} color={accent} radius={0.08} />
      <Block size={[0.18, 0.45, 1.1]} position={[0.71, 0.6, -0.6]} color={accent} radius={0.08} />
      <mesh position={[-0.25, 0.175, -0.45]} castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.35, 32]} />
        <meshStandardMaterial color="#d1d1d6" roughness={0.4} />
      </mesh>
    </>
  )
}

const COATS = ['#1c1c1e', '#8e8e93', '#6e2f3f', '#3a3a3c', '#a07f62', '#2f4f4a']

function CoatCheck() {
  return (
    <>
      <Block size={[0.45, 1, 1.2]} position={[0.15, 0.5, 0]} color="#2c2c2e" />
      <Block size={[0.55, 0.05, 1.3]} position={[0.15, 1.02, 0]} color="#a07f62" />
      <mesh position={[-0.3, 1.6, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.015, 0.015, 1.2]} />
        <meshStandardMaterial color="#8e8e93" metalness={0.8} />
      </mesh>
      {COATS.map((c, i) => (
        <Block key={i} size={[0.35, 0.62, 0.08]} position={[-0.3, 1.27, -0.45 + i * 0.18]} color={c} radius={0.03} />
      ))}
    </>
  )
}

function Sign() {
  const mat = useMemo(() => new MeshBasicMaterial({ map: signTexture(), transparent: true, toneMapped: false }), [])
  const off = useMemo(() => new Color('#d1d1d6'), [])
  useFrame(() => void mat.color.lerpColors(off, fx.color, fx.party))
  return (
    <mesh material={mat} position={[-3.49, 2.2, -0.4]} rotation-y={Math.PI / 2}>
      <planeGeometry args={[2, 0.5]} />
    </mesh>
  )
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

function Club({ config }: { config: ClubConfig }) {
  const { wall, accent } = WALLS[config.wall]
  const has = (a: Area) => config.areas.includes(a)
  const pos = (z: Zone): Vec3 => [config.layout[z][0], 0, config.layout[z][1]]
  const planks = useMemo(plankTexture, [])
  const shadow = useMemo(shadowTexture, [])

  return (
    <>
      <Pop at={0.03}>
        <mesh position-y={-0.21} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[12, 10]} />
          <meshBasicMaterial map={shadow} transparent depthWrite={false} />
        </mesh>
      </Pop>
      <Pop at={0.1} label={`${cap(config.floor)} floor`}>
        <Block
          size={[7, 0.2, 5]}
          position={[0, -0.1, 0]}
          color={FLOORS[config.floor]}
          map={config.floor === 'oak' ? planks : undefined}
          radius={0.02}
        />
      </Pop>
      <Pop at={0.16}>
        <Block size={[7.15, 3, 0.15]} position={[-0.075, 1.3, -2.575]} color={wall} radius={0.01} />
      </Pop>
      <Pop at={0.22}>
        <Block size={[0.15, 3, 5]} position={[-3.575, 1.3, 0]} color={wall} radius={0.01} />
        <Sign />
      </Pop>
      <Pop at={0.3} label="LED wall">
        <mesh position={[0.25, 1.95, -2.49]} material={LED}>
          <planeGeometry args={[3.2, 1.1]} />
        </mesh>
      </Pop>
      <Pop at={0.4} zone="dancefloor" label="Dancefloor" position={pos('dancefloor')}>
        <Dancefloor />
        <Pop at={0.8} show={has('ball')} label={AREAS.ball} position={[0, 2.3, 0]}>
          <DiscoBall />
        </Pop>
      </Pop>
      <Pop at={0.48} zone="booth" label="DJ booth" position={pos('booth')}>
        <Booth />
        <Pop at={0.86} show={has('lasers')} label={AREAS.lasers} position={[0, 1.15, -0.1]}>
          <Lasers />
        </Pop>
      </Pop>
      <Pop at={0.58} show={has('bar')} zone="bar" label={AREAS.bar} position={pos('bar')}>
        <Bar />
      </Pop>
      <Pop at={0.66} show={has('lounge')} zone="lounge" label={AREAS.lounge} position={pos('lounge')}>
        <Lounge accent={accent} />
      </Pop>
      <Pop at={0.74} show={has('coat')} zone="coat" label={AREAS.coat} position={pos('coat')}>
        <CoatCheck />
      </Pop>
    </>
  )
}

// ─── Scene plumbing ──────────────────────────────────────────────────────────

function Lights({ party, light }: { party: boolean; light: ClubConfig['light'] }) {
  const scene = useThree((s) => s.scene)
  const sun = useRef<DirectionalLight>(null!)
  const fill = useRef<AmbientLight>(null!)
  const target = useMemo(() => new Color(), [])
  // House lights ↔ party: daylight fades out, LEDs and colored lights take over
  useFrame((_, dt) => {
    const k = (fx.party = MathUtils.damp(fx.party, party ? 1 : 0, 3, dt))
    fx.color.lerp(target.set(LIGHTS[light]), 1 - Math.exp(-6 * dt))
    sun.current.intensity = MathUtils.lerp(1.9, 0.08, k)
    fill.current.intensity = MathUtils.lerp(0.3, 0.03, k)
    scene.environmentIntensity = MathUtils.lerp(0.5, 0.05, k)
    LED.emissive.copy(fx.color)
    LED.emissiveIntensity = 0.15 + 2.4 * k
  })
  return (
    <>
      <ambientLight ref={fill} />
      <directionalLight
        ref={sun}
        position={[5, 9, 6]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
    </>
  )
}

function Env() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

const PLAN = new Vector3(0, 20, 0.01)

/** Orbit by drag in the studio, slow drift while scanning, glide to a top-down floorplan */
function Controls({ enabled, orbit, plan }: { enabled: boolean; orbit: boolean; plan: boolean }) {
  const { camera, gl, set } = useThree()
  const ctl = useRef<OrbitControls>(null)
  const goal = useRef<Vector3 | null>(null)
  const saved = useRef<Vector3 | null>(null)
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement)
    Object.assign(c, {
      enableDamping: true,
      enablePan: false,
      minDistance: 10,
      maxDistance: 24,
      maxPolarAngle: 1.35,
      minAzimuthAngle: -0.3,
      maxAzimuthAngle: 1.75,
      autoRotateSpeed: 0.9,
    })
    c.target.set(0, 0.5, 0)
    ctl.current = c
    set({ controls: c })
    return () => {
      c.dispose()
      set({ controls: null })
    }
  }, [camera, gl, set])
  useEffect(() => {
    ctl.current!.enabled = enabled
    ctl.current!.enableRotate = !plan
  }, [enabled, plan])
  useEffect(() => {
    if (plan) {
      saved.current = camera.position.clone()
      goal.current = PLAN
    } else if (saved.current) goal.current = saved.current
  }, [plan, camera])
  useFrame((_, dt) => {
    const c = ctl.current
    if (!c) return
    if (goal.current) {
      camera.position.lerp(goal.current, 1 - Math.exp(-5 * dt))
      if (camera.position.distanceTo(goal.current) < 0.05) goal.current = null
    }
    c.autoRotate = orbit
    c.update(dt)
  })
  return null
}

/** Drag a zone across the floor, snapped to a 25 cm grid and kept inside the walls */
function useDrag(enabled: boolean, onMove: (zone: Zone, at: [number, number]) => void): Drag {
  const { camera, gl } = useThree()
  const controls = useThree((s) => s.controls) as OrbitControls | null
  return useMemo(() => {
    if (!enabled) return null
    const ray = new Raycaster()
    const ndc = new Vector2()
    const hit = new Vector3()
    return (zone, obj, startRay) => {
      const offset = startRay.intersectPlane(FLOOR_PLANE, hit) ? obj.position.clone().sub(hit) : new Vector3()
      if (controls) controls.enabled = false
      const move = (e: PointerEvent) => {
        const r = gl.domElement.getBoundingClientRect()
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
        ray.setFromCamera(ndc, camera)
        if (!ray.ray.intersectPlane(FLOOR_PLANE, hit)) return
        const [x0, x1, z0, z1] = BOUNDS[zone]
        obj.position.x = MathUtils.clamp(Math.round((hit.x + offset.x) * 4) / 4, -3.5 - x0, 3.5 - x1)
        obj.position.z = MathUtils.clamp(Math.round((hit.z + offset.z) * 4) / 4, -2.5 - z0, 2.5 - z1)
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        if (controls) controls.enabled = true
        onMove(zone, [obj.position.x, obj.position.z])
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    }
  }, [enabled, camera, gl, controls, onMove])
}

function Globe({ show }: { show: boolean }) {
  const ref = useRef<Points>(null!)
  const geometry = useMemo(() => {
    const n = 2400
    const pos: number[] = []
    for (let i = 0; i < n; i++) {
      // Fibonacci sphere
      const y = 1 - (2 * i) / (n - 1)
      const r = Math.sqrt(1 - y * y)
      pos.push(Math.cos(i * 2.39996) * r, y, Math.sin(i * 2.39996) * r)
    }
    return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(pos, 3))
  }, [])
  useFrame(({ clock }, dt) => {
    const p = ref.current
    const s = MathUtils.damp(p.scale.x, show ? 3 : 0.01, 4, dt)
    p.scale.setScalar(s)
    p.rotation.y += dt * (show ? 0.12 : 2)
    p.rotation.x = Math.sin(clock.elapsedTime * 0.3) * 0.15
    p.visible = s > 0.03
  })
  return (
    <points ref={ref} geometry={geometry} position={[0, 1, 0]} scale={3}>
      <pointsMaterial size={0.032} color="#6e6e73" transparent opacity={0.7} depthWrite={false} />
    </points>
  )
}

type Props = {
  progress: number
  interactive: boolean
  plan: boolean
  party: boolean
  config: ClubConfig
  onMove: (zone: Zone, at: [number, number]) => void
}

function World({ progress, interactive, plan, party, config, onMove, hover }: Props & { hover: Hover }) {
  const drag = useDrag(interactive, onMove)
  const ctx = useMemo(() => ({ progress, hover, drag }), [progress, hover, drag])
  return (
    <Ctx.Provider value={ctx}>
      <Env />
      <Lights party={party} light={config.light} />
      <Controls enabled={interactive} orbit={progress > 0 && progress < 1} plan={plan} />
      <Globe show={progress < 0.06} />
      <Club config={config} />
    </Ctx.Provider>
  )
}

function Scene(props: Props) {
  const tip = useRef<HTMLDivElement>(null)
  // Tooltip is moved directly in the DOM so hovering never re-renders the scene
  const hover = useCallback<Hover>((label, e) => {
    const el = tip.current!
    el.style.opacity = label ? '1' : '0'
    if (!label || !e) return
    el.textContent = label
    el.style.transform = `translate(${e.nativeEvent.clientX + 14}px, ${e.nativeEvent.clientY + 14}px)`
  }, [])

  return (
    <div className={`absolute inset-0 ${props.interactive ? 'cursor-grab active:cursor-grabbing' : ''}`}>
      <Canvas shadows="percentage" dpr={[1, 2]} camera={{ position: [11.9, 9.8, 5.3], fov: 35 }}>
        <World {...props} hover={hover} />
      </Canvas>
      <div
        ref={tip}
        className="pointer-events-none fixed top-0 left-0 rounded-full border border-white/70 bg-white/75 px-3 py-1 text-xs font-medium whitespace-nowrap text-neutral-900 opacity-0 shadow-lg shadow-black/10 backdrop-blur-xl transition-opacity"
      />
    </div>
  )
}

export default memo(Scene)
