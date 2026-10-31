import { useCallback, useEffect, useState } from 'react'
import { Volume2, VolumeX, X } from 'lucide-react'
import ClaudeLogo from '../ClaudeLogo'
import Scene, { H, LIGHTS, type Framing } from '../acme/Venue'
import { ClubNight, Lens } from './Club'
import { CrewFigures } from './Crew'
import FloorTiles, { OutfitTiles, TILES_WIDTH, type OutfitChoice, type TileId } from './FloorTiles'
import { vendor } from '../../data/vendor'
import { FLOORS, FLOOR_EXTRAS, HAFENLICHT, type FloorId } from '../../data/floors'
import { COLORS, outfitById, type OutfitId } from '../../data/costumes'
import { nightSound, type Mix } from '../../lib/nightSound'

/** Looking at the floor, or trying on costumes with the crew */
type Mode = 'floor' | 'outfit'

/** Down at eye level on the floor, or stepping back to take in a look (story: Journey.tsx framingFor) */
function framingFor(floor: FloorId, mode: Mode): Framing {
  const y = vendor.floors.find((f) => f.id === floor)!.level * H
  const x = floor === 'main-hall' ? -1 : -1.25
  if (mode === 'outfit') return { target: [x, y + 1, -0.1], distance: 5.4, polar: 1.36, azimuth: 0.1 }
  return { target: [x, y + 1.05, -1.4], distance: 4, polar: 1.38, azimuth: 0.22 }
}

/** Open on the floor, and quieter while you're talking about what to wear */
function mixFor(floor: FloorId, mode: Mode, on: boolean): Mix {
  const rooftop = floor === 'rooftop'
  const base = { bpm: FLOOR_EXTRAS[floor].bpm, house: rooftop }
  if (!on) return { ...base, gain: 0, cutoff: 300 }
  if (mode === 'outfit') return { ...base, gain: 0.45, cutoff: 2200 }
  return { ...base, gain: 0.8, cutoff: rooftop ? 7000 : 16000 }
}

const noop = () => {}
const roundBtn = 'spatial-glass grid size-11 place-items-center rounded-full text-ink transition-transform hover:scale-105'
const NO_CHOICE: OutfitChoice = { outfit: null, color: 'crimson', budget: null, vibe: null }

/**
 * Standing on one of Hafenlicht's floors: the 3D floor over the (blurred) map, the floor's tiles on the right.
 * The map dive and its blur live in GlobeView; this is everything on top of it.
 */
export default function ImmersiveFloor({ floor, onFloor, onClose, onWhereToGet }: {
  floor: FloorId
  onFloor: (id: FloorId) => void
  onClose: () => void
  /** Off to the shop that has the picked look (GlobeView flies the map there) */
  onWhereToGet?: (choice: OutfitChoice) => void
}) {
  const name = FLOORS.find((f) => f.id === floor)!.name
  const other = FLOORS.find((f) => f.id !== floor)!
  const [sound, setSound] = useState(true)
  const [tile, setTile] = useState<TileId | null>(null)
  const [reply, setReply] = useState('')
  const [mode, setMode] = useState<Mode>('floor')
  // The look is remembered across floors, like the rest of the night
  const [choice, setChoice] = useState<OutfitChoice>(NO_CHOICE)
  const extra = FLOOR_EXTRAS[floor]
  const outfit = outfitById(choice.outfit)

  // A new floor starts with its own line and the tiles folded
  useEffect(() => {
    setReply(`You're on the ${name}. ${extra.note}.`)
    setTile(null)
    setMode('floor')
  }, [floor]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    nightSound.start()
    return () => nightSound.stop()
  }, [])
  useEffect(() => nightSound.set(mixFor(floor, mode, sound)), [floor, mode, sound])

  const backToFloor = useCallback(() => {
    setMode('floor')
    setReply(`Back on the ${name}.`)
  }, [name])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (mode === 'outfit') backToFloor()
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, backToFloor, onClose])

  const onOpen = useCallback((id: string) => id in FLOOR_EXTRAS && onFloor(id as FloorId), [onFloor])
  const toggle = (id: TileId) => setTile((t) => (t === id ? null : id))

  const costumes = () => {
    setMode('outfit')
    setReply(`So we need costumes. Same night, same crew: here's how each look works on the ${name}.`)
  }
  const pick = (id: OutfitId) => {
    const o = outfitById(id)!
    setMode('outfit')
    setChoice((c) => ({ ...c, outfit: id }))
    setReply(`${o.name}. ${o.onFloor[floor]}.`)
  }
  const outfitHandlers = {
    onBudget: (max: number | null) => {
      setChoice((c) => ({ ...c, budget: max }))
      setReply(max ? `Under CHF ${max} each. Same night, fewer options.` : 'Any budget, then.')
    },
    onVibe: (vibe: OutfitChoice['vibe']) => {
      setChoice((c) => ({ ...c, vibe }))
      setReply(vibe ? `${vibe} it is.` : 'Any vibe, then.')
    },
    onPick: pick,
    onColor: (id: OutfitChoice['color']) => {
      setChoice((c) => ({ ...c, color: id }))
      setReply(`${COLORS.find((c) => c.id === id)!.name}, under the lights you'll actually be in.`)
    },
    onWhereToGet: () => onWhereToGet?.(choice),
  }

  const chips: { label: string; run: () => void }[] =
    mode === 'outfit'
      ? choice.outfit
        ? [
            { label: 'Where can we get it tonight?', run: () => onWhereToGet?.(choice) },
            choice.outfit === 'witch' ? { label: 'Let’s go vampire', run: () => pick('vampire') } : { label: 'Witch couture', run: () => pick('witch') },
          ]
        : [
            { label: 'Witch couture', run: () => pick('witch') },
            { label: 'Let’s go vampire', run: () => pick('vampire') },
          ]
      : tile === 'dress'
        ? [
            { label: 'We need costumes!', run: costumes },
            {
              label: 'What’s the music?',
              run: () => {
                setTile('music')
                setReply(`${extra.dj} on the ${name} tonight.`)
              },
            },
          ]
        : [
            {
              label: 'What’s the dress code?',
              run: () => {
                setTile('dress')
                setReply(`The owner says: ${HAFENLICHT.dress}. Tonight is masked.`)
              },
            },
            {
              label: 'What’s the music?',
              run: () => {
                setTile('music')
                setReply(`${extra.dj} on the ${name} tonight.`)
              },
            },
            { label: `Take me to the ${other.name}`, run: () => onFloor(other.id) },
          ]

  return (
    <div className="immersive fixed inset-0 z-40 animate-[fade-in_700ms_ease-out_500ms_both] overflow-hidden font-system">
      {/* Transparent over the map: on the roof the city is the view, indoors the walls close it off */}
      <div className="pointer-events-none absolute inset-0">
        <Scene
          progress={1}
          interactive={false}
          floors={vendor.floors}
          open={floor}
          room={null}
          hover={null}
          name={HAFENLICHT.name}
          party
          light={extra.light}
          onHover={noop}
          onOpen={onOpen}
          onRoom={noop}
          framing={framingFor(floor, mode)}
          scanGlobe={false}
        >
          {/* The crowd makes room in the middle of the floor when the crew steps out to try a look */}
          <ClubNight built open={floor} color={LIGHTS[extra.light]} keepClear={mode === 'outfit'} />
          <CrewFigures show={mode === 'outfit'} floor={floor} outfit={choice.outfit} color={choice.color} />
          <Lens fov={mode === 'outfit' ? 42 : 62} look={0.2} shift={TILES_WIDTH / 2} />
        </Scene>
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_180px_60px_rgb(0_0_0/0.55)]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/50 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

      <nav aria-label="Where you are" className="absolute top-5 left-6 z-10 flex items-center text-sm font-medium text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.9)]">
        {['Basel', 'Halloween'].map((s) => (
          <span key={s} className="flex items-center">
            <button onClick={onClose} className="opacity-85 hover:opacity-100">{s}</button>
            <span className="mx-2 opacity-50">›</span>
          </span>
        ))}
        <button onClick={onClose} className="opacity-85 hover:opacity-100">{HAFENLICHT.name}</button>
        <span className="mx-2 opacity-50">›</span>
        {mode === 'outfit' ? (
          <button onClick={backToFloor} className="opacity-85 hover:opacity-100">{name}</button>
        ) : (
          <span>{name}</span>
        )}
        {mode === 'outfit' && outfit && (
          <>
            <span className="mx-2 opacity-50">›</span>
            <span>{outfit.name}</span>
          </>
        )}
      </nav>

      <div className="absolute top-3.5 right-4 z-20 flex gap-2">
        <button onClick={() => setSound((s) => !s)} aria-label={sound ? 'Mute' : 'Unmute'} className={roundBtn}>
          {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
        <button onClick={onClose} aria-label="Leave" className={roundBtn}>
          <X size={19} />
        </button>
      </div>

      <aside
        key={mode}
        className="absolute top-20 right-5 bottom-5 z-10 flex flex-col justify-center gap-3 overflow-y-auto [scrollbar-width:none] [transform:perspective(1600px)_rotateY(-5deg)] [transform-origin:right_center]"
        style={{ width: TILES_WIDTH - 24 }}
      >
        {mode === 'outfit' ? (
          <OutfitTiles floor={floor} choice={choice} {...outfitHandlers} />
        ) : (
          <FloorTiles floor={floor} open={tile} onToggle={toggle} onFloor={onFloor} onCostumes={costumes} />
        )}
      </aside>

      <div className="absolute bottom-8 left-6 z-10 max-w-2xl font-sans" style={{ right: TILES_WIDTH + 16 }}>
        <p key={reply} className="animate-card-in mb-4 flex gap-3 font-serif text-[26px] leading-[1.2] text-white [text-shadow:0_2px_12px_rgb(0_0_0/0.95)]">
          <span className="mt-1 shrink-0"><ClaudeLogo size={24} /></span>
          {reply}
        </p>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button key={c.label} onClick={c.run} className="spatial-glass rounded-full px-4 py-2 text-sm font-medium transition-colors hover:text-clay">
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
