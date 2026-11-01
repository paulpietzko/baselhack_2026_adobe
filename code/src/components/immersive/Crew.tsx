import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, DoubleSide, LatheGeometry, MathUtils, Vector2, type Group } from 'three'
import { H } from '../acme/Venue'
import { vendor } from '../../data/vendor'
import type { FloorId } from '../../data/floors'
import { COLORS, CREW_TONES, type ColorId, type OutfitId } from '../../data/costumes'

type Vec3 = [number, number, number]

// Where the crew stands on each floor: the cleared dancefloor, and the terrace
const SPOTS: Record<FloorId, Vec3> = {
  'main-hall': [-1, 0.07, 0.45],
  rooftop: [-0.9, 0, 0.5],
}
const SPACING = 0.72

const BLACK = '#17151c'
const GLOW = '#d8ffe9'

type Hair = 'short' | 'long' | 'curly' | 'bun'

/** Four different people, not four clones: the top is their crew colour, the rest is what they'd wear anyway */
type Person = { skin: string; hair: Hair; hairColor: string; pants: string; shoes: string; longSleeves: boolean; height: number }
const PEOPLE: Person[] = [
  { skin: '#e9c3a6', hair: 'short', hairColor: '#2a1b14', pants: '#2b3445', shoes: '#efefef', longSleeves: false, height: 1 },
  { skin: '#c99474', hair: 'long', hairColor: '#3d2416', pants: '#1f1f26', shoes: '#1a1a1a', longSleeves: true, height: 0.96 },
  { skin: '#8d5a3b', hair: 'curly', hairColor: '#141010', pants: '#3b4a5e', shoes: '#e8e1d6', longSleeves: false, height: 1.03 },
  { skin: '#f1d2bd', hair: 'bun', hairColor: '#b9853f', pants: '#2e2a24', shoes: '#5a3a24', longSleeves: true, height: 0.95 },
]

// Chest wider than the waist, rounding into the shoulders and the neck
const torso = new LatheGeometry(
  [[0.125, 0], [0.14, 0.06], [0.135, 0.18], [0.152, 0.32], [0.165, 0.42], [0.15, 0.5], [0.06, 0.56], [0.001, 0.57]].map(([r, y]) => new Vector2(r, y)),
  28,
)

/**
 * A draped skirt: a bell turned on a lathe, pushed out into folds that deepen towards the hem,
 * and a hem cut into handkerchief points (one point per fold, so they hang off the folds).
 */
function skirt(profile: [number, number][], { folds, depth, points, tip }: { folds: number; depth: number; points: number; tip: number }) {
  const g = new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), 96)
  const pos = g.attributes.position
  const ys = profile.map(([, y]) => y)
  const top = Math.max(...ys)
  const hem = Math.min(...ys)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const angle = Math.atan2(x, z)
    const down = (top - y) / (top - hem)
    const fold = 1 + depth * down ** 1.5 * Math.cos(angle * folds)
    pos.setXYZ(i, x * fold, y, z * fold)
    if (points && Math.abs(y - hem) < 1e-6) {
      const k = (((angle * points) / (2 * Math.PI)) % 1 + 1) % 1
      pos.setY(i, y - tip * (1 - Math.abs(k * 2 - 1)))
    }
  }
  g.computeVertexNormals()
  return g
}

// Witch couture: black overskirt with pointed hem, the chosen colour as a petticoat peeking between the points
const OVERSKIRT = skirt([[0.42, 0.17], [0.39, 0.26], [0.33, 0.4], [0.25, 0.56], [0.18, 0.72], [0.145, 0.84], [0.135, 0.91]], { folds: 7, depth: 0.08, points: 7, tip: 0.1 })
const PETTICOAT = skirt([[0.37, 0.13], [0.34, 0.24], [0.28, 0.4], [0.2, 0.58], [0.15, 0.75], [0.132, 0.86]], { folds: 13, depth: 0.05, points: 0, tip: 0 })

const Glow = () => <meshStandardMaterial color={GLOW} emissive={GLOW} emissiveIntensity={1.6} toneMapped={false} />

function Skin({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.55} />
}

function Cloth({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.85} />
}

/** A bone painted on the front of a limb, for the UV skeleton */
function Bone({ y, length }: { y: number; length: number }) {
  return (
    <mesh position={[0, y, 0.045]}>
      <capsuleGeometry args={[0.014, length, 3, 6]} />
      <Glow />
    </mesh>
  )
}

/** Shoulder → elbow → hand, bent a little so it reads as an arm and not a stick */
function Arm({ side, top, sleeve, skin, bones, shoulder, elbow }: {
  side: 1 | -1
  top: string
  sleeve: string
  skin: string
  bones: boolean
  shoulder: (g: Group | null) => void
  elbow: (g: Group | null) => void
}) {
  const bare = sleeve === skin
  const lower = bare ? <Skin color={skin} /> : <Cloth color={sleeve} />
  return (
    <group ref={shoulder} position={[side * 0.2, 1.3, 0]} rotation-z={side * 0.1}>
      <mesh position-y={-0.12} castShadow>
        <capsuleGeometry args={[0.046, 0.18, 4, 12]} />
        {lower}
      </mesh>
      {/* A t-shirt sleeve over the top of a bare arm */}
      {bare && (
        <mesh position-y={-0.05} castShadow>
          <capsuleGeometry args={[0.056, 0.07, 4, 12]} />
          <Cloth color={top} />
        </mesh>
      )}
      {bones && <Bone y={-0.12} length={0.18} />}
      <group ref={elbow} position-y={-0.255} rotation-x={-0.35}>
        <mesh>
          <sphereGeometry args={[0.044, 12, 10]} />
          {lower}
        </mesh>
        <mesh position-y={-0.1} castShadow>
          <capsuleGeometry args={[0.041, 0.16, 4, 12]} />
          {lower}
        </mesh>
        {bones && <Bone y={-0.1} length={0.16} />}
        <mesh position={[0, -0.24, 0.005]} scale={[0.8, 1.15, 0.6]} castShadow>
          <sphereGeometry args={[0.045, 14, 10]} />
          <Skin color={skin} />
        </mesh>
      </group>
    </group>
  )
}

function Leg({ side, pants, shoes, bones, stripes }: { side: 1 | -1; pants: string; shoes: string; bones: boolean; stripes?: string }) {
  return (
    <group position-x={side * 0.085}>
      <mesh position-y={0.64} castShadow>
        <capsuleGeometry args={[0.072, 0.28, 4, 12]} />
        <Cloth color={pants} />
      </mesh>
      <mesh position-y={0.29} castShadow>
        <capsuleGeometry args={[0.058, 0.3, 4, 12]} />
        <Cloth color={pants} />
      </mesh>
      {bones && (
        <>
          <Bone y={0.64} length={0.28} />
          <Bone y={0.29} length={0.3} />
        </>
      )}
      {/* Striped stockings under the witch's hem */}
      {stripes &&
        [0.11, 0.155, 0.2, 0.245].map((y) => (
          <mesh key={y} position-y={y} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.058, 0.011, 6, 18]} />
            <meshStandardMaterial color={stripes} emissive={stripes} emissiveIntensity={0.5} />
          </mesh>
        ))}
      <mesh position={[0, 0.05, 0.04]} rotation-x={Math.PI / 2} scale={[1.15, 1, 0.8]} castShadow>
        <capsuleGeometry args={[0.05, 0.13, 4, 12]} />
        <meshStandardMaterial color={shoes} roughness={stripes ? 0.35 : 0.6} />
      </mesh>
      {/* Pointed, slightly curled toe */}
      {stripes && (
        <mesh position={[0, 0.045, 0.165]} rotation-x={Math.PI / 2 - 0.35} scale={[1, 1, 0.75]}>
          <coneGeometry args={[0.045, 0.12, 14]} />
          <meshStandardMaterial color={shoes} roughness={0.35} />
        </mesh>
      )}
    </group>
  )
}

function HairStyle({ style, color, hat }: { style: Hair; color: string; hat: boolean }) {
  const mat = <meshStandardMaterial color={color} roughness={0.75} />
  const cap = (
    <mesh position={[0, 1.575, -0.022]} scale={[1.05, 0.95, 1.07]}>
      <sphereGeometry args={[0.125, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
      {mat}
    </mesh>
  )
  if (style === 'curly') {
    const curls: Vec3[] = [[0, 1.64, -0.01], [-0.07, 1.62, 0.02], [0.07, 1.62, 0.02], [-0.09, 1.58, -0.05], [0.09, 1.58, -0.05], [0, 1.6, -0.09], [-0.05, 1.63, -0.07], [0.05, 1.63, -0.07], [0, 1.63, 0.06]]
    return (
      <>
        {cap}
        {curls.map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.048, 10, 8]} />
            {mat}
          </mesh>
        ))}
      </>
    )
  }
  return (
    <>
      {cap}
      {style === 'long' && (
        <mesh position={[0, 1.44, -0.065]} scale={[1.1, 1, 0.5]}>
          <capsuleGeometry args={[0.105, 0.2, 4, 14]} />
          {mat}
        </mesh>
      )}
      {style === 'bun' && !hat && (
        <mesh position={[0, 1.665, -0.07]}>
          <sphereGeometry args={[0.055, 14, 10]} />
          {mat}
        </mesh>
      )}
    </>
  )
}

function Cape({ color }: { color: string }) {
  return (
    <group position-y={0.42}>
      {/* Back half of a cone: black outside, the chosen colour inside */}
      <mesh position-y={0.42} castShadow>
        <cylinderGeometry args={[0.23, 0.5, 1.32, 28, 1, true, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color={BLACK} side={DoubleSide} roughness={0.5} />
      </mesh>
      <mesh position-y={0.42} scale={0.97}>
        <cylinderGeometry args={[0.23, 0.5, 1.32, 28, 1, true, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} side={BackSide} />
      </mesh>
      {/* The high collar */}
      <mesh position-y={1.02}>
        <cylinderGeometry args={[0.26, 0.15, 0.26, 24, 1, true, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} side={DoubleSide} />
      </mesh>
    </group>
  )
}

/** Ribs and sternum on the chest, skull over the head; the limbs carry their own bones */
function Bones() {
  const ribs: [number, number][] = [[0.95, 0.146], [1.03, 0.15], [1.11, 0.158], [1.19, 0.166]]
  return (
    <>
      {ribs.map(([y, r]) => (
        <mesh key={y} position-y={y} rotation-x={Math.PI / 2} scale={[1, 0.74, 1]}>
          <torusGeometry args={[r, 0.012, 6, 28]} />
          <Glow />
        </mesh>
      ))}
      <mesh position={[0, 1.07, 0.112]}>
        <boxGeometry args={[0.03, 0.34, 0.02]} />
        <Glow />
      </mesh>
      <mesh position-y={1.53} scale={[0.95, 1.08, 1.01]}>
        <sphereGeometry args={[0.124, 22, 16]} />
        <Glow />
      </mesh>
      {[-0.045, 0.045].map((x) => (
        <mesh key={x} position={[x, 1.55, 0.105]}>
          <sphereGeometry args={[0.03, 10, 8]} />
          <meshBasicMaterial color="#000" />
        </mesh>
      ))}
      <mesh position={[0, 1.5, 0.118]}>
        <sphereGeometry args={[0.014, 8, 6]} />
        <meshBasicMaterial color="#000" />
      </mesh>
    </>
  )
}

function Witch({ color, phase }: { color: string; phase: number }) {
  const skirtRef = useRef<Group>(null!)
  // The skirt swings a beat behind the hips
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 4 + phase - 0.6
    skirtRef.current.rotation.y = Math.sin(t / 2) * 0.07
    skirtRef.current.rotation.z = Math.sin(t) * 0.012
  })
  return (
    <>
      <group ref={skirtRef}>
        <mesh geometry={OVERSKIRT} castShadow>
          <meshStandardMaterial color={BLACK} side={DoubleSide} roughness={0.45} metalness={0.15} />
        </mesh>
        <mesh geometry={PETTICOAT}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} side={DoubleSide} roughness={0.7} />
        </mesh>
      </group>
      {/* Corset sash at the waist */}
      <mesh position-y={0.9} scale={[1, 1, 0.72]}>
        <cylinderGeometry args={[0.142, 0.138, 0.07, 28, 1, true]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} side={DoubleSide} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.035, 0.9, 0.108]} rotation-z={s * 0.6} scale={[1, 0.6, 0.5]}>
          <sphereGeometry args={[0.035, 10, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
        </mesh>
      ))}
      <mesh position-y={1.63}>
        <cylinderGeometry args={[0.3, 0.3, 0.018, 32]} />
        <meshStandardMaterial color={BLACK} />
      </mesh>
      <mesh position-y={1.87} rotation-z={-0.12}>
        <coneGeometry args={[0.13, 0.46, 24]} />
        <meshStandardMaterial color={BLACK} />
      </mesh>
      <mesh position-y={1.675}>
        <cylinderGeometry args={[0.135, 0.15, 0.05, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} />
      </mesh>
    </>
  )
}

/** One of the four. In their own clothes until a look is picked, then dressed in it. Dances a little. */
function Figure({ tone, person, outfit, accent, phase }: { tone: string; person: Person; outfit: OutfitId | null; accent: string; phase: number }) {
  const shoulders = useRef<(Group | null)[]>([])
  const elbows = useRef<(Group | null)[]>([])
  const head = useRef<Group>(null!)
  const skeleton = outfit === 'skeleton'
  const witch = outfit === 'witch'
  const skin = skeleton ? BLACK : person.skin
  const top = outfit ? BLACK : tone
  const pants = outfit ? BLACK : person.pants
  const shoes = outfit ? BLACK : person.shoes
  const sleeve = person.longSleeves || outfit ? top : skin

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 4 + phase
    shoulders.current.forEach((g, i) => {
      if (!g) return
      const s = i === 0 ? 1 : -1
      g.rotation.x = -0.12 + Math.sin(t / 2) * 0.16 * s
    })
    elbows.current.forEach((g, i) => {
      if (g) g.rotation.x = -0.45 + Math.sin(t + i * Math.PI) * 0.18
    })
    head.current.rotation.x = Math.abs(Math.sin(t)) * 0.07 - 0.02
  })

  return (
    <group scale={person.height}>
      <Leg side={-1} pants={pants} shoes={shoes} bones={skeleton} stripes={witch ? accent : undefined} />
      <Leg side={1} pants={pants} shoes={shoes} bones={skeleton} stripes={witch ? accent : undefined} />
      {!witch && (
        <>
          {/* Hips and belt */}
          <mesh position-y={0.83} scale={[1, 0.55, 0.72]} castShadow>
            <sphereGeometry args={[0.155, 20, 14]} />
            <Cloth color={pants} />
          </mesh>
          {!outfit && (
            <mesh position-y={0.86} rotation-x={Math.PI / 2} scale={[1, 0.72, 1]}>
              <torusGeometry args={[0.128, 0.013, 6, 28]} />
              <meshStandardMaterial color="#3a2a1e" roughness={0.5} />
            </mesh>
          )}
        </>
      )}
      <mesh geometry={torso} position-y={0.82} scale={[1, 1, 0.7]} castShadow>
        <Cloth color={top} />
      </mesh>
      <Arm side={-1} top={top} sleeve={sleeve} skin={skin} bones={skeleton} shoulder={(g) => void (shoulders.current[0] = g)} elbow={(g) => void (elbows.current[0] = g)} />
      <Arm side={1} top={top} sleeve={sleeve} skin={skin} bones={skeleton} shoulder={(g) => void (shoulders.current[1] = g)} elbow={(g) => void (elbows.current[1] = g)} />
      <mesh position-y={1.41}>
        <cylinderGeometry args={[0.046, 0.052, 0.1, 14]} />
        <Skin color={skin} />
      </mesh>
      <group ref={head}>
        <mesh position-y={1.53} scale={[0.93, 1.05, 0.98]} castShadow>
          <sphereGeometry args={[0.12, 24, 18]} />
          <Skin color={skin} />
        </mesh>
        {!skeleton && (
          <>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.111, 1.525, 0]} scale={[0.5, 1, 0.8]}>
                <sphereGeometry args={[0.026, 10, 8]} />
                <Skin color={skin} />
              </mesh>
            ))}
            <mesh position={[0, 1.515, 0.117]} scale={[0.8, 1, 1]}>
              <sphereGeometry args={[0.018, 10, 8]} />
              <Skin color={skin} />
            </mesh>
            {!outfit &&
              [-0.04, 0.04].map((x) => (
                <mesh key={x} position={[x, 1.548, 0.107]}>
                  <sphereGeometry args={[0.012, 8, 6]} />
                  <meshBasicMaterial color="#1b1410" />
                </mesh>
              ))}
            <HairStyle style={person.hair} color={person.hairColor} hat={witch} />
          </>
        )}
        {/* Tonight is masked, so every look gets one */}
        {outfit && (
          <mesh position={[0, 1.55, 0.085]} scale={[0.98, 0.3, 0.42]}>
            <sphereGeometry args={[0.122, 16, 12]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.9} />
          </mesh>
        )}
        {skeleton && <Bones />}
      </group>
      {outfit === 'vampire' && <Cape color={accent} />}
      {witch && <Witch color={accent} phase={phase} />}
    </group>
  )
}

/**
 * The group stands on the floor you're on and wears what you pick (story: tonight/World.tsx CrewFigures).
 * The first figure turns slowly while a look is being chosen.
 */
export function CrewFigures({ show, floor, outfit, color }: { show: boolean; floor: FloorId; outfit: OutfitId | null; color: ColorId }) {
  const root = useRef<Group>(null!)
  const members = useRef<Group[]>([])
  const accent = COLORS.find((c) => c.id === color)!.hex
  const y = (vendor.floors.find((f) => f.id === floor)?.level ?? 0) * H
  const [x, base, z] = SPOTS[floor]

  useFrame(({ clock }, dt) => {
    const scale = MathUtils.damp(root.current.scale.x, show ? 1 : 0.001, 7, dt)
    root.current.scale.setScalar(scale)
    root.current.visible = scale > 0.01
    members.current.forEach((g, i) => {
      const beat = clock.elapsedTime * 4 + i * 1.3
      const tx = x + (i - (CREW_TONES.length - 1) / 2) * SPACING
      g.position.x = MathUtils.damp(g.position.x, tx, 3, dt)
      g.position.z = MathUtils.damp(g.position.z, z + (i % 2) * 0.28, 3, dt)
      // Bobbing to the music, and riding along when the floor changes
      g.position.y = MathUtils.damp(g.position.y, y + base, 2.5, dt) + Math.abs(Math.sin(beat)) * 0.012
      if (i === 0 && show) g.rotation.y += dt * 0.7
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
          <Figure tone={tone} person={PEOPLE[i]} outfit={outfit} accent={accent} phase={i * 1.3} />
        </group>
      ))}
      {/* A soft key light, or the look gets lost in the dark of the club */}
      {show && <pointLight position={[x + 0.8, y + 2.2, z + 2.4]} intensity={20} distance={9} color="#fff1e0" />}
    </group>
  )
}
