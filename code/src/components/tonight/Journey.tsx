import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ChatInput from '../ChatInput'
import GlobeView from '../GlobeView'
import Scene, { H, type Framing, type Light } from '../acme/Venue'
import { CrewStack, Thread, type Message } from './Crew'
import { CasinoTiles, OutfitTiles, PlanTiles, ShopTiles, VenueTiles } from './Tiles'
import { Casino, CrewFigures, Embers } from './World'
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
  type Camera,
  type Place,
} from '../../data/basel'
import { CASINO, CLUB, COLORS, CREW, FLOOR_EXTRAS, floorById, outfitById, shopById, type FloorId } from '../../data/tonight'
import { START, parseIntent, reactions, reduce, suggestions, type Intent, type Journey as State, type SceneId } from '../../lib/journey'

const BUILD_MS = 1700
// The building starts assembling while the map is still flying in, so one becomes the other
const BUILD_DELAY_MS = 1300
const TEARDOWN_MS = 500
const SPIN_MS = 2600

const CAMERA_FOR: Record<SceneId, Camera> = {
  basel: CAMERAS.day,
  party: CAMERAS.party,
  venue: CAMERAS.venue,
  outfit: CAMERAS.venue,
  shop: CAMERAS.venue,
  casino: CAMERAS.casino,
  plan: CAMERAS.plan,
}

const IN_VENUE = (s: SceneId) => s === 'venue' || s === 'outfit' || s === 'shop'
const CAN_OPEN = (s: State) => (s.scene === 'venue' && s.inside) || s.scene === 'outfit' || s.scene === 'shop'

const CREW_NAMES = CREW.filter((c) => c.id !== 'you').map((c) => c.name)

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

function framingFor(j: State): Framing | undefined {
  if (j.scene === 'casino') return { target: [0, 2.6, 0], distance: 29, polar: 1.2, azimuth: 0.5 }
  if (j.scene === 'outfit' || j.scene === 'shop') {
    const floor = floorById(j.floor)
    const main = j.floor === 'main-hall'
    return { target: [main ? -1 : -0.9, (floor?.level ?? 0) * H + 0.7, 0.6], distance: 8, polar: 1.3, azimuth: main ? 0.35 : -0.3 }
  }
  // Inside a floor the building's own camera takes over; this one frames it above the input
  return j.scene === 'venue' && j.inside ? undefined : { target: [0, 5, 0], distance: 34, polar: 1.12 }
}

function planStops(j: State): Place[] {
  const shop = shopById(j.shop)
  return [
    ...(shop?.lngLat ? [pickupPlace(shop.name, shop.lngLat)] : []),
    HAFENLICHT_PLACE,
    ...(j.casino ? [CASINO_PLACE] : []),
  ]
}

function planRoute(j: State): [number, number][] {
  const shop = shopById(j.shop)
  return [
    ...(shop?.lngLat ? [shop.lngLat, ...ROUTE_TO_CLUB] : [HAFENLICHT_PLACE.lngLat]),
    ...(j.casino ? ROUTE_TO_CASINO.slice(1) : []),
  ]
}

/** What the crew has settled so far. Each pill jumps back to where it was decided. */
function Trail({ j, act }: { j: State; act: (i: Intent) => void }) {
  const floor = floorById(j.floor)
  const outfit = outfitById(j.outfit)
  const shop = shopById(j.shop)
  const past = j.scene !== 'basel'
  const pills: { label: string; go: Intent; on: boolean; swatch?: string }[] = [
    { label: 'Basel', go: { kind: 'basel' }, on: true },
    { label: 'Halloween', go: { kind: 'party' }, on: past },
    { label: CLUB.name, go: { kind: 'venue' }, on: j.scene !== 'party' && past },
    { label: floor?.name ?? '', go: floor ? { kind: 'floor', id: floor.id as FloorId } : { kind: 'venue' }, on: !!floor },
    { label: outfit?.name ?? '', go: { kind: 'outfit' }, on: !!outfit, swatch: COLORS.find((c) => c.id === j.color)!.hex },
    { label: shop?.name ?? '', go: { kind: 'shop' }, on: !!shop },
    { label: CASINO.name, go: { kind: 'casino' }, on: j.casino },
  ]
  return (
    <nav aria-label="Decided so far" className="absolute top-3 left-4 z-10 flex max-w-[calc(100%-12rem)] flex-wrap items-center gap-1 text-xs">
      <CrewStack size={24} />
      <span className="mr-1 ml-1 hidden font-medium xl:inline">You, {CREW_NAMES.join(', ')}</span>
      {pills.filter((p) => p.on).map((p) => (
        <button
          key={p.label}
          onClick={() => act(p.go)}
          className="spatial-glass animate-card-in flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium hover:text-clay"
        >
          {p.swatch && <span className="size-2 rounded-full" style={{ background: p.swatch }} />}
          {p.label}
        </button>
      ))}
    </nav>
  )
}

/** One continuous world for the whole night out: conversation in, place out, no pages in between. */
export default function Journey({ first }: { first: string }) {
  const firstIntent = useRef<Intent>(parseIntent(first) ?? { kind: 'basel' }).current
  const [j, setJ] = useState<State>(() => ({ ...START, ...reduce(START, firstIntent).patch }))
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: 0, from: 'you', text: first },
    { id: 1, from: 'claude', text: reduce(START, firstIntent).reply },
  ])
  const [settled, setSettled] = useState(false)
  const [hover, setHover] = useState<string | null>(null)

  const nextId = useRef(2)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const state = useRef(j)
  state.current = j

  const say = useCallback((from: Message['from'], text: string) => {
    setMessages((m) => [...m, { id: nextId.current++, from, text }])
  }, [])

  const scheduleCrew = useCallback(
    (intent: Intent, next: State) => {
      timers.current.forEach(clearTimeout)
      timers.current = reactions(intent, next).map(([ms, from, text]) => setTimeout(() => say(from, text), ms))
    },
    [say],
  )

  // Every way in lands here: typing, the mic, tiles, pills, and clicks on the 3D building itself
  const act = useCallback(
    (intent: Intent, typed?: string) => {
      const { patch, reply } = reduce(state.current, intent)
      const next = { ...state.current, ...patch }
      state.current = next
      setJ(next)
      if (typed) say('you', typed)
      say('claude', reply)
      scheduleCrew(intent, next)
      if (intent.kind === 'spin') {
        setTimeout(() => {
          const winner = CREW[Math.floor(Math.random() * CREW.length)]
          setJ((s) => ({ ...s, spinning: false, winner: winner.id }))
          say('claude', `The wheel says ${winner.name === 'You' ? 'you' : winner.name}. First round is on ${winner.name === 'You' ? 'you' : 'them'}.`)
        }, SPIN_MS)
      }
    },
    [say, scheduleCrew],
  )

  const onSend = (text: string) => {
    const intent = parseIntent(text)
    if (intent) return act(intent, text)
    say('you', text)
    say('claude', `I can't answer that in this mock, but I can keep planning from here: ${suggestions(j).slice(0, 2).join(', or ') || 'the night is booked'}.`)
  }

  useEffect(() => {
    window.dispatchEvent(new Event('sidebar:collapse'))
    scheduleCrew(firstIntent, state.current)
    return () => timers.current.forEach(clearTimeout)
  }, [firstIntent, scheduleCrew])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLTextAreaElement)) act({ kind: 'back' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act])

  const camera = CAMERA_FOR[j.scene]
  const venue = IN_VENUE(j.scene)

  // Tiles wait for the flight to finish, so the world always arrives first
  useEffect(() => {
    setSettled(false)
    const t = setTimeout(() => setSettled(true), camera.duration)
    return () => clearTimeout(t)
  }, [camera])

  const progress = useBuildProgress(venue)
  const places = useMemo(
    () => (j.scene === 'basel' ? BASEL_DAY_PLACES : j.scene === 'party' ? BASEL_PLACES : j.scene === 'plan' ? planStops(j) : []),
    [j.scene, j.shop, j.casino], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const route = useMemo(
    () => (j.scene === 'casino' ? ROUTE_TO_CASINO : j.scene === 'plan' ? planRoute(j) : null),
    [j.scene, j.shop, j.casino], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const onOpen = useCallback((id: string) => act({ kind: 'floor', id: id as FloorId }), [act])
  const onRoom = useCallback((index: number) => act({ kind: 'room', index }), [act])
  const onSelect = useCallback(
    (place: Place) =>
      act(
        place.id === HAFENLICHT_PLACE.id
          ? { kind: 'venue' }
          : place.id === CASINO_PLACE.id
            ? { kind: 'casino' }
            : place.id === 'pickup'
              ? { kind: 'shop' }
              : { kind: 'peek', name: place.name },
      ),
    [act],
  )

  const light: Light = j.scene === 'casino' ? 'orange' : j.outfit === 'skeleton' && !venue ? 'purple' : j.floor ? FLOOR_EXTRAS[j.floor].light : 'pink'
  const open = CAN_OPEN(j) ? j.floor : null
  const interactive = (venue || j.scene === 'casino') && settled
  const chips = suggestions(j)
  const Tiles = { venue: VenueTiles, outfit: OutfitTiles, shop: ShopTiles, casino: CasinoTiles, plan: PlanTiles }[j.scene as string]
  // How far the city steps back: it stays there, the world is one place
  const mapMood =
    j.scene === 'outfit' || j.scene === 'shop' || (j.scene === 'venue' && j.inside)
      ? 'brightness-[0.3] saturate-50 blur-[6px]'
      : venue || (j.scene === 'casino' && settled)
        ? 'brightness-[0.55] saturate-75 blur-[1.5px]'
        : ''

  return (
    <main className="fixed inset-y-0 right-0 left-72 z-10 overflow-hidden font-system sidebar-collapsed:left-14">
      <div className={`absolute inset-0 transition-[filter] duration-1000 ${mapMood}`}>
        <GlobeView camera={camera} places={places} highlight={j.scene === 'party' ? HAFENLICHT_PLACE.id : undefined} route={route} onSelect={onSelect} />
      </div>

      {/* The night falls over the city once the crew asks for it */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_60%_40%,rgb(255_120_40/0.16),rgb(110_40_190/0.28)_65%,rgb(10_5_30/0.6))] transition-opacity duration-1000 ${j.scene === 'basel' ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* Transparent over the map, so the 3D venue stands on the pin. Only takes the pointer when there's something to touch. */}
      <div className={`absolute inset-0 ${interactive ? '' : 'pointer-events-none'} ${j.scene === 'basel' ? 'opacity-0' : ''}`}>
        <Scene
          progress={progress}
          interactive={interactive}
          floors={vendor.floors}
          open={open}
          room={j.room}
          hover={hover}
          name={CLUB.name}
          party
          light={light}
          onHover={setHover}
          onOpen={onOpen}
          onRoom={onRoom}
          framing={framingFor(j)}
          scanGlobe={false}
        >
          <CrewFigures
            show={(venue || j.scene === 'casino') && settled}
            floor={j.floor}
            atCasino={j.scene === 'casino'}
            outfit={j.outfit}
            color={j.color}
            turntable={j.scene === 'outfit' || j.scene === 'shop'}
          />
          <Casino show={j.scene === 'casino' && progress < 0.3} spinning={j.spinning} />
          <Embers />
        </Scene>
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-bg/80 to-transparent" />

      <Trail j={j} act={act} />
      <Thread messages={messages} />

      {Tiles && settled && (
        <aside key={j.scene} className="absolute top-14 right-4 bottom-4 z-10 flex w-64 flex-col gap-2 overflow-y-auto font-system [scrollbar-width:none]">
          <Tiles j={j} act={act} />
        </aside>
      )}

      <div className="absolute right-72 bottom-4 left-80 z-10 mx-auto max-w-xl font-sans">
        {chips.length > 0 && (
          <div className="mb-2 flex flex-wrap justify-center gap-1.5">
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => onSend(c)}
                className="spatial-glass rounded-full px-3 py-1 text-xs font-medium hover:text-clay"
              >
                {c}
              </button>
            ))}
          </div>
        )}
        <ChatInput onSend={onSend} rows={1} placeholder="Say where the night goes next…" voiceLine={chips[0]} />
      </div>
    </main>
  )
}
