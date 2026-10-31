import { useEffect, useState } from 'react'

const randomBars = (n: number) => Array.from({ length: n }, () => 0.15 + Math.random() * 0.85)

/** Mock audio waveform: clay bars that jump to random heights. */
export default function Waveform({ bars = 32, className = 'h-6' }: { bars?: number; className?: string }) {
  const [heights, setHeights] = useState(() => randomBars(bars))

  useEffect(() => {
    const id = setInterval(() => setHeights(randomBars(bars)), 120)
    return () => clearInterval(id)
  }, [bars])

  return (
    <div className={`flex items-center gap-[3px] ${className}`} aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-clay transition-[height] duration-100"
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </div>
  )
}
