import { useEffect, useRef, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import { ArrowLeft, Check, Clock, Footprints, MapPin, PackageCheck, Shirt, ShoppingBag, Sparkles, TriangleAlert } from 'lucide-react'
import ClaudeLogo from './ClaudeLogo'
import type { ClubBuilding } from './ClubFloorLabels'
import { COLORS, outfitById } from '../data/costumes'
import { PIECES, SHOP, SHOP_LEVELS, SIZES, STOCK } from '../data/shop'
import { BASEL_PLACES, HAFENLICHT_CLUB } from '../data/basel'
import type { OutfitChoice } from './immersive/FloorTiles'

const CREW = 4
const card = 'spatial-glass pointer-events-auto animate-card-in rounded-[26px] p-2 text-ink'
const edges = 'top-4 bottom-4 sidebar-collapsed:top-16 sidebar-collapsed:bottom-6'
const label = 'flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted uppercase'

const EARTH_M = 40075016.686
const club = BASEL_PLACES.find((p) => p.id === HAFENLICHT_CLUB.id)!

/** Straight-line distance in meters (good enough for a walk across town) */
function meters([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const rad = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(a))
}
// Streets aren't straight: +25%, at 80 m a minute
const WALK_M = meters(SHOP.lngLat, club.lngLat) * 1.25
const WALK_MIN = Math.round(WALK_M / 80)

/**
 * A glowing tag floating on the roof of the mall, in the colour of the look.
 * Same trick as the club's floor labels: project the footprint's centre, lift it by the building's height.
 */
function Beacon({ map, building, color, text }: { map: mapboxgl.Map; building: ClubBuilding; color: string; text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const [lng, lat] = building.ring.reduce(([x, y], [a, b]) => [x + a / building.ring.length, y + b / building.ring.length], [0, 0])
    const place = () => {
      if (!ref.current) return
      const p = map.project([lng, lat])
      const pxPerMeter = (512 * 2 ** map.getZoom()) / (EARTH_M * Math.cos((lat * Math.PI) / 180))
      const lift = building.height * pxPerMeter * Math.sin((map.getPitch() * Math.PI) / 180)
      ref.current.style.transform = `translate(${p.x}px, ${p.y - lift - 18}px) translate(-50%, -100%)`
    }
    place()
    map.on('render', place)
    return () => {
      map.off('render', place)
    }
  }, [map, building])

  return (
    <div ref={ref} className="pointer-events-none absolute top-0 left-0 z-10 flex animate-fade-in flex-col items-center">
      <span className="spatial-glass flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-2 text-sm font-medium whitespace-nowrap text-ink">
        <span className="grid size-6 place-items-center rounded-full" style={{ background: color }}>
          <ShoppingBag size={13} className="text-white" />
        </span>
        {text}
      </span>
      {/* A thin light beam down to the roof */}
      <span className="h-5 w-px" style={{ background: `linear-gradient(${color}, transparent)` }} />
      <span className="relative flex size-3">
        <span className="absolute inset-0 animate-ping rounded-full" style={{ background: color }} />
        <span className="size-3 rounded-full ring-2 ring-white/70" style={{ background: color }} />
      </span>
    </div>
  )
}

/** Overlay once we've flown to the mall: where to get the look the crew picked, piece by piece */
export default function ShopDetails({ map, building, choice, onBack }: {
  map: mapboxgl.Map
  building: ClubBuilding | null
  choice: OutfitChoice
  onBack: () => void
}) {
  const outfit = outfitById(choice.outfit)!
  const color = COLORS.find((c) => c.id === choice.color)!
  const pieces = PIECES[outfit.id]
  const stock = STOCK[outfit.id][choice.color]
  const short = stock < CREW
  // Plan B: the colour with the most left on the rails
  const fallback = COLORS.filter((c) => c.id !== color.id).sort((a, b) => STOCK[outfit.id][b.id] - STOCK[outfit.id][a.id])[0]
  const [size, setSize] = useState<(typeof SIZES)[number]>('M')
  const [held, setHeld] = useState(false)
  const code = `FG-${(outfit.id.length * 997 + color.id.length * 131).toString().slice(-4)}`
  // Fewest escalator rides: start at the top, work down to the exit
  const route = [...SHOP_LEVELS].reverse().map((level) => ({ level, items: pieces.filter((p) => p.level === level) })).filter((l) => l.items.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onBack()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  return (
    <div className="pointer-events-none absolute inset-0 font-system">
      {building && <Beacon map={map} building={building} color={color.hex} text={`${outfit.name} · ${SHOP.popUp}`} />}

      {/* Top left: back to the club */}
      <button
        onClick={onBack}
        className="spatial-glass pointer-events-auto absolute top-3 left-3 flex animate-fade-in items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:text-clay sidebar-collapsed:top-10 sidebar-collapsed:left-6"
      >
        <ArrowLeft size={14} /> Back to {club.name}
      </button>

      {/* Bottom left: the mall */}
      <article className={`${card} absolute bottom-4 left-4 w-[300px] sidebar-collapsed:bottom-6 sidebar-collapsed:left-6`} style={{ animationDelay: '100ms' }}>
        <div
          className="relative h-28 overflow-hidden rounded-[20px]"
          style={{ background: `radial-gradient(120% 140% at 80% 0%, ${color.hex}cc, #17151c 70%)` }}
        >
          <ShoppingBag size={64} strokeWidth={1.2} className="absolute right-4 bottom-3 text-white/25" />
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-black">
            <Sparkles size={11} /> Has your look
          </span>
          <span className="absolute bottom-2 left-3 text-[11px] font-semibold text-white/80">{SHOP.kind}</span>
        </div>
        <div className="px-2 pt-3 pb-1.5">
          <p className={`${label} text-clay`}>
            <MapPin size={11} /> {SHOP.popUp}
          </p>
          <h3 className="mt-1 text-[17px] leading-tight font-semibold">{SHOP.name}</h3>
          <p className="mt-0.5 text-[11.5px] text-muted">{SHOP.address}</p>
          <dl className="mt-3 space-y-1.5 text-[11.5px]">
            {[
              { icon: Clock, k: 'Open', v: SHOP.open.replace(/^.*· /, '') },
              { icon: Footprints, k: `To ${club.name}`, v: `${WALK_MIN} min walk · ${(WALK_M / 1000).toFixed(1)} km` },
            ].map(({ icon: Icon, k, v }) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <dt className={label}>
                  <Icon size={12} /> {k}
                </dt>
                <dd className="font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 rounded-xl bg-clay/12 px-2.5 py-1.5 text-[11px] font-medium text-clay">
            Halloween late opening: change here, walk straight to the doors at 23:00.
          </p>
        </div>
      </article>

      {/* Right column: the look on top, the route through the store below */}
      <div className={`absolute ${edges} right-4 flex w-[300px] flex-col gap-3 overflow-y-auto [scrollbar-width:none] sidebar-collapsed:right-6`}>
        <article className={card} style={{ animationDelay: '300ms' }}>
          <div className="px-2 pt-2 pb-1.5">
            <p className={label}>
              <Shirt size={12} /> Your look
            </p>
            <div className="mt-1.5 flex items-center gap-3">
              <span className="size-10 shrink-0 rounded-2xl ring-1 ring-white/20" style={{ background: `linear-gradient(135deg, ${color.hex}, #0b0b0f)` }} />
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-xl leading-tight">{outfit.name}</h3>
                <p className="text-[11.5px] text-muted">
                  in {color.name} · {outfit.vibe}
                </p>
              </div>
              <span className="text-right text-[11px] text-muted">
                <span className="block text-base font-semibold text-ink tabular-nums">CHF {outfit.price}</span>
                each
              </span>
            </div>

            <ul className="mt-3 space-y-1.5 border-t border-ink/10 pt-2.5 text-[11.5px]">
              {pieces.map((p, i) => (
                <li key={p.name} className="flex animate-card-in items-center gap-2" style={{ animationDelay: `${450 + i * 90}ms` }}>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.colored ? color.hex : '#111', boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.25)' }} />
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-muted tabular-nums">CHF {p.price}</span>
                </li>
              ))}
            </ul>

            {/* Stock in the picked colour, judged against the size of the crew */}
            <div className={`mt-3 flex items-start gap-2 rounded-xl px-2.5 py-2 text-[11px] font-medium ${short ? 'bg-amber-500/12 text-amber-400' : 'bg-emerald-500/12 text-emerald-400'}`}>
              {short ? <TriangleAlert size={13} className="mt-px shrink-0" /> : <Check size={13} className="mt-px shrink-0" strokeWidth={3} />}
              <span>
                {short
                  ? `Only ${stock} left in ${color.name}. The fourth one in ${fallback.name}? Still meets the door.`
                  : `${stock} left in ${color.name}, enough for all ${CREW} of you.`}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-1">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`flex-1 rounded-full py-1 text-[11px] font-semibold transition-colors ${size === s ? 'bg-ink text-bg' : 'bg-ink/[0.06] hover:bg-ink/[0.12]'}`}
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              onClick={() => setHeld(true)}
              disabled={held}
              className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl py-3 text-[13px] font-semibold text-white transition-colors ${held ? 'bg-emerald-600' : 'bg-clay hover:bg-clay-dark'}`}
            >
              {held ? (
                <>
                  <PackageCheck size={16} /> Held at the pop-up · code {code}
                </>
              ) : (
                <>
                  Hold {CREW} in size {size} · CHF {outfit.price * CREW}
                </>
              )}
            </button>
            {held && <p className="mt-1.5 animate-card-in text-center text-[10.5px] text-muted">Pick up before {SHOP.closesAt}. Pay at the counter.</p>}
          </div>
        </article>

        <article className={card} style={{ animationDelay: '500ms' }}>
          <div className="px-2 pt-2 pb-1.5">
            <p className={label}>
              <Footprints size={12} /> Route inside · top to bottom
            </p>
            <ol className="relative mt-2.5 space-y-3 pl-5">
              {/* The escalator line the route walks down */}
              <span aria-hidden className="absolute top-1.5 bottom-1.5 left-[5px] w-px" style={{ background: `linear-gradient(${color.hex}, transparent)` }} />
              {route.map(({ level, items }, i) => (
                <li key={level} className="relative animate-card-in" style={{ animationDelay: `${650 + i * 120}ms` }}>
                  <span className="absolute top-1 -left-5 size-[11px] rounded-full ring-2 ring-black/30" style={{ background: color.hex }} />
                  <p className="text-[12px] font-semibold">{level}</p>
                  <p className="text-[11px] leading-snug text-muted">{items.map((p) => `${p.name} (${p.spot})`).join(' · ')}</p>
                </li>
              ))}
            </ol>
            <p className="mt-3 flex gap-2 border-t border-ink/10 pt-2.5 text-[11.5px] leading-snug">
              <span className="mt-0.5 shrink-0">
                <ClaudeLogo size={14} />
              </span>
              Changing rooms are on Level 1, so you can walk out already in costume.
            </p>
          </div>
        </article>
      </div>
    </div>
  )
}
