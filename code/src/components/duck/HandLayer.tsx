import { useEffect, useRef, useState } from 'react'
import { createGestureReader, createSmoother, type GestureEvent, type HandFrame, type Point } from '../../lib/gestures'
import { pointing, setHandsStatus, startCamera, startSim, toggleHands, useHands, warmHands } from '../../lib/hands'

// Consequences take longer than a flick: booking and leaving fill a ring first
const HOLD_MS = 1200
// A hand is a blunt instrument, so targets reach out for it
const MAGNET_PX = 44
const RING_LENGTH = 2 * Math.PI * 26
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]]
const TARGETS = 'button:not(:disabled), a[href], [data-hand-target], [data-hand-peek]'
const HAND_PX = 150
const ASPECT = 4 / 3
const WARM_AFTER_MS = 1000

/** The nearest thing the hand could mean, if any */
function findTarget(x: number, y: number) {
  let best: HTMLElement | null = null
  let bestDistance = MAGNET_PX
  let bestArea = Infinity
  document.querySelectorAll<HTMLElement>(TARGETS).forEach((el) => {
    // A button inside a grouped target is reached through the group
    if (el.parentElement?.closest('[data-hand-target]') || el.closest('[data-hand-ignore]')) return
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return
    const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom))
    if (d > bestDistance || (d === bestDistance && r.width * r.height >= bestArea)) return
    if (!el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true })) return
    // Covered by something else, like the opening screen over the world
    const top = document.elementFromPoint(Math.min(Math.max(x, r.left + 1), r.right - 1), Math.min(Math.max(y, r.top + 1), r.bottom - 1))
    if (!top || !(el === top || el.contains(top) || top.contains(el))) return
    best = el
    bestDistance = d
    bestArea = r.width * r.height
  })
  return best as HTMLElement | null
}

const fire = (el: Element, type: string, init: MouseEventInit, Kind: typeof MouseEvent = MouseEvent) => el.dispatchEvent(new Kind(type, { bubbles: true, cancelable: true, ...init }))
const firePointer = (el: Element, type: string, init: MouseEventInit) => fire(el, type, { pointerId: 1, pointerType: 'mouse', isPrimary: true, ...init } as PointerEventInit, PointerEvent)

const activate = (el: HTMLElement) => (el.matches('[data-hand-target]') ? el.querySelector('button') : el)?.click()

/**
 * The hand, on screen: its skeleton, a reticle that snaps to what it's on, and a thread of light back to Duck.
 * It speaks to the rest of the app the way a person would, through pointer events and clicks,
 * so every button and the 3D club work without knowing that hands exist.
 */
export default function HandLayer() {
  const { mode, status, rate } = useHands()
  const canvas = useRef<HTMLCanvasElement>(null)
  const cursor = useRef<HTMLDivElement>(null)
  const ring = useRef<SVGCircleElement>(null)
  const reticle = useRef<HTMLDivElement>(null)
  const thread = useRef<SVGLineElement>(null)
  const note = useRef<HTMLSpanElement>(null)
  // A browser won't play sound until someone has really touched the page, and a gesture doesn't count
  const [silent, setSilent] = useState(() => navigator.userActivation?.hasBeenActive === false)

  // Ready before anyone asks, once the page has settled, so the switch never causes a hitch
  useEffect(() => {
    const t = setTimeout(warmHands, WARM_AFTER_MS)
    return () => clearTimeout(t)
  }, [])

  // Y flips the hands and nothing else: caught first and stopped there, so no other key handler ever sees it.
  // By letter, not key position, so it's the key marked Y on a Swiss or German keyboard too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'y' || e.metaKey || e.ctrlKey || e.altKey) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (!e.repeat) toggleHands()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  useEffect(() => {
    if (!silent) return
    const heard = () => setSilent(false)
    window.addEventListener('pointerdown', heard)
    window.addEventListener('keydown', heard)
    return () => {
      window.removeEventListener('pointerdown', heard)
      window.removeEventListener('keydown', heard)
    }
  }, [silent])

  useEffect(() => {
    if (mode === 'off') return
    const reader = createGestureReader()
    const smoothX = createSmoother()
    const smoothY = createSmoother()
    let seen = false
    let x = 0
    let y = 0
    let bones: Point[] | null = null
    let target: HTMLElement | null = null
    // The 3D club underneath, when no element is closer
    let world: Element | null = null
    // Or the map itself, where the club's floors can be pointed at directly
    let onMap = false
    let held: { el: HTMLElement | null; world: Element | null; map: Element | null; since: number; x: number; y: number; done: boolean } | null = null
    let raf = 0

    const setTarget = (next: HTMLElement | null) => {
      if (next === target) return
      if (target) {
        target.classList.remove('hand-focus')
        fire(target, 'mouseout', { clientX: x, clientY: y })
      }
      target = next
      pointing.el = next
      if (next) {
        next.classList.add('hand-focus')
        fire(next, 'mouseover', { clientX: x, clientY: y })
      }
    }

    const setWorld = (next: Element | null) => {
      if (world && world !== next) firePointer(world, 'pointerleave', { clientX: x, clientY: y })
      world = next
      if (next) firePointer(next, 'pointermove', { clientX: x, clientY: y })
    }

    const aim = () => {
      const el = findTarget(x, y)
      setTarget(el)
      const under = el ? null : document.elementFromPoint(x, y)
      // Not the map's canvas, and not the canvas itself: drag-to-orbit listens there, and has no real pointer to capture
      const isMap = under instanceof HTMLCanvasElement && !!under.closest('.mapboxgl-map')
      setWorld(under instanceof HTMLCanvasElement && !isMap ? under.parentElement : null)
      onMap = isMap
      if (isMap) fire(under, 'mousemove', { clientX: x, clientY: y })
    }

    const handle = (e: GestureEvent, now: number) => {
      if (e.type === 'talk') window.dispatchEvent(new Event('duck:talk'))
      if (e.type === 'cancel') window.dispatchEvent(new Event('duck:cancel'))
      if (e.type === 'zoom') {
        window.dispatchEvent(new CustomEvent('duck:zoom', { detail: e.dir }))
        reticle.current?.classList.remove('hand-holding')
        if (held) held.done = true
      }
      if (e.type === 'pinchStart') {
        // The target is settled now: drifting while you pinch can't change your mind for you
        held = { el: target, world, map: onMap ? document.elementFromPoint(x, y) : null, since: now, x, y, done: false }
        if (world) firePointer(world, 'pointerdown', { clientX: x, clientY: y, button: 0 })
      }
      if (e.type === 'pinchEnd' && held) {
        const { el, world: w, done } = held
        const chosen = !e.lost && !e.zoomed && !done
        if (w) {
          firePointer(w, 'pointerup', { clientX: held.x, clientY: held.y, button: 0 })
          if (chosen) fire(w, 'click', { clientX: held.x, clientY: held.y, button: 0 })
        }
        if (el && chosen && !el.hasAttribute('data-hand-hold')) activate(el)
        // A map click is a press and a release in one spot, so pressing can't start a drag
        if (held.map && chosen) {
          const at = { clientX: held.x, clientY: held.y, button: 0 }
          fire(held.map, 'mousedown', at)
          fire(held.map, 'mouseup', at)
          fire(held.map, 'click', at)
        }
        held = null
      }
    }

    const onHand = (frame: HandFrame | null, landmarks: Point[] | null, now: number) => {
      if (frame) {
        // A raised palm or a fist isn't aiming at anything, so the cursor waits where it was
        if (!seen || frame.pinching || (frame.pose !== 'palm' && frame.pose !== 'fist')) {
          x = smoothX(frame.x, now) * window.innerWidth
          y = smoothY(frame.y, now) * window.innerHeight
        }
        seen = true
        if (!reader.pinching() && !frame.pinching) aim()
      } else if (seen && !reader.pinching()) {
        seen = false
        setTarget(null)
        setWorld(null)
      }
      bones = landmarks
      reader.read(frame, now).forEach((e) => handle(e, now))
    }

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const c = canvas.current
      if (!c) return
      const dpr = Math.min(window.devicePixelRatio, 1.5)
      const W = window.innerWidth
      const H = window.innerHeight
      if (c.width !== Math.round(W * dpr)) {
        c.width = Math.round(W * dpr)
        c.height = Math.round(H * dpr)
      }
      const g = c.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)

      if (cursor.current) {
        cursor.current.style.opacity = seen ? '1' : '0'
        cursor.current.style.transform = `translate(${x}px, ${y}px) scale(${1 + Math.max(-0.4, Math.min(reader.pull(), 1)) * 0.6})`
        cursor.current.classList.toggle('hand-pinching', reader.pinching())
      }

      // Hold-to-confirm
      let progress = 0
      if (held?.el?.hasAttribute('data-hand-hold') && !held.done) {
        progress = Math.min((now - held.since) / HOLD_MS, 1)
        if (progress === 1) {
          held.done = true
          activate(held.el)
        }
      }
      if (ring.current) ring.current.style.strokeDashoffset = String(RING_LENGTH * (1 - progress))

      // The reticle follows the element if the element moves, as cards do while the map flies
      const on = held?.el ?? target
      if (reticle.current) {
        if (on && seen) {
          const r = on.getBoundingClientRect()
          const s = reticle.current.style
          s.opacity = '1'
          s.transform = `translate(${r.left - 6}px, ${r.top - 6}px)`
          s.width = `${r.width + 12}px`
          s.height = `${r.height + 12}px`
        } else {
          reticle.current.style.opacity = '0'
        }
      }

      // Duck's attention: a thread from the orb to whatever you're on
      const orbs = document.querySelectorAll('[data-duck-orb]')
      const orb = orbs[orbs.length - 1]?.getBoundingClientRect()
      if (thread.current) {
        if (orb && on && seen) {
          const r = on.getBoundingClientRect()
          thread.current.setAttribute('x1', String(orb.left + orb.width / 2))
          thread.current.setAttribute('y1', String(orb.top + orb.height / 2))
          thread.current.setAttribute('x2', String(r.left + r.width / 2))
          thread.current.setAttribute('y2', String(r.top + r.height / 2))
          thread.current.style.opacity = '0.55'
        } else {
          thread.current.style.opacity = '0'
        }
      }

      if (note.current) {
        const pull = reader.pull()
        const holdsTarget = !!held?.el?.hasAttribute('data-hand-hold') && !held.done
        note.current.textContent = holdsTarget ? 'Keep holding' : held && !held.el && !held.world && !held.done ? (pull < 0 ? 'Push to step back' : 'Pull to go closer') : ''
      }

      if (!seen || !bones) return
      // Drawn so the raised fingertip sits about where the cursor is, which is where it feels like you're pointing
      const flat = bones.map((b) => ({ x: (1 - b.x) * ASPECT, y: b.y }))
      const size = Math.hypot(flat[5].x - flat[0].x, flat[5].y - flat[0].y) || 1
      const k = HAND_PX / size
      const up = { x: flat[9].x - flat[0].x, y: flat[9].y - flat[0].y }
      const ox = x - (flat[5].x + up.x * 0.75) * k
      const oy = y - (flat[5].y + up.y * 0.75) * k
      g.globalCompositeOperation = 'lighter'
      g.lineCap = 'round'
      g.beginPath()
      BONES.forEach(([a, b]) => {
        g.moveTo(flat[a].x * k + ox, flat[a].y * k + oy)
        g.lineTo(flat[b].x * k + ox, flat[b].y * k + oy)
      })
      g.strokeStyle = 'rgb(169 189 216 / 0.16)'
      g.lineWidth = 12
      g.stroke()
      g.strokeStyle = 'rgb(228 233 240 / 0.7)'
      g.lineWidth = 1.5
      g.stroke()
      g.fillStyle = '#e4e9f0'
      flat.forEach((p) => {
        g.beginPath()
        g.arc(p.x * k + ox, p.y * k + oy, 2.5, 0, Math.PI * 2)
        g.fill()
      })
    }
    raf = requestAnimationFrame(draw)

    const stop = mode === 'sim' ? startSim(onHand) : startCamera((frame, landmarks, now) => {
      onHand(frame, landmarks, now)
    })
    return () => {
      stop()
      cancelAnimationFrame(raf)
      setTarget(null)
      setWorld(null)
      pointing.el = null
      setHandsStatus('off', 0)
    }
  }, [mode])

  const label = mode === 'sim' ? 'Simulated hand' : status === 'starting' ? 'Camera…' : status === 'failed' ? 'No camera' : status === 'waiting' ? 'Show your hand' : status === 'seen' ? `${rate} Hz` : ''

  return (
    <>
      {/* The switch only we know about: faint when off, blue when on, yellow if the camera failed. Out of reach of the hand and the voice. */}
      <button
        data-hand-ignore
        aria-label={mode === 'off' ? 'Turn hand gestures on' : 'Turn hand gestures off'}
        aria-pressed={mode !== 'off'}
        onClick={(e) => {
          toggleHands()
          e.currentTarget.blur()
        }}
        className="group fixed right-0 bottom-0 z-[70] grid size-8 place-items-center outline-none"
      >
        <span className={`size-1.5 rounded-full transition-colors ${status === 'failed' ? 'bg-duck' : mode === 'off' ? 'bg-white/20 group-hover:bg-white/50' : 'bg-accent'}`} />
      </button>
      {mode !== 'off' && (
        <div data-hand-ignore className="fixed top-3.5 right-[7.5rem] z-[60] flex items-center gap-2">
          <span className="text-right text-xs text-muted tabular-nums [text-shadow:0_1px_6px_rgb(13_24_34/0.95)]">
            {label}
            {silent && <span className="block text-duck">Click once for sound</span>}
          </span>
        </div>
      )}
      {mode !== 'off' && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[55] overflow-hidden">
          <canvas ref={canvas} className="absolute inset-0 size-full" />
          <svg className="absolute inset-0 size-full">
            <line ref={thread} className="hand-thread" />
          </svg>
          <div ref={reticle} className="hand-reticle" style={{ opacity: 0 }} />
          <div ref={cursor} className="hand-cursor" style={{ opacity: 0 }}>
            <svg viewBox="0 0 60 60" className="absolute -top-[30px] -left-[30px] size-[60px] -rotate-90">
              <circle cx="30" cy="30" r="26" className="hand-ring-track" />
              <circle ref={ring} cx="30" cy="30" r="26" className="hand-ring" style={{ strokeDasharray: RING_LENGTH, strokeDashoffset: RING_LENGTH }} />
            </svg>
            <span ref={note} className="absolute top-9 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap text-ink [text-shadow:0_1px_6px_rgb(13_24_34/0.95)]" />
          </div>
        </div>
      )}
    </>
  )
}
