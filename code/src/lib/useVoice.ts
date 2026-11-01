import { useCallback, useEffect, useRef, useState } from 'react'

// Longer than this and letting go is what ends the sentence: hold to talk. Shorter is a tap, which listens until you pause.
const HOLD_MS = 350
const SCRIPT_START_MS = 800
const SCRIPT_WORD_MS = 280
const SCRIPT_PAUSE_MS = 400

type RecognitionEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

const speech = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
const RecognitionImpl = speech.SpeechRecognition ?? speech.webkitSpeechRecognition
// ?voice=scripted for a stage too loud to trust a microphone, ?voice=live to use one without gestures
const VOICE_PARAM = new URLSearchParams(window.location.search).get('voice')
// Errors that won't fix themselves. Hearing nothing isn't one of them.
const BROKEN = ['not-allowed', 'service-not-allowed', 'network', 'audio-capture', 'language-not-supported']

/** English speech recognition has never heard of these places */
const PLACE_NAMES: [RegExp, string][] = [
  [/\b(haven|hafen|harbou?r|half an?d?) ?(light|licht|lit)\b/gi, 'Hafenlicht'],
  [/\bmask(en)? ?(k|c)h?amm?er\b/gi, 'Maskenkammer'],
]
const heard = (raw: string) => PLACE_NAMES.reduce((text, [wrong, right]) => text.replace(wrong, right), raw)

/** How loud the room is, 0 to 1. Without a usable microphone it's a plausible envelope, so the orb still moves. */
function startMeter(level: { current: number }, real: boolean) {
  let closed = false
  let raf = 0
  let analyser: AnalyserNode | null = null
  let close = () => {}
  if (real && navigator.mediaDevices) {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const ctx = new AudioContext()
        close = () => {
          stream.getTracks().forEach((t) => t.stop())
          void ctx.close()
        }
        if (closed) return close()
        analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        ctx.createMediaStreamSource(stream).connect(analyser)
      })
      .catch(() => {})
  }
  const tick = (now: number) => {
    if (analyser) {
      const data = new Uint8Array(analyser.fftSize)
      analyser.getByteTimeDomainData(data)
      const power = data.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) / data.length
      level.current = Math.min(1, Math.sqrt(power) * 5)
    } else {
      level.current = 0.25 + 0.5 * Math.abs(Math.sin(now / 130) * Math.sin(now / 47))
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => {
    closed = true
    cancelAnimationFrame(raf)
    level.current = 0
    close()
  }
}

/**
 * Press to talk, on the screen or with the space bar. Interim guesses arrive as they're made, so the
 * world can start moving before the sentence ends. Unless `live`, or with no recognition available, it plays
 * `scriptedLine` instead and says so through `scripted`, so a demo never passes a script off as hearing.
 */
export function useVoice({ scriptedLine, live = true, enabled = true, palm = true, onBegin, onInterim, onFinal, onEnd }: {
  /** What the stand-in hears, worked out at the moment it's pressed */
  scriptedLine?: () => string
  /** Use the real microphone */
  live?: boolean
  enabled?: boolean
  /** Whether a raised palm starts listening. Pressing always does. */
  palm?: boolean
  onBegin?: () => void
  onInterim?: (text: string) => void
  onFinal: (text: string) => void
  /** Every way a turn can stop, including cancelling */
  onEnd?: () => void
}) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [missed, setMissed] = useState(false)
  const [broken, setBroken] = useState(!RecognitionImpl)
  const scripted = VOICE_PARAM === 'scripted' || broken || !(live || VOICE_PARAM === 'live')
  const level = useRef(0)
  const latest = useRef({ scriptedLine, enabled, palm, onBegin, onInterim, onFinal, onEnd })
  latest.current = { scriptedLine, enabled, palm, onBegin, onInterim, onFinal, onEnd }
  // The turn under way: how to end it gracefully, and how to drop it
  const turn = useRef<{ finish: () => void; drop: () => void } | null>(null)
  const pressedAt = useRef(0)

  const close = useCallback((text: string, wasCancelled = false) => {
    turn.current?.drop()
    turn.current = null
    setListening(false)
    setInterim('')
    setMissed(!text && !wasCancelled)
    latest.current.onEnd?.()
    if (text) latest.current.onFinal(text)
  }, [])

  const say = useCallback((text: string) => {
    setInterim(text)
    latest.current.onInterim?.(text)
  }, [])

  const runScript = useCallback(() => {
    const line = latest.current.scriptedLine?.() ?? ''
    const words = line.split(' ').filter(Boolean)
    const stopMeter = startMeter(level, false)
    const timers = words.map((_, i) => setTimeout(() => say(words.slice(0, i + 1).join(' ')), SCRIPT_START_MS + i * SCRIPT_WORD_MS))
    timers.push(setTimeout(() => close(line), SCRIPT_START_MS + words.length * SCRIPT_WORD_MS + SCRIPT_PAUSE_MS))
    turn.current = {
      finish: () => close(line),
      drop: () => {
        timers.forEach(clearTimeout)
        stopMeter()
      },
    }
  }, [close, say])

  const runRecognition = useCallback(() => {
    const r = new RecognitionImpl!()
    r.lang = 'en-US'
    r.interimResults = true
    r.continuous = false
    let text = ''
    let broken = false
    let live = true
    const stopMeter = startMeter(level, true)
    r.onresult = (e) => {
      text = heard(Array.from(e.results).map((result) => result[0].transcript).join('')).trim()
      say(text)
    }
    r.onerror = (e) => {
      broken = BROKEN.includes(e.error)
    }
    r.onend = () => {
      if (!live) return
      if (!broken) return close(text)
      stopMeter()
      live = false
      setBroken(true)
      runScript()
    }
    turn.current = {
      finish: () => r.stop(),
      drop: () => {
        live = false
        stopMeter()
        r.abort()
      },
    }
    r.start()
  }, [close, runScript, say])

  const cancel = useCallback(() => {
    if (turn.current) close('', true)
  }, [close])

  const press = useCallback(() => {
    if (!latest.current.enabled) return
    if (turn.current) return turn.current.finish()
    pressedAt.current = performance.now()
    setInterim('')
    setMissed(false)
    setListening(true)
    latest.current.onBegin?.()
    if (scripted) runScript()
    else runRecognition()
  }, [scripted, runScript, runRecognition])

  const release = useCallback(() => {
    if (turn.current && performance.now() - pressedAt.current > HOLD_MS) turn.current.finish()
  }, [])

  useEffect(() => {
    // A control you tabbed to keeps its space bar. One you clicked doesn't.
    const owned = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLElement && e.target.matches('button:focus-visible, a:focus-visible'))
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return cancel()
      if (e.code !== 'Space' || owned(e) || !latest.current.enabled) return
      e.preventDefault()
      if (!e.repeat) press()
    }
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || owned(e) || !latest.current.enabled) return
      e.preventDefault()
      release()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    // A raised palm and a closed fist, from the hand layer
    const talk = () => {
      if (latest.current.palm) press()
    }
    window.addEventListener('duck:talk', talk)
    window.addEventListener('duck:cancel', cancel)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('duck:talk', talk)
      window.removeEventListener('duck:cancel', cancel)
    }
  }, [cancel, press, release])

  useEffect(() => () => turn.current?.drop(), [])

  return { listening, interim, missed, scripted, level, press, release, cancel }
}

let current: SpeechSynthesisUtterance | null = null

/** Duck's voice: the browser's, a natural one if it has it */
export function speak(text: string, onDone: () => void) {
  const synth = window.speechSynthesis
  if (!synth) return onDone()
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const voices = synth.getVoices().filter((v) => v.lang.startsWith('en'))
  utterance.voice = voices.find((v) => /natural|neural|google/i.test(v.name)) ?? voices[0] ?? null
  utterance.rate = 1.05
  // Some browsers never report the end, and the music would stay down for good
  const cap = setTimeout(() => finish(), 1500 + text.split(' ').length * 600)
  const finish = () => {
    clearTimeout(cap)
    if (current !== utterance) return
    current = null
    onDone()
  }
  utterance.onend = finish
  utterance.onerror = finish
  current = utterance
  synth.speak(utterance)
}

export function hush() {
  current = null
  window.speechSynthesis?.cancel()
}
