import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import Duck, { DuckMark, Ripples, type DuckState } from '../components/duck/Duck'
import VoiceOrb, { VoiceAura, VoiceHint } from '../components/duck/VoiceOrb'
import Journey from '../components/tonight/Journey'
import { useVoice } from '../lib/useVoice'

// Ripple, then dive. The world loads once the dive is under way: loading it freezes the page for a moment,
// and these animations keep running through that because they only touch transform and opacity.
const RIPPLE_MS = 600
const LOAD_DELAY_MS = 60
const DIVE_MS = 850

const THOUGHTS = ['What can I do in Basel?', 'Somewhere to dance tonight']

export default function Home() {
  const [query, setQuery] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [duck, setDuck] = useState<DuckState>('idle')
  const [gone, setGone] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  // The leave button navigates to / again: start over
  const { key } = useLocation()
  useEffect(() => {
    setQuery(null)
    setSent(null)
    setDuck('idle')
    setGone(false)
    return () => timers.current.forEach(clearTimeout)
  }, [key])

  const start = (text: string) => {
    setSent(text)
    setDuck('thinking')
    timers.current = [
      setTimeout(() => setDuck('dive'), RIPPLE_MS),
      setTimeout(() => setQuery(text), RIPPLE_MS + LOAD_DELAY_MS),
      setTimeout(() => setGone(true), RIPPLE_MS + DIVE_MS),
    ]
  }

  const voice = useVoice({
    scriptedLine: THOUGHTS[0],
    enabled: !sent,
    onBegin: () => setDuck('listening'),
    onEnd: () => setDuck('idle'),
    onFinal: start,
  })
  const words = sent ?? voice.interim

  return (
    <>
      {query && <Journey key={key} first={query} />}
      {!gone && (
        <main className={`pond-sky fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden px-6 transition-opacity duration-700 ${duck === 'dive' ? 'pointer-events-none opacity-0' : ''}`}>
          <VoiceAura on={voice.listening} level={voice.level} />
          <p className="absolute top-6 left-7 flex items-center gap-2 font-display text-xl font-medium tracking-tight">
            <DuckMark size={20} /> duck.
          </p>

          <div className="relative mb-20 grid place-items-center">
            <Ripples active={duck === 'thinking' || duck === 'dive'} />
            <VoiceOrb state={voice.listening ? 'listening' : sent ? 'thinking' : 'idle'} level={voice.level} size={210} label={voice.listening ? 'Stop listening' : 'Talk to Duck'} onPress={voice.press} onRelease={voice.release}>
              <Duck state={duck} size={120} />
            </VoiceOrb>
          </div>

          <div className="w-full max-w-3xl text-center">
            <h1 aria-live="polite" className={`mb-6 flex min-h-[1.2em] items-center justify-center font-display text-5xl font-medium tracking-tight transition-colors duration-300 ${voice.listening ? 'text-ink/70' : ''}`}>
              {words || (voice.listening ? '' : "What's on your mind?")}
            </h1>
            <div className={`transition-opacity duration-500 ${sent || voice.listening ? 'opacity-0' : ''}`}>
              <p className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-muted">
                {THOUGHTS.map((t) => (
                  <button key={t} onClick={() => start(t)} disabled={!!sent || voice.listening} className="underline-offset-4 transition-colors hover:text-mint hover:underline">
                    “{t}”
                  </button>
                ))}
              </p>
            </div>
            <div className={`transition-opacity duration-500 ${sent ? 'opacity-0' : ''}`}>
              <VoiceHint listening={voice.listening} missed={voice.missed} scripted={voice.scripted} />
            </div>
          </div>
        </main>
      )}
    </>
  )
}
