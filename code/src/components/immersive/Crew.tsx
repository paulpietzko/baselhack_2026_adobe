import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, DoubleSide, MathUtils, type Group } from 'three'
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
          <Figure tone={tone} outfit={outfit} accent={accent} />
        </group>
      ))}
      {/* A soft key light, or the look gets lost in the dark of the club */}
      {show && <pointLight position={[x + 0.8, y + 2.2, z + 2.4]} intensity={20} distance={9} color="#fff1e0" />}
    </group>
  )
}
