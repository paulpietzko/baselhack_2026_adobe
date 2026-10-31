import { useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { BadgeCheck } from 'lucide-react'
import type { Place } from '../data/basel'

const CARD_HEIGHT = 262 // approximate, used to keep cards on screen
const cardWidth = (screen: number) => (screen < 1360 ? 262 : 300)
const GAP = 14
// Keep cards clear of the trail on top and the input at the bottom
const SAFE = { top: 56, bottom: 232, left: 24, right: 24 }

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max))

type Positioned = { place: Place; marker: { x: number; y: number }; card: { x: number; y: number } }

/** Pins with floating glass cards in the spirit of visionOS, tied to map coordinates (approach from bako's BakeryCards). */
export default function PlaceCards({ map, places, highlight, safeRight = SAFE.right, onSelect }: {
  map: mapboxgl.Map
  /** Room to leave on the right, when tiles are showing */
  safeRight?: number
  places: Place[]
  /** The place the crew is being steered to: stands out and invites them in */
  highlight?: string
  onSelect?: (place: Place) => void
}) {
  const [positions, setPositions] = useState<Positioned[]>([])
  const [width, setWidth] = useState(300)

  useEffect(() => {
    const update = () => {
      const { clientWidth: w, clientHeight: h } = map.getContainer()
      const CARD_WIDTH = cardWidth(w)
      setWidth(CARD_WIDTH)
      const keep = (c: { x: number; y: number }) => ({
        x: clamp(c.x, SAFE.left + CARD_WIDTH / 2, w - safeRight - CARD_WIDTH / 2),
        y: clamp(c.y, SAFE.top + CARD_HEIGHT / 2, h - SAFE.bottom - CARD_HEIGHT / 2),
      })
      const next = places.map((place) => {
        const marker = map.project(place.lngLat)
        const rad = (place.cardAngle * Math.PI) / 180
        const card = keep({ x: marker.x + Math.cos(rad) * place.cardDistance, y: marker.y + Math.sin(rad) * place.cardDistance })
        return { place, marker: { x: marker.x, y: marker.y }, card }
      })
      // Nudge overlapping cards apart, along the axis that needs less
      for (let pass = 0; pass < 30; pass++) {
        let moved = false
        for (let i = 0; i < next.length; i++)
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i].card
            const b = next[j].card
            const ox = CARD_WIDTH + GAP - Math.abs(a.x - b.x)
            const oy = CARD_HEIGHT + GAP - Math.abs(a.y - b.y)
            if (ox <= 0 || oy <= 0) continue
            moved = true
            const [axis, push] = ox < oy ? (['x', ox] as const) : (['y', oy] as const)
            const dir = a[axis] <= b[axis] ? 1 : -1
            a[axis] -= (dir * push) / 2
            b[axis] += (dir * push) / 2
            next[i].card = keep(a)
            next[j].card = keep(b)
          }
        if (!moved) break
      }
      setPositions(next)
    }
    update()
    map.on('move', update)
    map.on('resize', update)
    // Small glowing dots in each place's colour, so pin and tile read as a pair
    const markers = places.map((p) => {
      const dot = document.createElement('span')
      dot.className = 'block size-3.5 rounded-full ring-[3px] ring-white shadow-[0_0_0_6px_rgb(255_255_255/0.35),0_4px_10px_rgb(0_0_0/0.3)]'
      dot.style.background = p.iconColor
      return new mapboxgl.Marker({ element: dot }).setLngLat(p.lngLat).addTo(map)
    })
    return () => {
      map.off('move', update)
      map.off('resize', update)
      markers.forEach((m) => m.remove())
    }
  }, [map, places, safeRight])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden font-system">
      <svg className="absolute inset-0 size-full animate-fade-in">
        {positions.map(({ place, marker, card }) => (
          <line
            key={place.id}
            x1={marker.x}
            y1={marker.y}
            x2={card.x}
            y2={card.y}
            className="stroke-white/40"
            strokeWidth={1}
          />
        ))}
      </svg>

      {positions.map(({ place, card }) => (
        <article
          key={place.id}
          className="pointer-events-auto absolute -translate-1/2"
          style={{ left: card.x, top: card.y, width }}
        >
          <div
            className={`spatial-glass animate-card-in rounded-[30px] p-2.5 text-ink transition-transform duration-300 hover:scale-[1.03] ${place.id === highlight ? 'ring-2 ring-clay' : ''}`}
            style={{ animationDelay: '200ms' }}
          >
            {/* Inset header: photo, or the place's tint with its icon */}
            <div className="relative grid h-28 place-items-center overflow-hidden rounded-[22px]" style={{ background: place.tint }}>
              {place.image ? (
                <img src={place.image} alt={place.name} className="absolute inset-0 size-full object-cover" />
              ) : (
                <place.icon size={38} strokeWidth={1.4} style={{ color: place.iconColor }} />
              )}
              {place.verified && (
                <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <BadgeCheck size={14} /> Owner verified
                </span>
              )}
              {place.time && (
                <span className="absolute top-2 right-2 max-w-[55%] truncate rounded-full bg-black/40 px-2.5 py-1 text-[13px] font-semibold text-white tabular-nums backdrop-blur-md">
                  {place.time.replace(/^Tonight · /, '')}
                </span>
              )}
            </div>
            <div className="px-2 pt-3 pb-1.5">
              <h3 className="truncate text-lg leading-tight font-semibold" title={place.name}>
                {place.name}
              </h3>
              <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted">{place.description}</p>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="truncate rounded-full bg-ink/[0.06] px-2.5 py-1 text-xs font-medium text-muted">
                  {place.tag}
                </span>
                <button onClick={() => onSelect?.(place)} className="shrink-0 text-sm font-semibold text-clay hover:text-clay-dark">
                  {place.id === highlight ? 'Step inside ›' : 'Details ›'}
                </button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
