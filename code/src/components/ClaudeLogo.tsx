// Approximation of the Claude spark: rays of slightly varying length around a center
const RAYS = [1, 0.78, 0.92, 0.7, 1, 0.82, 0.95, 0.72, 0.98, 0.8, 0.9, 0.75]

export default function ClaudeLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden>
      {RAYS.map((len, i) => (
        <rect
          key={i}
          x={-4.5}
          y={-46 * len}
          width={9}
          height={46 * len}
          rx={4.5}
          fill="var(--color-clay)"
          transform={`rotate(${(360 / RAYS.length) * i})`}
        />
      ))}
    </svg>
  )
}
