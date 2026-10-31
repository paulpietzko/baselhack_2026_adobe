import { useEffect, useRef, useState } from 'react'

// Web Speech API isn't in TypeScript's DOM lib yet; just the bits we use
type SpeechResult = { isFinal: boolean; 0: { transcript: string } }
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { results: ArrayLike<SpeechResult> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

const Recognition = (
  typeof window === 'undefined'
    ? undefined
    : ((window as unknown as Record<string, unknown>).SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition)
) as RecognitionCtor | undefined

const MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked',
  'service-not-allowed': 'Speech recognition is not allowed here',
  'audio-capture': 'No microphone found',
  network: 'Speech service unreachable',
}

/**
 * Real speech-to-text with the browser's Web Speech API (Chrome, Edge, Safari).
 * Shows interim results while you talk and hands the transcript to `onDone` when you pause or stop.
 * Opens the mic once up front and shares that stream (e.g. for the waveform), so the browser asks only once.
 */
export function useSpeech(onDone: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [text, setText] = useState('')
  const [final, setFinal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const rec = useRef<Recognition | null>(null)
  const cancelled = useRef(false)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => () => rec.current?.abort(), [])

  const start = async () => {
    if (!Recognition || rec.current) return
    setError(null)
    // One permission prompt: grant the mic here, recognition then reuses that permission
    let mic: MediaStream
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      return setError(MESSAGES['not-allowed'])
    }
    const r = new Recognition()
    r.lang = navigator.language
    r.interimResults = true
    r.continuous = false // ends by itself after a pause
    let transcript = ''

    r.onresult = (e) => {
      const results = Array.from(e.results)
      transcript = results.map((res) => res[0].transcript).join('')
      setText(transcript)
      setFinal(results.at(-1)?.isFinal ?? false)
    }
    r.onerror = (e) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') setError(MESSAGES[e.error] ?? `Speech error: ${e.error}`)
    }
    r.onend = () => {
      rec.current = null
      mic.getTracks().forEach((t) => t.stop())
      setStream(null)
      setListening(false)
      setText('')
      if (!cancelled.current && transcript.trim()) done.current(transcript.trim())
    }

    cancelled.current = false
    setText('')
    setFinal(false)
    setStream(mic)
    rec.current = r
    r.start()
    setListening(true)
  }

  /** Stop listening and send what was heard so far */
  const stop = () => rec.current?.stop()
  /** Stop listening and throw the transcript away */
  const cancel = () => {
    cancelled.current = true
    rec.current?.abort()
  }

  return { supported: !!Recognition, listening, text, final, error, stream, start, stop, cancel }
}
