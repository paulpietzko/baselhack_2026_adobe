import { useSyncExternalStore } from 'react'
import { readHand, type HandFrame, type Point } from './gestures'

// Hand tracking is off unless asked for: ?mode=gesture (or ?hands=on), the Y key, or the hidden dot in the bottom-right corner.
// It isn't remembered, so a reload is always the mocked voice and mouse to fall back on. ?hands=sim gives a teammate's
// mouse the powers of a hand. The microphone is decided when the page opens and never by the switch, see liveVoice.
export type HandsMode = 'off' | 'camera' | 'sim'
export type HandsStatus = 'off' | 'starting' | 'seen' | 'waiting' | 'failed'
export type HandsState = { mode: HandsMode; status: HandsStatus; rate: number }

const params = new URLSearchParams(window.location.search)
const fromUrl = params.get('hands')

let state: HandsState = { mode: fromUrl === 'sim' ? 'sim' : fromUrl === 'on' || params.get('mode') === 'gesture' ? 'camera' : 'off', status: 'off', rate: 0 }
/** Opened in gesture mode: use the real microphone. Fixed at load, so flipping the hands mid-demo can't touch the voice. */
export const liveVoice = state.mode !== 'off'
const listeners = new Set<() => void>()
const set = (patch: Partial<HandsState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export const setHandsStatus = (status: HandsStatus, rate = state.rate) => {
  if (state.status !== status || state.rate !== rate) set({ status, rate })
}

export function toggleHands() {
  set({ mode: state.mode === 'off' ? 'camera' : 'off', status: 'off' })
}

export const useHands = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )

export type OnHand = (frame: HandFrame | null, landmarks: Point[] | null, now: number) => void

// Never faster than this. The model works in its own thread, one picture at a time, so a slow machine just gets fewer.
const MIN_GAP_MS = 40

type FromWorker = { type: 'ready' } | { type: 'failed'; message: string } | { type: 'result'; t: number; landmarks: Point[][]; worldLandmarks: Point[][] }

// One worker for the life of the page, so switching hands on and off never builds the model again
let worker: { thread: Worker; ready: Promise<void> } | null = null
let onResult: ((r: Extract<FromWorker, { type: 'result' }>) => void) | null = null
function getWorker() {
  if (worker) return worker
  const thread = new Worker(new URL('./handWorker.ts', import.meta.url), { type: 'module' })
  const ready = new Promise<void>((resolve, reject) => {
    thread.onerror = (e) => reject(new Error(e.message))
    thread.onmessage = ({ data }: MessageEvent<FromWorker>) => {
      if (data.type === 'ready') resolve()
      else if (data.type === 'failed') reject(new Error(data.message))
      else onResult?.(data)
    }
  })
  // A later attempt gets a fresh start
  ready.catch(() => {
    thread.terminate()
    worker = null
  })
  thread.postMessage({ type: 'init', base: new URL(`${import.meta.env.BASE_URL}mediapipe`, window.location.href).href })
  worker = { thread, ready }
  return worker
}

/** Gets the model ready before anyone asks, so the first flip of the switch is as quick as the rest. The fallback doesn't need it, so failing is fine. */
export function warmHands() {
  getWorker().ready.catch(() => {})
}

/** Camera → model → frames. Everything runs on this device: no frame ever leaves the browser. */
export function startCamera(onHand: OnHand) {
  let stopped = false
  let raf = 0
  let stream: MediaStream | null = null

  const run = async () => {
    setHandsStatus('starting', 0)
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false })
    // Switched off again before the camera answered: don't leave it running
    if (stopped) return stream.getTracks().forEach((t) => t.stop())
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    await video.play()

    const { thread, ready } = getWorker()
    await ready
    if (stopped) return

    let busy = false
    let lastRun = 0
    let lastVideoTime = -1
    let wasPinching = false
    let count = 0
    let countFrom = performance.now()
    onResult = ({ t, landmarks, worldLandmarks }) => {
      busy = false
      if (stopped) return
      const image = landmarks[0]
      const world = worldLandmarks[0]
      const frame = image && world ? readHand(image, world, wasPinching, video.videoWidth / video.videoHeight) : null
      wasPinching = frame?.pinching ?? false
      onHand(frame, image ?? null, t)
      count++
      if (t - countFrom > 1000) {
        setHandsStatus(frame ? 'seen' : 'waiting', Math.round((count * 1000) / (t - countFrom)))
        count = 0
        countFrom = t
      } else if (frame && state.status !== 'seen') {
        setHandsStatus('seen')
      }
    }
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (busy || now - lastRun < MIN_GAP_MS || video.currentTime === lastVideoTime) return
      busy = true
      lastRun = now
      lastVideoTime = video.currentTime
      createImageBitmap(video).then(
        (bitmap) => {
          if (stopped) return bitmap.close()
          thread.postMessage({ type: 'frame', bitmap, t: now }, [bitmap])
        },
        () => {
          busy = false
        },
      )
    }
    raf = requestAnimationFrame(tick)
  }

  run().catch((e) => {
    console.error(e)
    if (!stopped) setHandsStatus('failed', 0)
  })

  return () => {
    stopped = true
    cancelAnimationFrame(raf)
    stream?.getTracks().forEach((t) => t.stop())
  }
}

/**
 * The stand-in for when the camera can't be trusted: a teammate's mouse is the hand. Holding the button
 * is a pinch, the wheel pulls and pushes it, P raises a palm and F makes a fist.
 * The real pointer's own clicks are swallowed, so nothing happens twice.
 */
export function startSim(onHand: OnHand) {
  const hand: HandFrame = { x: 0.5, y: 0.5, scale: 0.2, pose: 'point', pinching: false }
  // The real pointer's own clicks stay out of it, apart from the hidden switch
  const isSwitch = (e: Event) => e.target instanceof Element && !!e.target.closest('button[data-hand-ignore]')
  const swallow = (e: Event) => {
    if (!e.isTrusted || isSwitch(e)) return
    e.stopPropagation()
    e.preventDefault()
  }
  const move = (e: MouseEvent) => {
    // Only the real mouse: the hand's own synthetic moves over the map would pin it where it is
    if (!e.isTrusted) return
    hand.x = e.clientX / window.innerWidth
    hand.y = e.clientY / window.innerHeight
  }
  const down = (e: Event) => {
    if (isSwitch(e)) return
    swallow(e)
    hand.pinching = true
  }
  const up = (e: Event) => {
    swallow(e)
    hand.pinching = false
    hand.scale = 0.2
  }
  const wheel = (e: WheelEvent) => {
    if (!hand.pinching) return
    e.stopPropagation()
    hand.scale = Math.max(0.05, hand.scale - e.deltaY * 0.0005)
  }
  const pose = (on: boolean) => (e: KeyboardEvent) => {
    if (e.key === 'p' || e.key === 'f') hand.pose = !on ? 'point' : e.key === 'p' ? 'palm' : 'fist'
  }
  const keydown = pose(true)
  const keyup = pose(false)
  window.addEventListener('mousemove', move)
  window.addEventListener('pointerdown', down, true)
  window.addEventListener('pointerup', up, true)
  window.addEventListener('click', swallow, true)
  window.addEventListener('wheel', wheel, true)
  window.addEventListener('keydown', keydown)
  window.addEventListener('keyup', keyup)
  const timer = setInterval(() => onHand({ ...hand }, null, performance.now()), MIN_GAP_MS)
  setHandsStatus('seen', Math.round(1000 / MIN_GAP_MS))
  return () => {
    clearInterval(timer)
    window.removeEventListener('mousemove', move)
    window.removeEventListener('pointerdown', down, true)
    window.removeEventListener('pointerup', up, true)
    window.removeEventListener('click', swallow, true)
    window.removeEventListener('wheel', wheel, true)
    window.removeEventListener('keydown', keydown)
    window.removeEventListener('keyup', keyup)
  }
}

/** What the hand is on right now, for "that one" */
export const pointing: { el: HTMLElement | null } = { el: null }
