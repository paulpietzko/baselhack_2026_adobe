import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Volume2, VolumeX, X } from 'lucide-react'
import Duck, { DuckMark } from '../duck/Duck'
import VoiceOrb, { Spoken, VoiceAura, VoiceHint } from '../duck/VoiceOrb'
import GlobeView from '../GlobeView'
import Scene, { H, LIGHTS, type Framing, type Light } from '../acme/Venue'
import { Anchors, ClubNight, GroundGlow, Lens, Searchlights } from './Club'
import { CasinoTiles, OutfitTiles, PlanTiles, ShopTiles, TILES_WIDTH, VenueTiles } from './Tiles'
import { Casino, CrewFigures, Storefront } from './World'
import { vendor } from '../../data/vendor'
import {
  BASEL_DAY_PLACES,
  BASEL_PLACES,
  CAMERAS,
  CASINO_PLACE,
  HAFENLICHT_PLACE,
  ROUTE_TO_CASINO,
  ROUTE_TO_CLUB,
  pickupPlace,
  storePlace,
  type Place,
} from '../../data/basel'
import { CLUB, FLOOR_EXTRAS, PEOPLE, SHOPS, applyPublished, floorById, outfitById, shopById, type FloorId } from '../../data/tonight'
import { START, compose, parseIntent, reduce, type ExperienceSpec, type Intent, type Journey as State, type SceneId } from '../../lib/journey'
import { nightSound, type Mix } from '../../lib/nightSound'
import { askEngine, fetchBusiness, reserve, reserveArticle } from '../../lib/presence'
import { hush, speak, useVoice } from '../../lib/useVoice'
import { searchPlaces, type Answer } from '../../data/search'

const BUILD_MS = 1900
// The building starts assembling while the map is still flying in, so one becomes the other
const BUILD_DELAY_MS = 1500
const TEARDOWN_MS = 500
// Discovery often replaces its first line straight away: don't start saying one that's about to go
const SPEAK_DELAY_MS = 500
// The camera and the light can get ahead of you while you talk, because those are free to take back
const PREVIEWS: Intent['kind'][] = ['basel', 'party', 'venue', 'shop', 'casino', 'plan']

const IN_VENUE = (s: SceneId) => s === 'venue' || s === 'outfit'

/** Where the floor labels hang: the near-left corner of the building */
const FLOOR_ANCHORS = Object.fromEntries(vendor.floors.map((f) => [f.id, [-3.7, f.level * H + 1.1, 2.7] as [number, number, number]]))
const ROOF_LIGHTS: [number, number, number][] = [[-3, 11.2, 2], [3, 11.2, -2]]
const CASINO_LIGHTS: [number, number, number][] = [[-3.2, 3, 2], [3.2, 3, -2]]

/** The building rises while we're in the venue and takes itself apart when we leave */
function useBuildProgress(up: boolean) {
  const [progress, setProgress] = useState(0)
  const current = useRef(0)
  useEffect(() => {
    const from = current.current
    const to = up ? 1 : 0
    const duration = up ? BUILD_MS : TEARDOWN_MS
    let raf = 0
    let start = 0
    const tick = (now: number) => {
      start ||= now
      const k = Math.min((now - start) / duration, 1)
      current.current = from + (to - from) * k
      setProgress(current.current)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    const wait = setTimeout(() => (raf = requestAnimationFrame(tick)), up && from === 0 ? BUILD_DELAY_MS : 0)
    return () => {
      clearTimeout(wait)
      cancelAnimationFrame(raf)
    }
  }, [up])
  return progress
}

/** From across the street, down at eye level on the floor, or stepping back to take in a look */
function framingFor(j: State): Framing {
  const y = (floorById(j.floor)?.level ?? 0) * H
  const x = j.floor === 'main-hall' ? -1 : -1.25
  if (j.scene === 'casino') return { target: [0, 1.9, 0], distance: 31, polar: 1.26, azimuth: 0.5 }
  if (j.scene === 'shop') return { target: [0, 3.4, 0], distance: 31, polar: 1.28, azimuth: 0.4 }
  if (j.scene === 'outfit') return { target: [x, y + 1, -0.1], distance: 5.4, polar: 1.36, azimuth: 0.1 }
  if (j.scene === 'venue' && j.inside) return { target: [x, y + 1.05, -1.4], distance: 4, polar: 1.38, azimuth: 0.22 }
  return { target: [0, 5.2, 0], distance: 36, polar: 1.28 }
}

/** Muffled from the street, open on the floor, and quieter when you're talking about what to wear */
function mixFor(j: State, on: boolean): Mix {
  const rooftop = j.floor === 'rooftop'
  const base = { bpm: rooftop ? FLOOR_EXTRAS.rooftop.bpm : FLOOR_EXTRAS['main-hall'].bpm, house: rooftop }
  if (!on || !IN_VENUE(j.scene)) return { ...base, gain: 0, cutoff: 300 }
  if (!compose(j).openFloor) return { ...base, gain: 0.5, cutoff: 280 }
  if (j.floor === 'entrance') return { ...base, gain: 0.5, cutoff: 650 }
  return j.scene === 'venue' ? { ...base, gain: 0.8, cutoff: rooftop ? 7000 : 16000 } : { ...base, gain: 0.45, cutoff: 2200 }
}

function planStops(j: State): Place[] {
  const shop = shopById(j.shop)
  return [...(shop?.lngLat ? [pickupPlace(shop.name, shop.lngLat)] : []), HAFENLICHT_PLACE, ...(j.casino ? [CASINO_PLACE] : [])]
}

function planRoute(j: State): [number, number][] {
  const shop = shopById(j.shop)
  return [...(shop?.lngLat ? [shop.lngLat, ...ROUTE_TO_CLUB] : [HAFENLICHT_PLACE.lngLat]), ...(j.casino ? ROUTE_TO_CASINO.slice(1) : [])]
}

/** The thread of the night: the composer's context, and a way back to each decision */
function Trail({ context, act }: { context: ExperienceSpec['context']; act: (i: Intent) => void }) {
  return (
    <nav aria-label="Your wake: what's been decided so far" className="absolute top-5 left-6 z-10 flex max-w-[calc(100%-10rem)] flex-wrap items-center gap-y-1 text-sm font-medium text-ink [text-shadow:0_1px_8px_rgb(3_12_11/0.95)]">
      <span className="mr-3 flex items-center gap-1.5 font-display text-lg tracking-tight"><DuckMark size={18} /> duck.</span>
      {context.map((s, i) => (
        <span key={s.label} className="flex items-center">
          <span aria-hidden className={`mx-2 size-1.5 rounded-full ${i === context.length - 1 ? 'bg-mint shadow-[0_0_10px_2px_rgb(86_230_179/0.8)]' : 'bg-mint/45'}`} />
          <button onClick={() => act(s.go)} className={`transition-colors hover:text-mint ${i === context.length - 1 ? '' : 'text-muted'}`}>{s.label}</button>
        </span>
      ))}
    </nav>
  )
}

/** The bounded set of things the composer can ask for, and the React that draws each */
const PRIMITIVES: Record<NonNullable<ExperienceSpec['primitive']>, typeof ShopTiles> = {
  'venue-hub': VenueTiles,
  'outfit-explorer': OutfitTiles,
  'store-articles': ShopTiles,
  'destination-door': CasinoTiles,
  itinerary: PlanTiles,
}

const MINT = '#56e6b3'
const roundBtn = 'spatial-glass grid size-11 place-items-center rounded-full text-ink transition-transform hover:scale-105'

/** One continuous world for the whole night out: intent in, place out, no pages in between. */
export default function Journey({ first }: { first: string }) {
  const firstIntent = useRef<Intent>(((i) => (i && i.kind !== 'book' ? i : { kind: 'basel' as const }))(parseIntent(first))).current
  const [j, setJ] = useState<State>(() => ({ ...START, ...reduce(START, firstIntent).patch }))
  // Only the latest exchange is on screen: the world is the answer, not a transcript
  const [line, setLine] = useState(() => ({ said: first, reply: reduce(START, firstIntent).reply }))
  const [settled, setSettled] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const [sound, setSound] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  // What the sentence so far seems to want, before it's been said
  const [preview, setPreview] = useState<Intent | null>(null)
  const floorLabels = useRef<Record<string, HTMLElement | null>>({})

  const [, setPublishedAt] = useState('')
  const [answers, setAnswers] = useState<Partial<Record<'basel' | 'party', Answer | 'demo'>>>({})
  const [trace, setTrace] = useState<string | null>(null)

  const state = useRef(j)
  state.current = j

  const refresh = useCallback(() => {
    fetchBusiness()
      .then((b) => {
        applyPublished(b)
        setPublishedAt(b.publishedAt + b.ticketsLeft)
      })
      .catch(console.error)
  }, [])

  const ask = useCallback((scene: 'basel' | 'party', query: string) => {
    searchPlaces(query)
      .then((answer) => {
        const top = answer.ranked?.[0]
        setTrace(answer.mode === 'live' ? `Live agent called ${answer.calls.join(', ')}` : `No model connected. Ranked by the engine${top ? `: ${top.name} (${top.reasons.join(', ')})` : ''}`)
        setAnswers((a) => ({ ...a, [scene]: answer }))
        if (state.current.scene === scene && answer.intro) setLine((l) => ({ said: l.said, reply: answer.intro }))
      })
      .catch((e) => {
        console.error(e)
        setTrace('Search unavailable, showing demo picks')
        setAnswers((a) => ({ ...a, [scene]: 'demo' }))
      })
  }, [])

  // Every way in lands here: typing, the mic, tiles, the trail, and clicks on the 3D building itself
  const act = useCallback((intent: Intent, said = '') => {
    nightSound.start()
    const { patch, reply } = reduce(state.current, intent)
    const next = { ...state.current, ...patch }
    state.current = next
    setJ(next)
    setLine({ said, reply })
    // Discovery goes to the real agent
    if (intent.kind === 'party' || intent.kind === 'basel') ask(intent.kind, said || (intent.kind === 'party' ? 'Something to do tonight, it is Halloween' : first))
    // Entering the club reads the latest published record, so an owner's edit shows up
    if (intent.kind === 'venue') refresh()
    // So are a store's: it holds the article, or it says why not
    if (intent.kind === 'reserveArticle') {
      reserveArticle(next.shop!, next.outfit!, intent.id, PEOPLE)
        .then((r) => actRef.current({ kind: 'articleReserved', article: r.article, ref: r.ref }))
        .catch((e: Error) => setLine({ said: '', reply: `${shopById(next.shop)?.name} says no: ${e.message}.` }))
    }
    // Reservations are confirmed by the club's system, never assumed
    if (intent.kind === 'reserve' || intent.kind === 'book') {
      const booked = intent.kind === 'book'
      reserve(PEOPLE)
        .then((r) => {
          refresh()
          actRef.current({ kind: 'reserved', ref: r.ref, total: r.total, booked })
        })
        .catch((e: Error) => actRef.current({ kind: 'soldOut', message: e.message }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const actRef = useRef(act)
  actRef.current = act

  const spec = compose(j)

  const onSend = (text: string) => {
    const intent = parseIntent(text)
    if (intent) return act(intent, text)
    // The rules didn't place it: the server may have a model to ask. The world waits, it doesn't break.
    const next = spec.next[0]
    const unplaced = () => setLine({ said: text, reply: `I can't place that yet.${next ? ` Try: “${next}”` : ''}` })
    setLine({ said: text, reply: 'Let me think…' })
    askEngine(text, state.current)
      .then((r) => (r.intent ? act(r.intent, text) : unplaced()))
      .catch(unplaced)
  }

  const voice = useVoice({
    scriptedLine: spec.next[0],
    onBegin: () => {
      hush()
      setSpeaking(false)
    },
    onInterim: (text) => {
      const intent = parseIntent(text)
      if (intent && PREVIEWS.includes(intent.kind)) setPreview(intent)
    },
    onEnd: () => setPreview(null),
    // A microphone mishears, and a sentence can mention paying without meaning it: booking takes a press
    onFinal: (text) => (parseIntent(text)?.kind === 'book' ? setLine({ said: text, reply: "Nothing gets booked on my say-so. Press it yourself when you're ready." }) : onSend(text)),
  })

  useEffect(() => {
    nightSound.start()
    refresh()
    if (firstIntent.kind === 'party' || firstIntent.kind === 'basel') ask(firstIntent.kind, first)
    return () => {
      nightSound.stop()
      hush()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The music steps aside for whoever is talking
  useEffect(() => {
    const mix = mixFor(j, sound)
    nightSound.set(voice.listening ? { ...mix, gain: mix.gain * 0.12 } : speaking ? { ...mix, gain: mix.gain * 0.3 } : mix)
  }, [j, sound, voice.listening, speaking])

  useEffect(() => {
    if (!sound || voice.listening || line.reply.endsWith('…')) {
      hush()
      setSpeaking(false)
      return
    }
    const t = setTimeout(() => {
      setSpeaking(true)
      speak(line.reply, () => setSpeaking(false))
    }, SPEAK_DELAY_MS)
    return () => clearTimeout(t)
  }, [line, sound]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !voice.listening) act({ kind: 'back' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act, voice.listening])

  const store = shopById(spec.storeId)
  // Composed, not acted on: nothing is decided until the sentence ends
  const ahead = preview ? compose({ ...j, ...reduce(j, preview).patch }) : spec
  const headedTo = shopById(ahead.storeId)
  const storeCamera = useMemo(() => (headedTo ? { ...CAMERAS.store, center: headedTo.lngLat } : CAMERAS.store), [headedTo])
  const camera = ahead.camera === 'store' ? storeCamera : CAMERAS[ahead.camera]
  const venue = IN_VENUE(j.scene)
  const open = spec.openFloor

  // Tiles wait for the flight to finish, so the world always arrives first
  useEffect(() => {
    setSettled(false)
    const t = setTimeout(() => setSettled(true), camera.duration)
    return () => clearTimeout(t)
  }, [camera])

  const progress = useBuildProgress(venue)
  const places = useMemo(
    () => {
      if (spec.places === 'itinerary') return planStops(j)
      if (spec.places === 'stores') return SHOPS.map((s) => storePlace(s, (outfitById(j.outfit)?.price ?? 0) + s.extra))
      if (spec.places !== 'discovery') return []
      const answer = answers[j.scene as 'basel' | 'party']
      if (!answer) return []
      const seeded = [...BASEL_DAY_PLACES, ...BASEL_PLACES]
      if (answer === 'demo') return j.scene === 'basel' ? BASEL_DAY_PLACES : BASEL_PLACES
      if (answer.mode === 'live') return answer.places
      // No model: the engine ranked them, and its order decides what's shown
      return (answer.ranked ?? []).flatMap((r) => seeded.filter((p) => p.id === r.id))
    },
    [spec.places, j.scene, j.shop, j.outfit, j.casino, answers], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const route = useMemo(
    () => (spec.route === 'to-casino' ? ROUTE_TO_CASINO : spec.route === 'itinerary' ? planRoute(j) : null),
    [spec.route, j.shop, j.casino], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const onOpen = useCallback((id: string) => act({ kind: 'floor', id: id as FloorId }), [act])
  const noRooms = useCallback(() => {}, [])
  const onSelect = useCallback(
    (place: Place) =>
      act(
        place.id === HAFENLICHT_PLACE.id
          ? { kind: 'venue' }
          : place.id === CASINO_PLACE.id
            ? { kind: 'casino' }
            : place.id === 'pickup'
              ? { kind: 'pickShop', id: state.current.shop! }
              : SHOPS.some((s) => s.id === place.id)
                ? { kind: 'pickShop', id: place.id }
                : { kind: 'peek', name: place.name },
      ),
    [act],
  )

  const light: Light = j.scene === 'casino' ? 'orange' : j.floor ? FLOOR_EXTRAS[j.floor].light : 'pink'
  const interactive = settled && ((venue && !open) || j.scene === 'casino')
  const onRoof = open === 'rooftop'
  const chips = spec.next
  const Tiles = spec.primitive && PRIMITIVES[spec.primitive]
  const hasTiles = !!Tiles && spec.view !== 'itinerary'
  // How far the city steps back: on the roof it's the view, indoors it's gone
  const mapMood = open && !onRoof ? 'brightness-[0.2] blur-[10px]' : onRoof ? 'brightness-90 blur-[1.5px]' : ''

  return (
    <main className="immersive fixed inset-0 z-30 overflow-hidden bg-bg font-sans">
      <div className={`absolute inset-0 transition-[filter] duration-1000 ${mapMood}`}>
        <GlobeView
          camera={onRoof && !preview ? CAMERAS.rooftop : camera}
          lightPreset={ahead.daylight ? 'day' : 'night'}
          places={places}
          highlight={spec.view === 'city-night' ? HAFENLICHT_PLACE.id : spec.view === 'store-selector' ? SHOPS[0].id : undefined}
          route={route}
          safeRight={spec.view === 'itinerary' ? TILES_WIDTH + 24 : undefined}
          onSelect={onSelect}
        />
      </div>

      {/* Transparent over the map, so the 3D venue stands in the real street. Only takes the pointer when there's something to touch. */}
      <div className={`absolute inset-0 ${interactive ? '' : 'pointer-events-none'}`}>
        <Scene
          progress={progress}
          interactive={interactive}
          floors={vendor.floors}
          open={open}
          room={null}
          hover={hover}
          name={CLUB.name}
          party
          light={light}
          onHover={setHover}
          onOpen={onOpen}
          onRoom={noRooms}
          framing={framingFor(j)}
          scanGlobe={false}
        >
          {/* Mint from outside, the club's own light once you're in */}
          <ClubNight built={venue && progress > 0.85} open={open} color={open ? LIGHTS[light] : MINT} keepClear={j.scene !== 'venue'} />
          <GroundGlow show={venue && progress > 0.5 && !open} color={MINT} radius={13} />
          <GroundGlow show={j.scene === 'casino' && settled} color="#ffb040" radius={15} y={0.02} />
          <Searchlights show={venue && !open && progress > 0.85} color={MINT} spots={ROOF_LIGHTS} />
          <Searchlights show={j.scene === 'casino' && progress < 0.3} color="#ffc060" spots={CASINO_LIGHTS} />
          <GroundGlow show={!!store && settled} color="#ffc680" radius={13} y={0.02} />
          <Storefront name={store?.name ?? ''} show={!!store && settled} />
          <CrewFigures
            show={(j.scene === 'outfit' || j.scene === 'casino') && settled}
            floor={j.floor}
            atCasino={j.scene === 'casino'}
            outfit={j.outfit}
            color={j.color}
            turntable={j.scene === 'outfit'}
          />
          <Casino show={j.scene === 'casino' && progress < 0.3} />
          <Anchors points={FLOOR_ANCHORS} elements={floorLabels} show={settled && j.scene === 'venue' && !j.inside} />
          <Lens fov={j.scene === 'venue' && j.inside ? 62 : open ? 42 : 35} look={open ? 0.2 : 0.03} shift={hasTiles ? TILES_WIDTH / 2 : 0} />
        </Scene>
      </div>

      {/* Floors are chosen where they are: labels hanging off the building itself */}
      {vendor.floors.map((f) => (
        <button
          key={f.id}
          ref={(el) => {
            floorLabels.current[f.id] = el
          }}
          onClick={() => onOpen(f.id)}
          style={{ opacity: 0 }}
          className="spatial-glass absolute top-0 left-0 z-10 flex items-center gap-3 rounded-full py-2.5 pr-3 pl-5 text-left text-ink transition-[opacity,scale] duration-500 hover:scale-105"
        >
          <span>
            <span className="block font-display text-lg leading-tight whitespace-nowrap">{f.name}</span>
            <span className="block text-[13px] whitespace-nowrap text-muted">{f.music}</span>
          </span>
          <span className="size-3 rounded-full bg-mint shadow-[0_0_14px_3px_rgb(86_230_179/0.8)]" />
        </button>
      ))}

      <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_180px_60px_rgb(5_20_18/0.72)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#091b1a]/75 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-96 bg-gradient-to-t from-[#091b1a]/95 via-[#091b1a]/55 to-transparent" />
      <VoiceAura on={voice.listening} level={voice.level} />

      <Trail context={spec.context} act={act} />

      <div className="absolute top-3.5 right-4 z-20 flex gap-2">
        <button onClick={() => setSound((s) => !s)} aria-label={sound ? 'Mute' : 'Unmute'} className={roundBtn}>
          {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
        <Link to="/" aria-label="Leave" className={roundBtn}>
          <X size={19} />
        </Link>
      </div>

      {Tiles && settled && (
        <aside
          key={j.scene}
          className="absolute top-20 right-5 bottom-5 z-10 flex flex-col justify-center gap-3 overflow-y-auto [scrollbar-width:none] [transform:perspective(1600px)_rotateY(-5deg)] [transform-origin:right_center]"
          style={{ width: TILES_WIDTH - 24 }}
        >
          <Tiles j={j} act={act} />
        </aside>
      )}

      <div className="absolute bottom-5 left-6 z-10 mx-auto flex max-w-3xl flex-col items-center text-center font-sans" style={{ right: Tiles ? TILES_WIDTH + 16 : 24 }}>
        <span key={`ripple-${line.reply}`} aria-hidden className="intent-ripple" />
        {trace && spec.places === 'discovery' && (
          <p className="mb-2 text-xs text-muted [text-shadow:0_1px_6px_rgb(3_12_11/0.95)]">{trace}</p>
        )}
        {j.booked && (
          <div className="mb-2">
            <Duck state="surface" size={64} />
          </div>
        )}
        {voice.listening ? (
          <p aria-live="polite" className="mb-6 min-h-[1.2em] font-display text-[32px] leading-[1.2] font-medium tracking-tight text-ink/80 [text-shadow:0_2px_16px_rgb(3_12_11/0.95)]">
            {voice.interim}
          </p>
        ) : (
          <div key={line.reply} className="mb-3 text-ink [text-shadow:0_2px_12px_rgb(3_12_11/0.95)]">
            {line.said && <p className="animate-card-in mb-1.5 text-[15px] opacity-70">“{line.said}”</p>}
            <p aria-live="polite" className="font-display text-[27px] leading-[1.2] font-medium tracking-tight">
              <Spoken text={line.reply} />
            </p>
          </div>
        )}
        <div className={`mb-4 flex flex-wrap justify-center gap-x-5 gap-y-1 transition-opacity duration-300 ${voice.listening ? 'opacity-0' : ''}`}>
          {chips.map((c) => (
            <button key={c} onClick={() => onSend(c)} disabled={voice.listening} className="text-sm text-muted underline-offset-4 transition-colors [text-shadow:0_1px_6px_rgb(3_12_11/0.95)] hover:text-mint hover:underline">
              “{c}”
            </button>
          ))}
        </div>
        <VoiceOrb
          state={voice.listening ? 'listening' : line.reply.endsWith('…') ? 'thinking' : speaking ? 'speaking' : 'idle'}
          level={voice.level}
          size={64}
          label={voice.listening ? 'Stop listening' : 'Talk to Duck'}
          onPress={voice.press}
          onRelease={voice.release}
        >
          <DuckMark size={24} thinking={line.reply.endsWith('…')} />
        </VoiceOrb>
        <VoiceHint listening={voice.listening} missed={voice.missed} scripted={voice.scripted} />
      </div>
    </main>
  )
}
