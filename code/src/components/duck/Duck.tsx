export type DuckState = 'idle' | 'listening' | 'thinking' | 'dive' | 'surface'

/** The full character, cut from flat shapes. While it thinks, the shapes drift apart. Once exploring starts, DuckMark takes over. */
export default function Duck({ state = 'idle', size = 96 }: { state?: DuckState; size?: number }) {
  return (
    <svg viewBox="0 0 120 100" width={size} height={size * (100 / 120)} className={`duck duck-${state}`} role="img" aria-label="Duck">
      <path className="duck-body" d="M6 40C14 50 27 55 44 55H106C108 79 89 96 58 96C28 96 9 76 6 40Z" fill="#F9DB70" />
      <path className="duck-wing" d="M34 62H76C76 76 64 86 50 84C41 83 35 74 34 62Z" fill="#EFC858" />
      <circle className="duck-head" cx="82" cy="33" r="23" fill="#F9DB70" />
      <path className="duck-beak" d="M103 25L118 33L103 41Z" fill="#FF9C6D" stroke="#FF9C6D" strokeWidth="3" strokeLinejoin="round" />
      <circle className="duck-eye" cx="89" cy="27" r="3.6" fill="#1D3040" />
    </svg>
  )
}

/** The head and beak: the logo, and the duck's voice next to everything it says. While it thinks, the beak comes loose and circles. */
export function DuckMark({ size = 24, thinking = false }: { size?: number; thinking?: boolean }) {
  return (
    <svg viewBox="0 0 28 24" width={size * (28 / 24)} height={size} aria-hidden className={`duck-mark ${thinking ? 'duck-mark-thinking' : ''}`}>
      <circle className="duck-mark-head" cx="11" cy="12" r="10" fill="#F9DB70" />
      <path className="duck-mark-beak" d="M20.5 8L27 12L20.5 16Z" fill="#FF9C6D" stroke="#FF9C6D" strokeWidth="1.2" strokeLinejoin="round" />
      <circle className="duck-mark-eye" cx="14" cy="9.5" r="1.6" fill="#1D3040" />
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
