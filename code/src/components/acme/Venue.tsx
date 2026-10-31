import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree, type ThreeElements, type ThreeEvent } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PMREMGenerator,
  RepeatWrapping,
  SRGBColorSpace,
  Spherical,
  Vector3,
  type AmbientLight,
  type DirectionalLight,
  type Group,
  type Mesh,
  type PointLight,
  type Points,
  type Texture,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Floor, Room } from '../../data/vendor'

export const LIGHTS = { pink: '#ff2d55', blue: '#0a84ff', purple: '#bf5af2', orange: '#ff9f0a' }
export type Light = keyof typeof LIGHTS

const LEVELS = 5 // levels 1–2 belong to other tenants, the club has the ground floor, level 3 and the roof
export const H = 2.6 // floor-to-floor height
const INNER = 2.35 // clear height below the next slab

type Vec3 = [number, number, number]
type Tip = (label: string | null, e?: ThreeEvent<PointerEvent>) => void

// progress (0–1) drives the assembly while scanning, tip feeds the DOM label
const Ctx = createContext<{ progress: number; tip: Tip }>({ progress: 1, tip: () => {} })

// Party state shared by everything that glows, eased each frame in <Lights>
const fx = { party: 0, color: new Color(LIGHTS.pink) }
const LED = new MeshStandardMaterial({ color: '#1c1c1e', emissive: '#ffffff', emissiveIntensity: 0 })
const GLASS = new MeshStandardMaterial({
  color: '#cfe0ee',
  transparent: true,
  opacity: 0.2,
  roughness: 0.05,
  metalness: 0.1,
  side: DoubleSide,
  depthWrite: false,
})
const HIGHLIGHT = new Color('#0071e3')

// ─── Textures ────────────────────────────────────────────────────────────────

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

let planks: Texture | undefined
const plankTexture = () => {
  planks ??= canvasTexture(512, 512, (g) => {
    for (let i = 0; i < 16; i++) {
      const v = 222 + ((i * 53) % 34)
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(0, i * 32, 512, 31)
      g.fillStyle = 'rgba(0,0,0,.2)'
      g.fillRect((i * 197) % 512, i * 32, 2, 32)
    }
  })
  planks.wrapS = planks.wrapT = RepeatWrapping
  return planks
}

const shadowTexture = () =>
  canvasTexture(256, 256, (g) => {
    const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    rg.addColorStop(0, 'rgba(0,0,0,.3)')
    rg.addColorStop(0.55, 'rgba(0,0,0,.08)')
    rg.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = rg
    g.fillRect(0, 0, 256, 256)
  })

const signTexture = (text: string) =>
  canvasTexture(1024, 256, (g) => {
    let size = 170
    g.font = `600 ${size}px -apple-system, Inter, sans-serif`
    const w = g.measureText(text).width
    if (w > 980) size *= 980 / w
    g.font = `600 ${size}px -apple-system, Inter, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = '#fff'
    g.fillText(text, 512, 128)
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

/** Drops its children onto the stack once the scan reaches `at` */
function Pop({ at, children, ...props }: { at: number; children: ReactNode } & ThreeElements['group']) {
  const { progress } = useContext(Ctx)
  const inner = useRef<Group>(null!)
  useFrame((_, dt) => {
    const g = inner.current
    const s = MathUtils.damp(g.scale.x, progress >= at ? 1 : 0, 8, dt)
    g.scale.setScalar(Math.max(s, 1e-4))
    g.position.y = (1 - s) * 6
    g.visible = s > 0.01
  })
  return (
    <group {...props}>
      <group ref={inner} scale={1e-4}>
        {children}
      </group>
    </group>
  )
}

/** A storey that eases up by `lift` (hover peek, or out of the way when a floor below is open) */
function Lift({ y, lift, children, ...props }: { y: number; lift: number; children: ReactNode } & ThreeElements['group']) {
  const ref = useRef<Group>(null!)
  useFrame((_, dt) => {
    const g = ref.current
    g.position.y = MathUtils.damp(g.position.y, y + lift, 6, dt)
    g.visible = g.position.y < y + 12
  })
  return (
    <group ref={ref} position-y={y} {...props}>
      {children}
    </group>
  )
}

// ─── Club furniture ──────────────────────────────────────────────────────────

const TILE = 0.55
// 5 × 4 LED tiles centred on the dancefloor
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
      l.intensity = 12 * fx.party
    })
  })
  return (
    <>
      {TILES.map(([x, z], i) => (
        <mesh key={i} geometry={geometry} material={mats[i]} position={[x * TILE, 0.03, z * TILE]} receiveShadow />
      ))}
      {[-1, 1].map((x, i) => (
        <pointLight
          key={x}
          ref={(l) => {
            if (l) lights.current[i] = l
          }}
          position={[x, 1.9, 0]}
          distance={5}
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
      <mesh position-y={0.4}>
        <cylinderGeometry args={[0.005, 0.005, 0.25]} />
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

/** Counter along z, guests on the +x side, back bar with bottles on the -x side */
function Bar({ length }: { length: number }) {
  const bottles = Math.floor((length - 0.4) / 0.21)
  const stools = Math.floor(length / 0.6)
  return (
    <>
      <Block size={[0.6, 1.05, length]} position={[0, 0.525, 0]} color="#2c2c2e" />
      <Block size={[0.78, 0.06, length + 0.1]} position={[0.05, 1.08, 0]} color="#a07f62" />
      <mesh position={[0.31, 0.95, 0]} material={LED}>
        <boxGeometry args={[0.02, 0.04, length - 0.1]} />
      </mesh>
      <Block size={[0.3, 1.5, length - 0.2]} position={[-0.45, 0.75, 0]} color="#3a3a3c" />
      {Array.from({ length: bottles }, (_, i) => (
        <mesh key={i} position={[-0.45, 1.62, (i - (bottles - 1) / 2) * 0.21]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.24, 12]} />
          <meshStandardMaterial color={BOTTLES[i % BOTTLES.length]} roughness={0.2} />
        </mesh>
      ))}
      {Array.from({ length: stools }, (_, i) => (
        <group key={i} position={[0.75, 0, (i - (stools - 1) / 2) * 0.6]}>
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

function Lounge() {
  const velvet = '#6e2f3f'
  return (
    <>
      <Block size={[1.6, 0.38, 0.7]} position={[0, 0.19, 0.3]} color={velvet} radius={0.08} />
      <Block size={[1.6, 0.45, 0.18]} position={[0, 0.6, 0.56]} color={velvet} radius={0.08} />
      <Block size={[0.7, 0.38, 1.1]} position={[0.45, 0.19, -0.6]} color={velvet} radius={0.08} />
      <Block size={[0.18, 0.45, 1.1]} position={[0.71, 0.6, -0.6]} color={velvet} radius={0.08} />
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

const LEAVES: [number, number, number, number][] = [
  [0, 0.62, 0, 0.26],
  [0.12, 0.85, 0.05, 0.2],
  [-0.1, 0.95, -0.06, 0.17],
]

function Plant() {
  return (
    <>
      <mesh position-y={0.18} castShadow receiveShadow>
        <cylinderGeometry args={[0.17, 0.13, 0.36, 20]} />
        <meshStandardMaterial color="#d1d1d6" roughness={0.9} />
      </mesh>
      {LEAVES.map(([x, y, z, r]) => (
        <mesh key={y} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 0]} />
          <meshStandardMaterial color="#3f6e48" flatShading roughness={0.9} />
        </mesh>
      ))}
    </>
  )
}

function Toilets() {
  return (
    <>
      {[0.55, 1.45].map((z) => (
        <group key={z} position={[-0.5, 0, z]}>
          <Block size={[0.85, 1.8, 0.85]} position-y={0.9} color="#8e8e93" />
          <Block size={[0.04, 1.5, 0.6]} position={[-0.44, 0.85, 0]} color="#f2f2f7" radius={0.01} />
        </group>
      ))}
      <Block size={[0.45, 0.85, 1]} position={[-1.7, 0.425, 1]} color="#f2f2f7" />
    </>
  )
}

function Lobby() {
  return (
    <>
      <Block size={[1.3, 2.1, 0.08]} position={[-1.2, 1.05, -2.44]} color="#aeaeb2" radius={0.01} />
      <Block size={[0.02, 2, 0.09]} position={[-1.2, 1.05, -2.44]} color="#636366" radius={0.005} />
      <Block size={[1.6, 1, 0.6]} position={[0.6, 0.5, -0.4]} color="#2c2c2e" />
      <mesh position={[0.6, 0.8, -0.09]} material={LED}>
        <boxGeometry args={[1.5, 0.04, 0.02]} />
      </mesh>
      {[-1.6, -0.8, 0, 0.8].map((x) => (
        <mesh key={x} position={[x, 0.45, 1.2]} castShadow>
          <cylinderGeometry args={[0.03, 0.05, 0.9, 12]} />
          <meshStandardMaterial color="#c7c7cc" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      <Block size={[2.4, 0.04, 0.04]} position={[-0.4, 0.85, 1.2]} color="#8e1b2c" radius={0.01} />
    </>
  )
}

function Terrace() {
  return (
    <>
      <group position-z={-1.9}>
        <Booth />
      </group>
      <group position={[-1.45, 0, 1.6]}>
        <Lounge />
      </group>
      {[
        [0.6, 0.6],
        [-0.2, -0.3],
      ].map(([x, z]) => (
        <group key={x} position={[x, 0, z]}>
          <mesh position-y={0.5} castShadow>
            <cylinderGeometry args={[0.03, 0.03, 1, 8]} />
            <meshStandardMaterial color="#8e8e93" metalness={0.8} />
          </mesh>
          <Block size={[0.6, 0.04, 0.6]} position-y={1.02} color="#f2f2f7" radius={0.02} />
        </group>
      ))}
      {[
        [1.85, 2.15],
        [-2, -0.9],
        [1.85, -0.9],
      ].map(([x, z]) => (
        <group key={x + z} position={[x, 0, z]}>
          <Plant />
        </group>
      ))}
    </>
  )
}

/** Furniture for a room, placed from its rectangle on the floor */
function Furniture({ room }: { room: Room }) {
  const [x0, z0, x1, z1] = room.rect
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  switch (room.kind) {
    case 'dance':
      return (
        <>
          <group position={[cx, 0, cz + 0.45]}>
            <Dancefloor />
            <group position-y={1.85}>
              <DiscoBall />
            </group>
          </group>
          <group position={[cx, 0, z0 + 0.6]}>
            <Booth />
            <group position={[0, 1.15, -0.1]}>
              <Lasers />
            </group>
          </group>
        </>
      )
    case 'bar':
      return (
        <group position={[x1 - 0.6, 0, cz]} rotation-y={Math.PI}>
          <Bar length={Math.min(2.6, z1 - z0 - 0.6)} />
        </group>
      )
    case 'toilets':
      return (
        <group position={[x1, 0, z0]}>
          <Toilets />
        </group>
      )
    case 'lobby':
      return (
        <group position={[cx, 0, cz]}>
          <Lobby />
        </group>
      )
    case 'coat':
      return (
        <>
          {[-1, 1].map((dz) => (
            <group key={dz} position={[x1 - 0.65, 0, cz + dz]} rotation-y={Math.PI}>
              <CoatCheck />
            </group>
          ))}
        </>
      )
    case 'terrace':
      return (
        <group position={[cx, 0, cz]}>
          <Terrace />
        </group>
      )
  }
  return null
}

// ─── Building ────────────────────────────────────────────────────────────────

const ROOM_FLOORS: Record<string, string> = {
  dance: '#3a3a3c',
  bar: '#9c7656',
  toilets: '#e5e5ea',
  lobby: '#c7c7cc',
  coat: '#9c7656',
  terrace: '#b08d6e',
}
const WOOD = ['bar', 'coat', 'terrace']

/** A room's floor patch plus furniture; hoverable and clickable once its floor is open */
function RoomZone({ room, at, active, focused, onSelect }: { room: Room; at: number; active: boolean; focused: boolean; onSelect: () => void }) {
  const { tip } = useContext(Ctx)
  const [x0, z0, x1, z1] = room.rect
  const [hot, setHot] = useState(false)
  const base = useMemo(() => new Color(ROOM_FLOORS[room.kind]), [room.kind])
  const mat = useMemo(
    () => new MeshStandardMaterial({ color: base, roughness: 0.8, ...(WOOD.includes(room.kind) && { map: plankTexture() }) }),
    [base, room.kind],
  )
  const goal = useMemo(() => new Color(), [])
  useFrame((_, dt) => void mat.color.lerp(goal.copy(base).lerp(HIGHLIGHT, hot || focused ? 0.35 : 0), 1 - Math.exp(-10 * dt)))
  useEffect(() => {
    if (!active) setHot(false)
  }, [active])

  const label = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    tip(focused ? room.name : `${room.name} · click to enter`, e)
  }
  const events = active && {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      setHot(true)
      label(e)
    },
    onPointerMove: label,
    onPointerOut: () => {
      setHot(false)
      tip(null)
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      if (e.delta < 5) onSelect()
    },
  }

  return (
    <group {...events}>
      <Pop at={at}>
        <mesh material={mat} position={[(x0 + x1) / 2, 0.01, (z0 + z1) / 2]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[x1 - x0 - 0.04, z1 - z0 - 0.04]} />
        </mesh>
        <Furniture room={room} />
      </Pop>
    </group>
  )
}

function Partition({ seg: [x0, z0, x1, z1] }: { seg: number[] }) {
  const alongZ = x0 === x1
  const len = alongZ ? Math.abs(z1 - z0) : Math.abs(x1 - x0)
  return (
    <Block
      size={alongZ ? [0.1, INNER, len] : [len, INNER, 0.1]}
      position={[(x0 + x1) / 2, INNER / 2, (z0 + z1) / 2]}
      color="#f2f2f7"
      radius={0.01}
    />
  )
}

const SIDES: [number, number, number, number][] = [
  // x, z, rotationY, width
  [0, -2.6, 0, 7.2],
  [0, 2.6, 0, 7.2],
  [-3.6, 0, Math.PI / 2, 5.2],
  [3.6, 0, Math.PI / 2, 5.2],
]
const CORNERS = [
  [-3.6, -2.6],
  [3.6, -2.6],
  [-3.6, 2.6],
  [3.6, 2.6],
]

/** Glass facade (or railing on the roof) with slim corner columns */
function Glass({ h }: { h: number }) {
  return (
    <>
      {SIDES.map(([x, z, ry, w], i) => (
        <mesh key={i} material={GLASS} position={[x, h / 2, z]} rotation-y={ry}>
          <planeGeometry args={[w, h]} />
        </mesh>
      ))}
      {CORNERS.map(([x, z], i) => (
        <Block key={i} size={[0.16, h, 0.16]} position={[x, h / 2, z]} color="#f2f2f7" radius={0.01} />
      ))}
    </>
  )
}

/** Floors that aren't part of the club: closed facade with a window band */
function Offices() {
  return (
    <>
      <Block size={[7.2, INNER, 5.2]} position-y={INNER / 2} color="#d8d8dc" radius={0.01} />
      <Block size={[7.24, 1.05, 5.24]} position-y={1.25} color="#4a5866" radius={0.01} />
    </>
  )
}

function RoofSign({ name }: { name: string }) {
  const map = useMemo(() => signTexture(name), [name])
  const mat = useMemo(() => new MeshBasicMaterial({ transparent: true, toneMapped: false }), [])
  const off = useMemo(() => new Color('#1c1c1e'), [])
  useEffect(() => {
    mat.map = map
    mat.needsUpdate = true
    return () => map.dispose()
  }, [mat, map])
  useFrame(() => void mat.color.lerpColors(off, fx.color, fx.party))
  return (
    <group position-z={-2.45}>
      {[-2, 2].map((x) => (
        <Block key={x} size={[0.06, 1.5, 0.06]} position={[x, 0.75, -0.05]} color="#8e8e93" radius={0.01} />
      ))}
      <mesh material={mat} position-y={1.75}>
        <planeGeometry args={[5, 1.25]} />
      </mesh>
    </group>
  )
}

type BuildingProps = {
  floors: Floor[]
  open: string | null
  room: number | null
  hover: string | null
  interactive: boolean
  name: string
  onHover: (id: string | null) => void
  onOpen: (id: string) => void
  onRoom: (index: number) => void
}

function Building({ floors, open, room, hover, interactive, name, onHover, onOpen, onRoom }: BuildingProps) {
  const { tip } = useContext(Ctx)
  const shadow = useMemo(shadowTexture, [])
  const levelOf = (id: string | null) => floors.find((f) => f.id === id)?.level ?? null
  const openLevel = levelOf(open)
  const hoverLevel = levelOf(hover)

  return (
    <>
      <Pop at={0.03}>
        <mesh position-y={-0.27} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[18, 15]} />
          <meshBasicMaterial map={shadow} transparent depthWrite={false} />
        </mesh>
      </Pop>
      {Array.from({ length: LEVELS }, (_, level) => {
        const floor = floors.find((f) => f.level === level)
        const roof = level === LEVELS - 1
        // An open floor sends everything above it away; hovering one lifts the storeys above for a peek
        const lift = openLevel !== null ? (level > openLevel ? 30 : 0) : hoverLevel !== null && level > hoverLevel ? 2.4 : 0
        const label = (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          tip(`${floor!.name} · click to open`, e)
        }
        const events = floor &&
          interactive &&
          !open && {
            onPointerOver: (e: ThreeEvent<PointerEvent>) => {
              onHover(floor.id)
              label(e)
            },
            onPointerMove: label,
            onPointerOut: () => {
              onHover(null)
              tip(null)
            },
            onClick: (e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation()
              if (e.delta > 5) return
              tip(null)
              onOpen(floor.id)
            },
          }
        return (
          <Lift key={level} y={level * H} lift={lift} {...events}>
            <Pop at={0.05 + level * 0.17}>
              <Block size={[7.3, 0.25, 5.3]} position-y={-0.125} color="#e5e5ea" radius={0.02} castShadow={false} />
              {floor ? <Glass h={roof ? 1 : INNER} /> : <Offices />}
              {roof && <RoofSign name={name} />}
            </Pop>
            {floor?.walls.map((w, i) => (
              <Pop key={i} at={0.05 + level * 0.17}>
                <Partition seg={w} />
              </Pop>
            ))}
            {floor?.rooms.map((r, i) => (
              <RoomZone
                key={r.name}
                room={r}
                at={0.05 + level * 0.17}
                active={interactive && open === floor.id}
                focused={open === floor.id && room === i}
                onSelect={() => onRoom(i)}
              />
            ))}
          </Lift>
        )
      })}
    </>
  )
}

// ─── Scene plumbing ──────────────────────────────────────────────────────────

function Lights({ party, light }: { party: boolean; light: Light }) {
  const scene = useThree((s) => s.scene)
  const sun = useRef<DirectionalLight>(null!)
  const fill = useRef<AmbientLight>(null!)
  const target = useMemo(() => new Color(), [])
  // House lights ↔ party: daylight fades out, LEDs and colored lights take over
  useFrame((_, dt) => {
    const k = (fx.party = MathUtils.damp(fx.party, party ? 1 : 0, 3, dt))
    fx.color.lerp(target.set(LIGHTS[light]), 1 - Math.exp(-6 * dt))
    sun.current.intensity = MathUtils.lerp(1.9, 0.1, k)
    fill.current.intensity = MathUtils.lerp(0.4, 0.05, k)
    scene.environmentIntensity = MathUtils.lerp(0.55, 0.08, k)
    LED.emissive.copy(fx.color)
    LED.emissiveIntensity = 0.15 + 2.4 * k
  })
  return (
    <>
      <ambientLight ref={fill} />
      <directionalLight
        ref={sun}
        position={[12, 22, 14]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-camera-far={60}
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

export type Framing = { target: Vec3; distance: number; polar: number; azimuth?: number }

/** Orbit by drag and glide to a new framing (keeping the compass direction unless given) */
function Camera({ target, distance, polar, azimuth, enabled }: Framing & { enabled: boolean }) {
  const { camera, gl } = useThree()
  const ctl = useRef<OrbitControls>(null)
  const goal = useRef<{ target: Vector3; position: Vector3 } | null>(null)
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement)
    Object.assign(c, {
      enableDamping: true,
      enablePan: false,
      minDistance: 4,
      maxDistance: 45,
      maxPolarAngle: 1.4,
    })
    c.target.set(0, 6.6, 0)
    ctl.current = c
    return () => c.dispose()
  }, [camera, gl])
  useEffect(() => {
    ctl.current!.enabled = enabled
  }, [enabled])
  const [x, y, z] = target
  useEffect(() => {
    const view = new Spherical().setFromVector3(camera.position.clone().sub(ctl.current!.target))
    view.set(distance, polar, azimuth ?? view.theta)
    const t = new Vector3(x, y, z)
    goal.current = { target: t, position: t.clone().add(new Vector3().setFromSpherical(view)) }
  }, [x, y, z, distance, polar, azimuth, camera])
  useFrame((_, dt) => {
    const c = ctl.current
    if (!c) return
    const g = goal.current
    if (g) {
      const k = 1 - Math.exp(-4 * dt)
      c.target.lerp(g.target, k)
      camera.position.lerp(g.position, k)
      if (camera.position.distanceTo(g.position) < 0.05) goal.current = null
    }
    c.update(dt)
  })
  return null
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
    const s = MathUtils.damp(p.scale.x, show ? 6 : 0.01, 4, dt)
    p.scale.setScalar(s)
    p.rotation.y += dt * (show ? 0.12 : 2)
    p.rotation.x = Math.sin(clock.elapsedTime * 0.3) * 0.15
    p.visible = s > 0.03
  })
  return (
    <points ref={ref} geometry={geometry} position={[0, 6.6, 0]} scale={6}>
      <pointsMaterial size={0.06} color="#6e6e73" transparent opacity={0.7} depthWrite={false} />
    </points>
  )
}

type Props = BuildingProps & {
  progress: number
  party: boolean
  light: Light
  /** Overrides the built-in building → floor → room camera */
  framing?: Framing
  /** The point globe the scan starts from; off when the building is embedded elsewhere */
  scanGlobe?: boolean
  /** Extra 3D content in the same world */
  children?: ReactNode
}

function World({ progress, party, light, tip, framing: override, scanGlobe = true, children, ...building }: Props & { tip: Tip }) {
  const ctx = useMemo(() => ({ progress, tip }), [progress, tip])
  const floor = building.floors.find((f) => f.id === building.open)
  const room = floor && building.room !== null ? floor.rooms[building.room] : undefined
  const y = (floor?.level ?? 0) * H
  // Whole building → one floor (from the front, looking down into it) → one room (from above, over the walls)
  const framing: Framing = !floor
    ? { target: [0, 6.6, 0], distance: 31, polar: 1.12 }
    : room
      ? { target: [(room.rect[0] + room.rect[2]) / 2, y + 0.6, (room.rect[1] + room.rect[3]) / 2], distance: 10, polar: 0.6 }
      : { target: [0, y + 0.6, 0], distance: 17, polar: 0.85, azimuth: 0.45 }

  return (
    <Ctx.Provider value={ctx}>
      <Env />
      <Lights party={party} light={light} />
      <Camera
        {...(override ?? framing)}
        enabled={building.interactive}
      />
      {scanGlobe && <Globe show={progress < 0.06} />}
      <Building {...building} />
      {children}
    </Ctx.Provider>
  )
}

function Scene(props: Props) {
  const ref = useRef<HTMLDivElement>(null)
  // The label is moved directly in the DOM so hovering never re-renders the scene
  const tip = useCallback<Tip>((label, e) => {
    const el = ref.current!
    el.style.opacity = label ? '1' : '0'
    if (!label || !e) return
    el.textContent = label
    el.style.transform = `translate(${e.nativeEvent.clientX + 14}px, ${e.nativeEvent.clientY + 14}px)`
  }, [])

  return (
    <div className={`absolute inset-0 ${props.interactive ? 'cursor-grab active:cursor-grabbing' : ''}`}>
      <Canvas shadows="percentage" dpr={[1, 2]} camera={{ position: [28.5, 21.4, 11.1], fov: 35 }}>
        <World {...props} tip={tip} />
      </Canvas>
      <div
        ref={ref}
        className="pointer-events-none fixed top-0 left-0 rounded-full border border-white/70 bg-white/75 px-3 py-1 text-xs font-medium whitespace-nowrap text-neutral-900 opacity-0 shadow-lg shadow-black/10 backdrop-blur-xl transition-opacity"
      />
    </div>
  )
}

export default memo(Scene)
