import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Volume2, VolumeX, X } from 'lucide-react'
import ChatInput from '../ChatInput'
import ClaudeLogo from '../ClaudeLogo'
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
import { searchPlaces, type Answer } from '../../data/search'

const BUILD_MS = 1900
// The building starts assembling while the map is still flying in, so one becomes the other
const BUILD_DELAY_MS = 1500
const TEARDOWN_MS = 500

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
    <nav aria-label="Decided so far" className="absolute top-5 left-6 z-10 flex max-w-[calc(100%-10rem)] flex-wrap items-center text-sm font-medium text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.9)]">
      {context.map((s, i) => (
        <span key={s.label} className="flex items-center">
          {i > 0 && <span className="mx-2 opacity-50">›</span>}
          <button onClick={() => act(s.go)} className="opacity-85 hover:opacity-100">{s.label}</button>
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

const roundBtn = 'spatial-glass grid size-11 place-items-center rounded-full text-ink transition-transform hover:scale-105'

/** One continuous world for the whole night out: intent in, place out, no pages in between. */
export default function Journey({ first }: { first: string }) {
  const firstIntent = useRef<Intent>(parseIntent(first) ?? { kind: 'basel' }).current
  const [j, setJ] = useState<State>(() => ({ ...START, ...reduce(START, firstIntent).patch }))
  // Only the latest exchange is on screen: the world is the answer, not a transcript
  const [line, setLine] = useState(() => ({ said: first, reply: reduce(START, firstIntent).reply }))
  const [settled, setSettled] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const [sound, setSound] = useState(true)
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

  useEffect(() => {
    nightSound.start()
    refresh()
    if (firstIntent.kind === 'party' || firstIntent.kind === 'basel') ask(firstIntent.kind, first)
    return () => nightSound.stop()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => nightSound.set(mixFor(j, sound)), [j, sound])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLTextAreaElement)) act({ kind: 'back' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act])

  const spec = compose(j)
  const store = shopById(spec.storeId)
  const storeCamera = useMemo(() => (store ? { ...CAMERAS.store, center: store.lngLat } : CAMERAS.store), [store])
  const camera = spec.camera === 'store' ? storeCamera : CAMERAS[spec.camera]
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
    <main className="immersive fixed inset-0 z-30 overflow-hidden bg-black font-system">
      <div className={`absolute inset-0 transition-[filter] duration-1000 ${mapMood}`}>
        <GlobeView
          camera={onRoof ? CAMERAS.rooftop : camera}
          lightPreset={spec.daylight ? 'day' : 'night'}
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
          <ClubNight built={venue && progress > 0.85} open={open} color={LIGHTS[light]} keepClear={j.scene !== 'venue'} />
          <GroundGlow show={venue && progress > 0.5 && !open} color={LIGHTS[light]} radius={13} />
          <GroundGlow show={j.scene === 'casino' && settled} color="#ffb040" radius={15} y={0.02} />
          <Searchlights show={venue && !open && progress > 0.85} color={LIGHTS[light]} spots={ROOF_LIGHTS} />
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
            <span className="block font-serif text-lg leading-tight whitespace-nowrap">{f.name}</span>
            <span className="block text-[13px] whitespace-nowrap text-muted">{f.music}</span>
          </span>
          <span className="size-3 rounded-full bg-clay shadow-[0_0_14px_3px_rgb(217_119_87/0.8)]" />
        </button>
      ))}

      <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_180px_60px_rgb(0_0_0/0.55)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

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

      <div className="absolute bottom-6 left-6 z-10 mx-auto max-w-2xl font-sans" style={{ right: Tiles ? TILES_WIDTH + 16 : 24 }}>
        {trace && spec.places === 'discovery' && (
          <p className="mb-2 text-xs text-white/70 [text-shadow:0_1px_6px_rgb(0_0_0/0.9)]">{trace}</p>
        )}
        <div key={line.reply} className="animate-card-in mb-4 text-white [text-shadow:0_2px_12px_rgb(0_0_0/0.95)]">
          {line.said && <p className="mb-1.5 text-[15px] opacity-70">“{line.said}”</p>}
          <p className="flex gap-3 font-serif text-[26px] leading-[1.2]">
            <span className="mt-1 shrink-0"><ClaudeLogo size={24} /></span>
            {line.reply}
          </p>
        </div>
        {chips.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button key={c} onClick={() => onSend(c)} className="spatial-glass rounded-full px-4 py-2 text-sm font-medium transition-colors hover:text-clay">
                {c}
              </button>
            ))}
          </div>
        )}
        <ChatInput onSend={onSend} rows={1} compact placeholder="Where next?" voiceLine={chips[0]} />
      </div>
    </main>
  )
}
