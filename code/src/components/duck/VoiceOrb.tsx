import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

const LISTENING = ['#56e6b3', '#a6f26d', '#c9f7e4']
const SPEAKING = ['#f9db70', '#ff9c6d', '#56e6b3']
const POINTS = 96
const CANVAS_SCALE = 2.6
const SPIN: Record<OrbState, number> = { idle: 0.25, listening: 1, thinking: 2.6, speaking: 1.2 }

/** Duck's presence: rings of light that take their shape from whoever is talking. Press it to talk. */
export default function VoiceOrb({ state, level, size, label, onPress, onRelease, children }: {
  state: OrbState
  /** Microphone loudness, 0 to 1 */
  level: RefObject<number>
  size: number
  label: string
  onPress: () => void
  onRelease: () => void
  children: ReactNode
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!
    const px = size * CANVAS_SCALE
    const dpr = Math.min(window.devicePixelRatio, 2)
    canvas.current!.width = px * dpr
    canvas.current!.height = px * dpr
    ctx.scale(dpr, dpr)
    let energy = 0
    let phase = 0
    let last = performance.now()
    let raf = 0

    const draw = (now: number) => {
      const s = stateRef.current
      const t = now / 1000
      const target = s === 'listening' ? level.current : s === 'speaking' ? 0.2 + 0.4 * Math.abs(Math.sin(t * 9) * Math.sin(t * 3.3)) : s === 'thinking' ? 0.28 : 0.06 + 0.03 * Math.sin(t)
      energy += (target - energy) * 0.14
      phase += Math.min((now - last) / 1000, 0.05) * SPIN[s]
      last = now

      ctx.clearRect(0, 0, px, px)
      ctx.globalCompositeOperation = 'lighter'
      const c = px / 2
      const colors = s === 'speaking' ? SPEAKING : LISTENING
      const glow = ctx.createRadialGradient(c, c, 0, c, c, size * (0.75 + energy * 0.5))
      glow.addColorStop(0, `${colors[0]}${Math.round((0.14 + energy * 0.3) * 255).toString(16).padStart(2, '0')}`)
      glow.addColorStop(1, `${colors[0]}00`)
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, px, px)

      colors.forEach((color, ring) => {
        const offset = ring * 2.1
        const amp = size * (0.015 + energy * 0.17)
        ctx.beginPath()
        for (let i = 0; i <= POINTS; i++) {
          const a = (i / POINTS) * Math.PI * 2
          const wobble = Math.sin(3 * a + phase * 2 + offset) + 0.5 * Math.sin(5 * a - phase * 3 + offset * 2) + 0.25 * Math.sin(9 * a + phase * 5)
          const r = size * (0.5 + ring * 0.035) + amp * wobble
          const x = c + Math.cos(a) * r
          const y = c + Math.sin(a) * r
          if (i) ctx.lineTo(x, y)
          else ctx.moveTo(x, y)
        }
        ctx.strokeStyle = color
        ctx.globalAlpha = 0.14
        ctx.lineWidth = 9
        ctx.stroke()
        ctx.globalAlpha = 0.85 - ring * 0.2
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.globalAlpha = 1
      })
      if (!still) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
    // Without motion there's no loop, so each new state gets its one frame
  }, [size, level, still && state]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <button
      aria-label={label}
      aria-pressed={state === 'listening'}
      onPointerDown={(e) => {
        if (e.button === 0) onPress()
      }}
      onPointerUp={onRelease}
      onClick={(e) => {
        // Enter or space on a focused orb: there was no pointer to press it with
        if (e.detail === 0) onPress()
      }}
      className="relative grid cursor-pointer touch-none place-items-center rounded-full outline-none select-none focus-visible:ring-2 focus-visible:ring-mint"
      style={{ width: size, height: size }}
    >
      <canvas ref={canvas} aria-hidden className="pointer-events-none absolute" style={{ width: size * CANVAS_SCALE, height: size * CANVAS_SCALE, left: size * (1 - CANVAS_SCALE) / 2, top: size * (1 - CANVAS_SCALE) / 2 }} />
      <span className={`relative grid place-items-center transition-transform duration-300 ${state === 'listening' ? 'scale-110' : ''}`}>{children}</span>
    </button>
  )
}

/** The room lights up at the edges while Duck listens, and breathes with your voice */
export function VoiceAura({ on, level }: { on: boolean; level: RefObject<number> }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!on) {
      el.current!.style.opacity = '0'
      return
    }
    let raf = 0
    let shown = 0
    const tick = () => {
      shown += (level.current - shown) * 0.15
      el.current!.style.opacity = String(0.4 + shown * 0.6)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [on, level])
  return <div ref={el} aria-hidden className="voice-aura" />
}

/** Words surfacing one at a time, about as fast as they're said */
export function Spoken({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span key={text} className={className}>
      {text.split(' ').map((word, i) => (
        <span key={i} className="spoken-word" style={{ animationDelay: `${i * 70}ms` }}>
          {word}{' '}
        </span>
      ))}
    </span>
  )
}

/** The only instructions on screen, and the place a scripted microphone admits it */
export function VoiceHint({ listening, missed, scripted }: { listening: boolean; missed: boolean; scripted: boolean }) {
  return (
    <p className="mt-3 text-center text-xs text-muted [text-shadow:0_1px_6px_rgb(3_12_11/0.95)]">
      {listening ? 'Listening. Esc to cancel' : missed ? "Didn't catch that. Hold space and try again" : 'Hold space or tap Duck to talk'}
      {scripted && <span className="block opacity-75">Scripted demo voice, microphone not in use</span>}
    </p>
  )
}
