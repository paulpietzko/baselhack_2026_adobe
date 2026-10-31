import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'

function SpinningBox() {
  const ref = useRef<Mesh>(null)
  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.x += delta * 0.5
    ref.current.rotation.y += delta * 0.8
  })
  return (
    <mesh ref={ref}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  )
}

export default function Scene() {
  return (
    <main className="flex-1">
      <Canvas camera={{ position: [0, 0, 4] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 3, 3]} />
        <SpinningBox />
      </Canvas>
    </main>
  )
}
