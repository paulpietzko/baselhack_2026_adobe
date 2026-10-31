// Dug's logo: a yellow triangle whose tip points right like a beak (also public/dug.svg for the favicon)
export default function ClaudeLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className="shrink-0">
      <polygon points="13.6,8 13.6,92 86.4,50" fill="#ffc934" />
    </svg>
  )
}
