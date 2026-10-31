import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, DoubleSide, MathUtils, type Group, type Mesh } from 'three'
import { H, canvasTexture } from '../acme/Venue'
import { COLORS, CREW_TONES, floorById, type ColorId, type FloorId, type OutfitId } from '../../data/tonight'

type Vec3 = [number, number, number]

// Where the crew stands on each floor: dancefloor, terrace, and just past the rope in the lobby
const SPOTS: Record<FloorId, Vec3> = {
  'main-hall': [-1, 0.07, 0.45],
  rooftop: [-0.9, 0, 0.5],
  entrance: [-1.25, 0, 1.9],
}
const CASINO_SPOT: Vec3 = [0.6, 0.5, 5]
const SPACING = 0.72

const BLACK = '#17151c'
const GLOW = '#d8ffe9'

function Limb({ at, color, length = 0.56, radius = 0.06, tilt = 0 }: { at: Vec3; color: string; length?: number; radius?: number; tilt?: number }) {
  return (
    <mesh position={at} rotation-z={tilt} castShadow>
      <capsuleGeometry args={[radius, length, 4, 10]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  )
}

function Cape({ color }: { color: string }) {
  return (
    <group position-y={0.42}>
      {/* Back half of a cone: black outside, the chosen colour inside */}
      <mesh position-y={0.42} castShadow>
        <cylinderGeometry args={[0.2, 0.46, 1.32, 24, 1, true, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color={BLACK} side={DoubleSide} roughness={0.5} />
      </mesh>
      <mesh position-y={0.42} scale={0.97}>
        <cylinderGeometry args={[0.2, 0.46, 1.32, 24, 1, true, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} side={BackSide} />
      </mesh>
      <mesh position-y={1.02}>
        <cylinderGeometry args={[0.24, 0.14, 0.26, 20, 1, true, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} side={DoubleSide} />
      </mesh>
    </group>
  )
}

function Bones() {
  const glow = <meshStandardMaterial color={GLOW} emissive={GLOW} emissiveIntensity={1.6} toneMapped={false} />
  const bones: [Vec3, number][] = [
    [[-0.1, 0.42, 0.065], 0],
    [[0.1, 0.42, 0.065], 0],
    [[-0.25, 1.06, 0.06], 0.14],
    [[0.25, 1.06, 0.06], -0.14],
  ]
  return (
    <>
      {[0.92, 1.03, 1.14, 1.25].map((y) => (
        <mesh key={y} position={[0, y, 0.03]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.16, 0.012, 6, 24]} />
          {glow}
        </mesh>
      ))}
      <mesh position={[0, 1.05, 0.165]}>
        <boxGeometry args={[0.03, 0.52, 0.02]} />
        {glow}
      </mesh>
      {bones.map(([at, tilt], i) => (
        <mesh key={i} position={at} rotation-z={tilt}>
          <capsuleGeometry args={[0.018, 0.5, 3, 6]} />
          {glow}
        </mesh>
      ))}
      <mesh position-y={1.52} scale={1.03}>
        <sphereGeometry args={[0.13, 20, 16]} />
        {glow}
      </mesh>
      {[-0.05, 0.05].map((x) => (
        <mesh key={x} position={[x, 1.54, 0.115]}>
          <sphereGeometry args={[0.032, 10, 8]} />
          <meshBasicMaterial color="#000" />
        </mesh>
      ))}
    </>
  )
}

function Witch({ color }: { color: string }) {
  return (
    <>
      <mesh position-y={0.52} castShadow>
        <coneGeometry args={[0.46, 1.08, 28, 1, true]} />
        <meshStandardMaterial color={BLACK} side={DoubleSide} roughness={0.5} />
      </mesh>
      <mesh position-y={0.1}>
        <torusGeometry args={[0.385, 0.018, 6, 28]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} />
      </mesh>
      <mesh position-y={1.61}>
        <cylinderGeometry args={[0.3, 0.3, 0.018, 28]} />
        <meshStandardMaterial color={BLACK} />
      </mesh>
      <mesh position-y={1.85}>
        <coneGeometry args={[0.13, 0.46, 20]} />
        <meshStandardMaterial color={BLACK} />
      </mesh>
      <mesh position-y={1.655}>
        <cylinderGeometry args={[0.135, 0.15, 0.05, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} />
      </mesh>
    </>
  )
}

/** One of the four. Plain in their own colour until a look is picked, then dressed in it. */
function Figure({ tone, outfit, accent }: { tone: string; outfit: OutfitId | null; accent: string }) {
  const skin = outfit === 'skeleton' ? BLACK : '#e4c4ae'
  const cloth = outfit ? BLACK : tone

  return (
    <group>
      {outfit !== 'witch' && (
        <>
          <Limb at={[-0.1, 0.42, 0]} color={cloth} />
          <Limb at={[0.1, 0.42, 0]} color={cloth} />
        </>
      )}
      <Limb at={[-0.25, 1.06, 0]} color={cloth} length={0.5} radius={0.05} tilt={0.14} />
      <Limb at={[0.25, 1.06, 0]} color={cloth} length={0.5} radius={0.05} tilt={-0.14} />
      <Limb at={[0, 1.06, 0]} color={cloth} length={0.36} radius={0.17} />
      <mesh position-y={1.52} castShadow>
        <sphereGeometry args={[0.13, 20, 16]} />
        <meshStandardMaterial color={skin} roughness={0.6} />
      </mesh>
      {outfit !== 'skeleton' && (
        <mesh position={[0, 1.57, -0.025]} scale={[1.04, 0.95, 1.02]}>
          <sphereGeometry args={[0.13, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color="#1a1418" roughness={0.5} />
        </mesh>
      )}
      {/* Tonight is masked, so every look gets one */}
      {outfit && (
        <mesh position={[0, 1.55, 0.09]} scale={[0.98, 0.3, 0.42]}>
          <sphereGeometry args={[0.122, 16, 12]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.9} />
        </mesh>
      )}
      {outfit === 'vampire' && <Cape color={accent} />}
      {outfit === 'skeleton' && <Bones />}
      {outfit === 'witch' && <Witch color={accent} />}
    </group>
  )
}

/**
 * The group stands inside the world: they ride up to the floor you pick, wear what you pick,
 * and turn up at the casino door. The first figure turns slowly while a look is being chosen.
 */
export function CrewFigures({ show, floor, atCasino, outfit, color, turntable }: {
  show: boolean
  floor: FloorId | null
  atCasino: boolean
  outfit: OutfitId | null
  color: ColorId
  turntable: boolean
}) {
  const root = useRef<Group>(null!)
  const members = useRef<Group[]>([])
  const accent = COLORS.find((c) => c.id === color)!.hex
  const spot = floor ?? 'entrance'
  const y = (floorById(spot)?.level ?? 0) * H
  const [x, base, z] = atCasino ? CASINO_SPOT : SPOTS[spot]

  useFrame(({ clock }, dt) => {
    const scale = MathUtils.damp(root.current.scale.x, show ? 1 : 0.001, 7, dt)
    root.current.scale.setScalar(scale)
    root.current.visible = scale > 0.01
    members.current.forEach((g, i) => {
      const beat = clock.elapsedTime * 4 + i * 1.3
      const tx = x + (i - (CREW_TONES.length - 1) / 2) * SPACING
      g.position.x = MathUtils.damp(g.position.x, tx, 3, dt)
      g.position.z = MathUtils.damp(g.position.z, z + (i % 2) * 0.28, 3, dt)
      // Bobbing to the music, except for the elevator ride
      g.position.y = MathUtils.damp(g.position.y, (atCasino ? 0 : y) + base, 2.5, dt) + Math.abs(Math.sin(beat)) * 0.012
      if (i === 0 && turntable) g.rotation.y += dt * 0.7
      else g.rotation.y = MathUtils.damp(g.rotation.y, Math.sin(beat / 4) * 0.25, 4, dt)
    })
  })

  return (
    <group ref={root} scale={0.001}>
      {CREW_TONES.map((tone, i) => (
        <group
          key={tone}
          ref={(g) => {
            if (g) members.current[i] = g
          }}
        >
          <Figure tone={tone} outfit={outfit} accent={accent} />
        </group>
      ))}
      {/* A soft key light, or the look gets lost in the dark of the club */}
      {turntable && <pointLight position={[x + 0.8, y + 2.2, z + 2.4]} intensity={20} distance={9} color="#fff1e0" />}
    </group>
  )
}

const POCKETS = 24
const WHEEL_SPEED = 0.25

function wheelTexture() {
  return canvasTexture(1024, 1024, (g) => {
    const c = 512
    for (let i = 0; i < POCKETS; i++) {
      const a = (i / POCKETS) * Math.PI * 2
      g.beginPath()
      g.moveTo(c, c)
      g.arc(c, c, 510, a, a + (Math.PI * 2) / POCKETS)
      g.closePath()
      g.fillStyle = i === 0 ? '#0e8a4f' : i % 2 ? '#b0122a' : '#120f14'
      g.fill()
      g.save()
      g.translate(c, c)
      g.rotate(a + Math.PI / POCKETS)
      g.fillStyle = '#f5e6c4'
      g.font = '600 44px Inter, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(String(i), 450, 0)
      g.restore()
    }
    g.fillStyle = '#231a10'
    g.beginPath()
    g.arc(c, c, 300, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = '#f0c050'
    g.lineWidth = 14
    g.stroke()
    g.fillStyle = '#f0c050'
    g.beginPath()
    g.arc(c, c, 62, 0, Math.PI * 2)
    g.fill()
  })
}

const signTexture = () =>
  canvasTexture(1024, 200, (g) => {
    g.font = '600 112px Georgia, serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.shadowColor = '#f0c050'
    g.shadowBlur = 30
    g.fillStyle = '#ffe9b0'
    g.fillText('Casino Nocturne', 512, 104)
  })

const CHIPS: [number, number, number, string][] = [
  [-3.1, 3.4, 5, '#b0122a'],
  [-1.9, 4.5, 3, '#f0c050'],
  [3.3, 3.1, 4, '#1a1a22'],
  [2.2, 4.6, 6, '#0e8a4f'],
]

/** The casino rises from its pin as a giant roulette table */
export function Casino({ show }: { show: boolean }) {
  const root = useRef<Group>(null!)
  const wheel = useRef<Mesh>(null!)
  const ball = useRef<Group>(null!)
  const wheelMap = useMemo(wheelTexture, [])
  const sign = useMemo(signTexture, [])
  useEffect(
    () => () => {
      wheelMap.dispose()
      sign.dispose()
    },
    [wheelMap, sign],
  )

  useFrame((_, dt) => {
    const s = MathUtils.damp(root.current.scale.y, show ? 1 : 0.001, 3.5, dt)
    root.current.scale.set(Math.min(1, s * 1.4), s, Math.min(1, s * 1.4))
    root.current.visible = s > 0.01
    wheel.current.rotation.z += WHEEL_SPEED * dt
    ball.current.rotation.y -= WHEEL_SPEED * 1.6 * dt
  })

  return (
    <group ref={root} scale={0.001}>
      <mesh position-y={0.25} receiveShadow>
        <cylinderGeometry args={[5.6, 6, 0.5, 8]} />
        <meshStandardMaterial color="#2b2030" emissive="#2b2030" emissiveIntensity={0.5} roughness={0.6} />
      </mesh>
      <mesh position-y={2.6} castShadow>
        <cylinderGeometry args={[3.9, 4.3, 4.2, 8]} />
        <meshStandardMaterial color="#3a2642" emissive="#3a2642" emissiveIntensity={0.45} roughness={0.45} metalness={0.3} />
      </mesh>
      {[0.75, 2.1, 3.45].map((y) => (
        <mesh key={y} position-y={y}>
          <cylinderGeometry args={[4.33 - y * 0.08, 4.34 - y * 0.08, 0.1, 8]} />
          <meshBasicMaterial color="#f0c050" toneMapped={false} />
        </mesh>
      ))}
      {/* Entrance, sign and red carpet towards the camera */}
      <mesh position={[1.1, 1.6, 4]} rotation-y={0.28}>
        <boxGeometry args={[2, 2.2, 0.3]} />
        <meshBasicMaterial color="#ffd877" toneMapped={false} />
      </mesh>
      <mesh position={[1.45, 0.52, 6]} rotation={[-Math.PI / 2, 0, -0.28]}>
        <planeGeometry args={[1.5, 4]} />
        <meshStandardMaterial color="#8e1b2c" emissive="#8e1b2c" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[1.1, 3.1, 4.25]} rotation-y={0.28}>
        <planeGeometry args={[5.4, 1.05]} />
        <meshBasicMaterial map={sign} transparent toneMapped={false} depthWrite={false} side={DoubleSide} />
      </mesh>

      {/* The roof is the wheel, tilted towards you */}
      <group position-y={6.5} rotation-x={-1.15}>
        <mesh ref={wheel}>
          <circleGeometry args={[3.7, 64]} />
          <meshBasicMaterial map={wheelMap} toneMapped={false} side={DoubleSide} />
        </mesh>
        <mesh>
          <torusGeometry args={[3.74, 0.14, 12, 64]} />
          <meshStandardMaterial color="#f0c050" emissive="#f0c050" emissiveIntensity={0.9} metalness={0.8} roughness={0.3} />
        </mesh>
        <group rotation-x={Math.PI / 2}>
          <group ref={ball}>
            <mesh position={[3.25, 0.16, 0]}>
              <sphereGeometry args={[0.14, 16, 12]} />
              <meshBasicMaterial color="#fff" toneMapped={false} />
            </mesh>
          </group>
        </group>
      </group>

      {CHIPS.map(([x, z, height, color]) => (
        <group key={x} position={[x, 0.5, z]}>
          {Array.from({ length: height }, (_, i) => (
            <mesh key={i} position-y={0.09 + i * 0.17} castShadow>
              <cylinderGeometry args={[0.46, 0.46, 0.15, 24]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.35} />
            </mesh>
          ))}
        </group>
      ))}
      <pointLight position={[0, 8, 5]} intensity={70} distance={26} color="#ffd9a0" />
      <pointLight position={[3, 2, 8]} intensity={30} distance={16} color="#ff6a4a" />
    </group>
  )
}

const storeSign = (name: string) =>
  canvasTexture(1024, 200, (g) => {
    g.font = '600 104px Georgia, serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.shadowColor = '#ffd9a0'
    g.shadowBlur = 26
    g.fillStyle = '#fff1dc'
    g.fillText(name, 512, 104)
  })

/** The store on its street: a lit shop window and a sign. It stays a storefront, you don't go in. */
export function Storefront({ name, show }: { name: string; show: boolean }) {
  const root = useRef<Group>(null!)
  const sign = useMemo(() => storeSign(name), [name])
  useEffect(() => () => sign.dispose(), [sign])
  useFrame((_, dt) => {
    const s = MathUtils.damp(root.current.scale.y, show ? 1 : 0.001, 4, dt)
    root.current.scale.set(1, s, 1)
    root.current.visible = s > 0.01
  })
  return (
    <group ref={root} scale-y={0.001}>
      <mesh position-y={2.2} castShadow>
        <boxGeometry args={[8, 4.4, 5]} />
        <meshStandardMaterial color="#2e2a34" roughness={0.75} />
      </mesh>
      {/* Shop window, with the door beside it */}
      <mesh position={[-0.9, 1.3, 2.52]}>
        <planeGeometry args={[5.4, 2.1]} />
        <meshBasicMaterial color="#d99a55" toneMapped={false} />
      </mesh>
      <mesh position={[2.9, 1.15, 2.52]}>
        <planeGeometry args={[1.2, 2.3]} />
        <meshBasicMaterial color="#8a5a30" toneMapped={false} />
      </mesh>
      {/* Three mannequins, one for each article */}
      {[-2.7, -0.9, 0.9].map((x) => (
        <group key={x} position={[x, 0.3, 2.56]}>
          <mesh position-y={0.82}>
            <capsuleGeometry args={[0.24, 0.85, 4, 12]} />
            <meshStandardMaterial color={BLACK} />
          </mesh>
          <mesh position-y={1.62}>
            <sphereGeometry args={[0.17, 14, 10]} />
            <meshStandardMaterial color={BLACK} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 2.62, 2.95]} rotation-x={0.5}>
        <boxGeometry args={[8.2, 0.06, 1]} />
        <meshStandardMaterial color="#c6613f" emissive="#c6613f" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 3.6, 2.54]}>
        <planeGeometry args={[6.4, 1.25]} />
        <meshBasicMaterial map={sign} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 2, 6]} intensity={40} distance={18} color="#ffc680" />
    </group>
  )
}
