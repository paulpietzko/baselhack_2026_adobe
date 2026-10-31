export type DuckState = 'idle' | 'listening' | 'thinking' | 'dive' | 'surface'

/** The full character, for the moments that earn it. Once exploring starts, DuckMark takes over. */
export default function Duck({ state = 'idle', size = 96 }: { state?: DuckState; size?: number }) {
  return (
    <svg viewBox="0 0 120 100" width={size} height={size * (100 / 120)} className={`duck duck-${state}`} role="img" aria-label="Duck">
      <path d="M12 62c0-5 4-8 9-6 8 3 15 2 21-3 9-8 24-9 37-3 13 7 24 2 28-4 2 12-2 25-13 33-9 7-21 9-34 9-28 0-48-11-48-26Z" fill="#F9DB70" />
      <path d="M42 66c7 9 22 10 32 2-1 10-9 16-19 15-9-1-14-8-13-17Z" fill="#EFC858" />
      <circle cx="78" cy="30" r="22" fill="#F9DB70" />
      <path d="M97 25c7-1 15 1 19 6 1 2 0 3-2 4-6 2-14 2-20 0Z" fill="#FF9C6D" />
      <circle cx="84" cy="25" r="3.2" fill="#091B1A" />
    </svg>
  )
}

/** The abstract head and beak: the logo, and the duck's voice next to everything it says */
export function DuckMark({ size = 24, thinking = false }: { size?: number; thinking?: boolean }) {
  return (
    <svg viewBox="0 0 28 24" width={size * (28 / 24)} height={size} aria-hidden className={thinking ? 'duck-mark-thinking' : ''}>
      <circle cx="11" cy="12" r="10" fill="#F9DB70" />
      <path d="M19 7.5c3-.5 6.5.4 8.4 2.8.5.7.2 1.5-.6 1.8-2.7 1-6 1-8.8 0Z" fill="#FF9C6D" />
      <circle cx="13.5" cy="9.5" r="1.5" fill="#091B1A" />
    </svg>
  )
}

/** Intention, spreading outwards */
export function Ripples({ rings = 4, active = false }: { rings?: number; active?: boolean }) {
  return (
    <span aria-hidden className={`ripples ${active ? 'ripples-active' : ''}`}>
      {Array.from({ length: rings }, (_, i) => (
        <span key={i} style={{ animationDelay: `${(i * (active ? 0.5 : 2.2)) / rings}s` }} />
      ))}
    </span>
  )
}
