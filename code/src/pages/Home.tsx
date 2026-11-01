import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Dices, ShoppingBag, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { CASINO } from '../data/casino'
import Duck, { DuckMark, Ripples, type DuckState } from '../components/duck/Duck'
import VoiceOrb, { Spoken, VoiceAura, VoiceHint } from '../components/duck/VoiceOrb'
import HandLayer from '../components/duck/HandLayer'
import { liveVoice, pointing } from '../lib/hands'
import { asksToGoBack, matchLabel, pointsAtSomething } from '../lib/voiceTargets'
import { hush, speak, useVoice } from '../lib/useVoice'
import GlobeView from '../components/GlobeView'
import { BASEL_PLACES, BASEL_TITLE } from '../data/basel'
import type { FloorId } from '../data/floors'
import { COLORS, outfitById } from '../data/costumes'
import { TILES_WIDTH, type OutfitChoice } from '../components/immersive/FloorTiles'
import { searchPlaces, type Answer } from '../data/search'

// Ripple, then dive. The world loads once the dive is under way: loading it freezes the page for a moment,
// and these animations keep running through that because they only touch transform and opacity.
const RIPPLE_MS = 600
const LOAD_DELAY_MS = 60
const DIVE_MS = 850
// A first line can be replaced straight away: don't start saying one that's about to go
const SPEAK_DELAY_MS = 500

const THOUGHTS = ['What can I do in Basel?', 'Somewhere to dance tonight']
// The second beat of the story: the venues are on the map, and the crew knows what it's in the mood for
const HALLOWEEN_LINE = "Hm, it's Halloween, we're feeling like going partying."

// Intents "detected" from the conversation once the hidden gem is unlocked
const INTENTS = ['Techno', 'Hardcore']
const CASINO_INTENTS = ['Roulette', 'Black Jack', 'Poker']

// Demo steps ("a" or a click): while the camera flies to the next stop, Duck says what it's doing
type Pending = 'gem' | 'shop' | 'casino' | 'route'
const THINKING: Record<Pending, string> = {
  gem: 'Finding a hidden gem…',
  shop: 'Finding your look…',
  casino: 'Finding the next stop…',
  route: 'Planning your night…',
}

// Said while out on the night, these move it on, the same as pressing "a"
const MOVES_ON = /\b(hafenlicht|club|party|partying|halloween|dance|dancing|gem|casino|next|money|plan|route|overview|whole night)\b/i

/** Everything that could be pressed right now, and what it's called */
function pressable() {
  return [...document.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')].filter((el) => !el.closest('[data-hand-ignore]') && el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }))
}
const labelOf = (el: HTMLElement) => el.getAttribute('aria-label') ?? el.innerText.split('\n')[0] ?? ''
const press = (el: HTMLElement) => (el.matches('[data-hand-target]') ? el.querySelector('button') : el)?.click()
const HANDS_ONLY = 'That takes your own hand.'
const COMMITS = /\b(hold|book|reserve|buy|pay|confirm)\b/i

const roundBtn = 'spatial-glass grid size-11 place-items-center rounded-full text-ink transition-transform hover:scale-105'

export default function Home() {
  const [query, setQuery] = useState<string | null>(null)
  // The opening screen: the question has been asked, and the duck is on its way under
  const [sent, setSent] = useState<string | null>(null)
  const [duck, setDuck] = useState<DuckState>('idle')
  const [gone, setGone] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [sound, setSound] = useState(true)
  // Duck's answer to something it was asked to do, rather than a place it found
  const [note, setNote] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState(false)
  // Demo: pressing "a" unlocks the hidden gem (Hafenlicht) on the map
  const [unlocked, setUnlocked] = useState(false)
  // Once the pills have popped in (~1s) and a 0.5s pause, fly into the club in 3D
  const [focused, setFocused] = useState(false)
  // Clicked one of Hafenlicht's floors on the map: standing on it, in the immersive view
  const [floor, setFloor] = useState<FloorId | null>(null)
  // At the mall with the crew's look: the pills show what we're shopping for
  const [look, setLook] = useState<OutfitChoice | null>(null)
  // Demo: pressing "a" again at the mall flies on to the casino
  const [casino, setCasino] = useState(false)
  // …and once more at the casino zooms out over the whole night: mall → casino → club
  const [route, setRoute] = useState(false)
  // A demo transition is under way (cleared when GlobeView's camera arrives)
  const [pending, setPending] = useState<Pending | null>(null)
  useEffect(() => {
    setFocused(false)
    setFloor(null)
    setLook(null)
    setCasino(false)
    setRoute(false)
    if (!unlocked) return
    const t = setTimeout(() => setFocused(true), 1050 + 500)
    return () => clearTimeout(t)
  }, [unlocked])
  // The agent's answer (real search, see server/agent.ts); null while it's searching
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [failed, setFailed] = useState(false)
  // What the agent is looking up right now (live from the server), shown on the map while it searches
  const [step, setStep] = useState<string | null>(null)
  const places = useMemo(
    () => answer && [...answer.places, ...(unlocked ? BASEL_PLACES.filter((p) => p.hidden) : [])],
    [answer, unlocked],
  )

  // The next step of the night: on to the casino and the night's route from the mall, otherwise the hidden gem
  const advance = () => {
    if (pending) return false
    if (look && !floor) {
      if (!casino) {
        setCasino(true)
        setPending('casino')
      } else if (!route) {
        setRoute(true)
        setPending('route')
      } else return false
    } else if (!unlocked) {
      setUnlocked(true)
      setPending('gem')
    } else return false
    return true
  }

  const ask = (text: string) => {
    setQuery(text)
    setUnlocked(false)
    setPending(null)
  }

  const start = (text: string) => {
    setSent(text)
    setDuck('thinking')
    timers.current = [
      setTimeout(() => setDuck('dive'), RIPPLE_MS),
      setTimeout(() => ask(text), RIPPLE_MS + LOAD_DELAY_MS),
      setTimeout(() => setGone(true), RIPPLE_MS + DIVE_MS),
    ]
  }

  const voice = useVoice({
    live: liveVoice,
    // The mocked voice tells the story: each press says the next line of the night
    scriptedLine: () => {
      if (!sent) return THOUGHTS[0]
      if (floor) return document.querySelector<HTMLElement>('[data-next-line]')?.innerText ?? ''
      if (!answer) return ''
      if (!unlocked) return HALLOWEEN_LINE
      if (!look) return focused ? 'Take us to the Main Hall' : ''
      if (!casino) return 'On to the casino'
      return route ? '' : 'Now the whole night'
    },
    enabled: !sent || gone,
    // Hands stay busy once the night is under way, pointing and pinching: a palm only talks up to the venue overview
    palm: !unlocked,
    onBegin: () => {
      hush()
      setSpeaking(false)
      if (!sent) setDuck('listening')
    },
    onEnd: () => {
      if (!sent) setDuck('idle')
    },
    onFinal: (text) => {
      if (!sent) return start(text)
      setNote(null)
      if (asksToGoBack(text)) {
        const back = document.querySelector<HTMLElement>('[data-hand-back]')
        if (back) return back.click()
      }
      // "That one" means what you're pointing at
      const pointed = pointing.el ?? document.querySelector<HTMLElement>('button:hover, a:hover')
      if (pointsAtSomething(text) && pointed) {
        if (pointed.hasAttribute('data-hand-hold')) return setNote(HANDS_ONLY)
        return press(pointed)
      }
      // Anything on screen can be said by name. A microphone mishears, so what has consequences still needs a hand.
      const controls = pressable()
      if (COMMITS.test(text) && controls.some((c) => c.hasAttribute('data-hand-hold') && !c.matches('[aria-label="Leave"]'))) return setNote(HANDS_ONLY)
      const hit = matchLabel(text, controls.map(labelOf))
      if (hit !== null) {
        if (controls[hit].hasAttribute('data-hand-hold')) return setNote(HANDS_ONLY)
        return press(controls[hit])
      }
      if (MOVES_ON.test(text) && advance()) return
      // Before the night has a direction, a new thought is a new search. After that it would throw the night away.
      if (!unlocked) return ask(text)
      setNote('Say what you see, or point at it.')
    },
  })

  // The leave button navigates to / again: start over
  const { key } = useLocation()
  useEffect(() => {
    setQuery(null)
    setSent(null)
    setDuck('idle')
    setGone(false)
    setFloor(null)
    setLook(null)
    setCasino(false)
    setRoute(false)
    setUnlocked(false)
    setPending(null)
    setNote(null)
    hush()
    return () => timers.current.forEach(clearTimeout)
  }, [key])

  useEffect(() => {
    if (!query) return
    setAnswer(null)
    setFailed(false)
    setStep(null)
    const abort = new AbortController()
    const onPhotos = (photos: Record<string, string>) =>
      setAnswer((a) =>
        a && { ...a, places: a.places.map((p) => (photos[p.id] && !p.image ? { ...p, image: photos[p.id], imageNearby: true } : p)) },
      )
    searchPlaces(query, { onStep: setStep, onPhotos }, abort.signal)
      .then(setAnswer)
      .catch((e) => {
        if (abort.signal.aborted) return
        // Search unavailable (no key, offline…): say so and show the demo picks
        console.error(e)
        setFailed(true)
        setAnswer({ title: BASEL_TITLE, intro: '', area: 'Basel, Switzerland', places: BASEL_PLACES.filter((p) => !p.hidden) })
      })
    return () => abort.abort()
  }, [query])

  useEffect(() => {
    if (!query) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.toLowerCase() === 'a') advance()
    }
    // Pinch and pull goes one level closer, and pushing steps back out
    const onZoom = (e: Event) => {
      if ((e as CustomEvent<'in' | 'out'>).detail === 'out') return document.querySelector<HTMLElement>('[data-hand-back]')?.click()
      if (focused && !look && !floor) {
        if (pointing.el) press(pointing.el)
        else setFloor('main-hall')
      } else advance()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('duck:zoom', onZoom)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('duck:zoom', onZoom)
    }
  }, [query, look, floor, casino, route, unlocked, pending, focused]) // eslint-disable-line react-hooks/exhaustive-deps

  // Only the latest line is on screen: the world is the answer, not a transcript
  const reply = note ?? (pending ? THINKING[pending] : !answer ? 'Looking around…' : unlocked ? '' : answer.title)
  const thinking = !!pending || (!!query && !answer)

  useEffect(() => {
    if (!sound || thinking || voice.listening || (floor && !note) || !reply) {
      hush()
      setSpeaking(false)
      return
    }
    const t = setTimeout(() => {
      setSpeaking(true)
      speak(answer?.intro ? `${reply}. ${answer.intro}` : reply, () => setSpeaking(false))
    }, SPEAK_DELAY_MS)
    return () => clearTimeout(t)
  }, [reply, sound, floor]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => hush(), [])

  const atCasino = casino && !!look
  const outfit = look && outfitById(look.outfit)
  const color = look && COLORS.find((c) => c.id === look.color)!
  // At the casino its games; at the mall the pills follow the look; otherwise the club's intents
  const pills: { label: string; dot?: string }[] = atCasino
    ? CASINO_INTENTS.map((label) => ({ label }))
    : outfit && color
      ? [{ label: outfit.name }, { label: color.name, dot: color.hex }]
      : INTENTS.map((label) => ({ label }))
  // The night's overview has cards listing every stop, and they need the room
  const overview = route && casino && !!look

  const pillRow = unlocked && !overview && !floor && (
    <div key={atCasino ? 'casino' : outfit ? `${outfit.id}-${color!.id}` : 'club'} className="mb-3 flex flex-wrap items-center justify-center gap-2">
      {atCasino ? (
        <span
          className="flex animate-pill-in items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-black"
          style={{ background: CASINO.color, boxShadow: `0 0 16px ${CASINO.color}66` }}
        >
          <Dices size={13} /> {CASINO.name}
        </span>
      ) : outfit && color ? (
        <span
          className="flex animate-pill-in items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ background: color.hex, boxShadow: `0 0 16px ${color.hex}66` }}
        >
          <ShoppingBag size={13} /> Look found
        </span>
      ) : (
        <span className="flex animate-[pill-in_650ms_cubic-bezier(0.34,1.56,0.64,1)_both,clay-glow_1.6s_ease-in-out_650ms_3] items-center gap-1.5 rounded-full bg-clay px-3 py-1 text-xs font-semibold text-bg shadow-[0_0_16px_rgb(217_119_87/0.35)]">
          <Sparkles size={13} /> Hidden gem unlocked
        </span>
      )}
      {pills.map((p, i) => (
        <span
          key={p.label}
          className="spatial-glass flex animate-pill-in items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-ink"
          style={{ animationDelay: `${250 + i * 150}ms` }}
        >
          {p.dot && <span className="size-2 rounded-full" style={{ background: p.dot }} />}
          {p.label}
        </span>
      ))}
    </div>
  )

  return (
    <>
      {query && (
        <main className="immersive fixed inset-0 overflow-hidden bg-bg font-sans">
          <GlobeView
            area={answer?.area}
            key={query}
            places={places}
            fixedCamera={voice.scripted}
            focused={focused}
            searching={answer ? null : (step ?? '')}
            // The building's lower floor is the Main Hall, the upper one the Rooftop
            onClubFloorsClick={(f) => setFloor(f === 'lower' ? 'main-hall' : 'rooftop')}
            floor={floor}
            onFloor={setFloor}
            onShop={(choice) => {
              setLook(choice)
              setPending(choice ? 'shop' : null)
              if (!choice) {
                setCasino(false)
                setRoute(false)
              }
            }}
            casino={casino}
            onCasino={(on) => {
              setCasino(on)
              setPending(on ? 'casino' : null)
              if (!on) setRoute(false)
            }}
            route={route}
            onRoute={(on) => {
              setRoute(on)
              setPending(on ? 'route' : null)
            }}
            onArrive={() => setPending(null)}
          />

          <p className="pointer-events-none absolute top-5 left-6 z-10 flex items-center gap-1.5 font-display text-lg font-medium tracking-tight [text-shadow:0_1px_8px_rgb(13_24_34/0.95)]">
            <DuckMark size={18} /> duck.
          </p>
          <div className="absolute top-3.5 right-4 z-20 flex gap-2">
            <button onClick={() => setSound((s) => !s)} aria-label={sound ? 'Mute Duck' : 'Unmute Duck'} className={roundBtn}>
              {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
            <Link to="/" aria-label="Leave" data-hand-hold className={roundBtn}>
              <X size={19} />
            </Link>
          </div>

        </main>
      )}
      {query && (
        // Above the floors too: Duck comes along inside the club, just to the side of its tiles
        <>
          <div className="pointer-events-none fixed inset-0 z-[44]">
            <VoiceAura on={voice.listening} level={voice.level} />
          </div>
          <div className="immersive pointer-events-none fixed bottom-5 left-0 z-[45] mx-auto flex max-w-2xl flex-col items-center px-6 text-center" style={{ right: floor ? TILES_WIDTH : 0 }}>
            <span key={`ripple-${reply}`} aria-hidden className="intent-ripple" />
            {pillRow}
            {voice.listening ? (
              <p aria-live="polite" className="mb-5 min-h-[1.2em] font-display text-[32px] leading-[1.2] font-medium tracking-tight text-ink/80 [text-shadow:0_2px_16px_rgb(13_24_34/0.95)]">
                {voice.interim}
              </p>
            ) : (
              !overview &&
              (!floor || note) &&
              reply && (
                <div key={reply} className={`mb-4 text-ink [text-shadow:0_2px_12px_rgb(13_24_34/0.95)] ${thinking ? '' : 'caption-fade'}`}>
                  <p aria-live="polite" className="font-display text-[27px] leading-[1.2] font-medium tracking-tight">
                    <Spoken text={reply} />
                  </p>
                </div>
              )
            )}
            <div className="pointer-events-auto">
              <VoiceOrb
                state={voice.listening ? 'listening' : thinking ? 'thinking' : speaking ? 'speaking' : 'idle'}
                level={voice.level}
                size={64}
                label={voice.listening ? 'Stop listening' : 'Talk to Duck'}
                onPress={voice.press}
                onRelease={voice.release}
              >
                <DuckMark size={24} thinking={thinking} />
              </VoiceOrb>
            </div>
            {failed && !unlocked && <p className="mt-1 text-[11px] text-muted">Demo picks: live search unavailable</p>}
            <VoiceHint listening={voice.listening} missed={voice.missed} scripted={voice.scripted} palm={!unlocked} />
          </div>
        </>
      )}
      <HandLayer />
      {!gone && (
        <main className={`atlas-sky fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden px-6 transition-opacity duration-700 ${duck === 'dive' ? 'pointer-events-none opacity-0' : ''}`}>
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
                  {sent || voice.interim}
                </h1>
                {/* Only if the microphone hasn't worked out: words to press instead */}
                {voice.missed && !sent && (
                  <p className="mb-1 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-muted">
                    {THOUGHTS.map((t) => (
                      <button key={t} onClick={() => start(t)} className="underline-offset-4 transition-colors hover:text-accent hover:underline">
                        “{t}”
                      </button>
                    ))}
                  </p>
                )}
                <div className={`transition-opacity duration-500 ${sent ? 'opacity-0' : ''}`}>
                  <VoiceHint listening={voice.listening} missed={voice.missed} scripted={voice.scripted} palm={!unlocked} />
                </div>
              </div>
        </main>
      )}
    </>
  )
}
