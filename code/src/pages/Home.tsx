import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router'
import { BookOpen, Code, Coffee, Dices, Lightbulb, PenLine, ShoppingBag, Sparkles } from 'lucide-react'
import { CASINO } from '../data/casino'
import ChatInput from '../components/ChatInput'
import ClaudeLogo from '../components/ClaudeLogo'
import { BRAND } from '../brand'
import GlobeView from '../components/GlobeView'
import { BASEL_PLACES, BASEL_TITLE } from '../data/basel'
import type { FloorId } from '../data/floors'
import { COLORS, outfitById } from '../data/costumes'
import type { OutfitChoice } from '../components/immersive/FloorTiles'
import { searchPlaces, type Answer } from '../data/search'
import { pointing } from '../lib/hands'

const SUGGESTIONS = [
  { icon: PenLine, label: 'Write' },
  { icon: BookOpen, label: 'Learn' },
  { icon: Code, label: 'Code' },
  { icon: Coffee, label: 'Life stuff' },
  { icon: Lightbulb, label: `${BRAND}'s choice` },
]

// Intents "detected" from the conversation once the hidden gem is unlocked
const INTENTS = ['Techno', 'Hardcore']
const CASINO_INTENTS = ['Roulette', 'Black Jack', 'Poker']

// Demo steps ("a" or a click): while the camera flies to the next stop, the bar shows what the agent is doing
type Pending = 'gem' | 'shop' | 'casino' | 'route'
const THINKING: Record<Pending, string> = {
  gem: 'Finding a hidden gem…',
  shop: 'Finding your look…',
  casino: 'Finding the next stop…',
  route: 'Planning your night…',
}

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Home() {
  const [query, setQuery] = useState<string | null>(null)
  // Asked with the presentation mock: keep the conversation in the voice bar ("Ask a follow-up…")
  const [voice, setVoice] = useState(false)
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
  const ask = (text: string, viaMock = false) => {
    setQuery(text)
    setUnlocked(false)
    setPending(null)
    if (viaMock) setVoice(true)
  }
  // "New chat" navigates to / again: start over
  const { key } = useLocation()
  useEffect(() => {
    setQuery(null)
    setFloor(null)
    setLook(null)
    setCasino(false)
    setRoute(false)
    setVoice(false)
    setUnlocked(false)
    setPending(null)
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
    const advance = () => {
      if (pending) return
      // At the mall: on to the casino (then the night's route); otherwise unlock the hidden gem
      if (look && !floor) {
        if (!casino) {
          setCasino(true)
          setPending('casino')
        } else if (!route) {
          setRoute(true)
          setPending('route')
        }
      } else if (!unlocked) {
        setUnlocked(true)
        setPending('gem')
      }
    }
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.toLowerCase() === 'a') advance()
    }
    // Pinch and pull goes one level closer, and pushing steps back out
    const onZoom = (e: Event) => {
      if ((e as CustomEvent<'in' | 'out'>).detail === 'out') return document.querySelector<HTMLElement>('[data-hand-back]')?.click()
      if (focused && !look && !floor) {
        if (pointing.el) pointing.el.click()
        else setFloor('main-hall')
      } else advance()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('duck:zoom', onZoom)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('duck:zoom', onZoom)
    }
  }, [query, look, floor, casino, route, unlocked, pending, focused])

  // Claude answers with the map right in the chat: the agent searches, the globe spins until its picks arrive
  if (query) {
    return (
      <main className="flex min-h-0 flex-1 flex-col">
        {/* With the sidebar collapsed the map sits behind this layer, so only the messages take clicks.
            On a floor it drops its stacking context, so the map can go fullscreen above the chat. */}
        <div className={`relative ${floor ? '' : 'z-10'} flex min-h-0 flex-1 flex-col overflow-y-auto sidebar-collapsed:pointer-events-none`}>
          {/* Fullscreen map: the map is the answer, so the messages step aside */}
          <div className="pointer-events-auto relative z-10 mx-auto w-full max-w-3xl px-6 pt-8 sidebar-collapsed:hidden">
            <p className="ml-auto w-fit max-w-[80%] rounded-2xl bg-bubble px-4 py-2.5">{query}</p>
            <p className="mt-6 flex w-fit items-center gap-2 rounded-full font-serif text-lg sidebar-collapsed:bg-bg/80 sidebar-collapsed:px-3 sidebar-collapsed:py-1 sidebar-collapsed:backdrop-blur">
              <span className={answer ? '' : 'animate-pulse'}>
                <ClaudeLogo size={20} />
              </span>
              {answer ? answer.title : 'Searching…'}
            </p>
            {answer?.intro && <p className="mt-1 ml-7 text-sm text-muted">{answer.intro}</p>}
            {failed && <p className="mt-1 ml-7 text-xs text-clay">Live search unavailable, showing demo picks.</p>}
          </div>
          <GlobeView
            area={answer?.area}
            key={query}
            places={places}
            fixedCamera={voice}
            focused={focused}
            searching={answer ? null : (step ?? '')}
            // The building's lower clay floor is the Main Hall, the upper one the Rooftop
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
        </div>
        <div className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-4">
          {/* No pills over the night's overview: its cards already list the stops */}
          {unlocked && !(route && casino && look) && (() => {
            // At the casino its games; at the mall the pills follow the look; otherwise the club's intents
            const atCasino = casino && !!look
            const outfit = look && outfitById(look.outfit)
            const color = look && COLORS.find((c) => c.id === look.color)!
            const pills: { label: string; dot?: string }[] = atCasino
              ? CASINO_INTENTS.map((label) => ({ label }))
              : outfit && color
                ? [{ label: outfit.name }, { label: color.name, dot: color.hex }]
                : INTENTS.map((label) => ({ label }))
            return (
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
                  <span className="flex animate-[pill-in_650ms_cubic-bezier(0.34,1.56,0.64,1)_both,gem-glow_1.6s_ease-in-out_650ms_3] items-center gap-1.5 rounded-full bg-clay px-3 py-1 text-xs font-semibold text-bg shadow-[0_0_16px_rgb(217_119_87/0.35)]">
                    <Sparkles size={13} /> Hidden gem unlocked
                  </span>
                )}
                {pills.map((p, i) => (
                  <span
                    key={p.label}
                    className="flex animate-pill-in items-center gap-1.5 rounded-full border border-border bg-surface/90 px-3 py-1 text-xs font-medium text-ink backdrop-blur"
                    style={{ animationDelay: `${250 + i * 150}ms` }}
                  >
                    {p.dot && <span className="size-2 rounded-full" style={{ background: p.dot }} />}
                    {p.label}
                  </span>
                ))}
              </div>
            )
          })()}
          {/* No "Ask a follow-up…" bar until there is an answer to follow up on */}
          {(answer || !voice) && (
            <ChatInput
              compact
              onSend={ask}
              placeholder={`Reply to ${BRAND}…`}
              voiceMode={voice}
              // Hands stay busy once the night is under way, pointing and pinching: a new question would throw it away
              palm={!unlocked}
              thinking={pending ? THINKING[pending] : undefined}
              onEndVoice={() => setVoice(false)}
            />
          )}
          <p className="mt-2 text-center text-[11px] text-muted">
            {BRAND} can make mistakes. He apologises in advance, profusely.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24">
      <h1 className="mb-8 flex items-center gap-3 font-serif text-4xl font-normal">
        <ClaudeLogo size={48} />
        {greeting()}, John Doe
      </h1>
      <div className="w-full max-w-2xl">
        <ChatInput onSend={ask} />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map(({ icon: Icon, label }) => (
            <button
              key={label}
              className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-muted hover:bg-bubble hover:text-ink"
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
