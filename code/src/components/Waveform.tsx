import { useEffect, useState } from 'react'

/** Live waveform for a microphone stream: clay bars driven by the real input level, mirrored around the middle. */
export default function Waveform({ stream, bars = 32, className = 'h-6' }: {
  stream: MediaStream | null
  bars?: number
  className?: string
}) {
  const [levels, setLevels] = useState(() => Array<number>(bars).fill(0.12))

  useEffect(() => {
    if (!stream) return
    let raf = 0
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.7
    ctx.createMediaStreamSource(stream).connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    // Voice sits in the lower part of the spectrum; low frequencies in the middle, highs to the sides
    const half = bars / 2
    const step = Math.max(1, Math.floor((data.length * 0.5) / half))
    const tick = () => {
      analyser.getByteFrequencyData(data)
      setLevels(Array.from({ length: bars }, (_, i) => 0.12 + (data[Math.floor(Math.abs(i - half + 0.5)) * step] / 255) * 0.88))
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      ctx.close()
    }
  }, [stream, bars])

  return (
    <div className={`flex items-center gap-[3px] ${className}`} aria-hidden>
      {levels.map((h, i) => (
        <span key={i} className="w-[3px] rounded-full bg-clay" style={{ height: `${h * 100}%` }} />
      ))}
    </div>
  )
}
