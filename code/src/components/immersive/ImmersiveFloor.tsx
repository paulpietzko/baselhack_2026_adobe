import { useCallback, useEffect, useState } from 'react'
import { Volume2, VolumeX, X } from 'lucide-react'
import ClaudeLogo from '../ClaudeLogo'
import Scene, { H, LIGHTS, type Framing } from '../acme/Venue'
import { ClubNight, Lens } from './Club'
import FloorTiles, { TILES_WIDTH, type TileId } from './FloorTiles'
import { vendor } from '../../data/vendor'
import { FLOORS, FLOOR_EXTRAS, HAFENLICHT, type FloorId } from '../../data/floors'
import { nightSound, type Mix } from '../../lib/nightSound'

/** Down at eye level on the floor, a little off-centre (story: Journey.tsx framingFor) */
function framingFor(floor: FloorId): Framing {
  const level = vendor.floors.find((f) => f.id === floor)!.level
  const x = floor === 'main-hall' ? -1 : -1.25
  return { target: [x, level * H + 1.05, -1.4], distance: 4, polar: 1.38, azimuth: 0.22 }
}

/** Open on the floor: techno with the full spectrum inside, house a bit softer up on the roof */
function mixFor(floor: FloorId, on: boolean): Mix {
  const rooftop = floor === 'rooftop'
  return { bpm: FLOOR_EXTRAS[floor].bpm, house: rooftop, gain: on ? 0.8 : 0, cutoff: rooftop ? 7000 : 16000 }
}

const noop = () => {}
const roundBtn = 'spatial-glass grid size-11 place-items-center rounded-full text-ink transition-transform hover:scale-105'

/**
 * Standing on one of Hafenlicht's floors: the 3D floor over the (blurred) map, the floor's tiles on the right.
 * The map dive and its blur live in GlobeView; this is everything on top of it.
 */
export default function ImmersiveFloor({ floor, onFloor, onClose }: { floor: FloorId; onFloor: (id: FloorId) => void; onClose: () => void }) {
  const name = FLOORS.find((f) => f.id === floor)!.name
  const other = FLOORS.find((f) => f.id !== floor)!
  const [sound, setSound] = useState(true)
  const [tile, setTile] = useState<TileId | null>(null)
  const [reply, setReply] = useState('')
  const extra = FLOOR_EXTRAS[floor]

  // A new floor starts with its own line and the tiles folded
  useEffect(() => {
    setReply(`You're on the ${name}. ${extra.note}.`)
    setTile(null)
  }, [floor]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    nightSound.start()
    return () => nightSound.stop()
  }, [])
  useEffect(() => nightSound.set(mixFor(floor, sound)), [floor, sound])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onOpen = useCallback((id: string) => id in FLOOR_EXTRAS && onFloor(id as FloorId), [onFloor])
  const toggle = (id: TileId) => setTile((t) => (t === id ? null : id))

  const chips: { label: string; run: () => void }[] = [
    {
      label: 'What’s the dress code?',
      run: () => {
        setTile('dress')
        setReply(`${HAFENLICHT.dress}. Tonight is masked.`)
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
          framing={framingFor(floor)}
          scanGlobe={false}
        >
          <ClubNight built open={floor} color={LIGHTS[extra.light]} keepClear={false} />
          <Lens fov={62} look={0.2} shift={TILES_WIDTH / 2} />
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
        <span>{name}</span>
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
        className="absolute top-20 right-5 bottom-5 z-10 flex flex-col justify-center gap-3 overflow-y-auto [scrollbar-width:none] [transform:perspective(1600px)_rotateY(-5deg)] [transform-origin:right_center]"
        style={{ width: TILES_WIDTH - 24 }}
      >
        <FloorTiles floor={floor} open={tile} onToggle={toggle} onFloor={onFloor} />
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
