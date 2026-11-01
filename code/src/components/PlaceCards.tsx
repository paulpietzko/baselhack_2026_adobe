import { useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { BadgeCheck } from 'lucide-react'
import type { Place } from '../data/basel'

const CARD_WIDTH = 220
const CARD_HEIGHT = 190 // approximate, used to lay cards out
// Where cards may land on arrival: clear of the edges and the location pill on top
const SAFE = { top: 52, bottom: 16, side: 16 }
// Full-width mode: the messages are hidden, so only keep clear of the top bar and location pill; fades out at the bottom
const SAFE_FULL = { top: 120, bottom: 150, side: 24 }

const GAP = 12 // min space between cards

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max))

type Positioned = { place: Place; marker: { x: number; y: number }; card: { x: number; y: number } }

// Zoom out this far below the arrival view and only the dots remain
const HIDE_BELOW = 0.8

/**
 * Pins with glass cards in the spirit of visionOS, tied to map coordinates (approach from bako's BakeryCards).
 * Each card gets a free spot next to its pin once, on arrival, and then stays attached to that pin like a label:
 * it pans and zooms with the map instead of following the screen. Zoomed out, only the dots remain.
 */
export default function PlaceCards({ map, places }: { map: mapboxgl.Map; places: Place[] }) {
  const [positions, setPositions] = useState<Positioned[]>([])

  useEffect(() => {
    const showFrom = map.getZoom() - HIDE_BELOW

    // One-time layout in screen space: preferred angle from the data, kept on screen, overlaps pushed apart
    const { clientWidth: w, clientHeight: h } = map.getContainer()
    const safe = document.querySelector('[data-sidebar=collapsed]') ? SAFE_FULL : SAFE
    const keep = (c: { x: number; y: number }) => ({
      x: clamp(c.x, safe.side + CARD_WIDTH / 2, w - safe.side - CARD_WIDTH / 2),
      y: clamp(c.y, safe.top + CARD_HEIGHT / 2, h - safe.bottom - CARD_HEIGHT / 2),
    })
    const start = places.map((place) => {
      const marker = map.project(place.lngLat)
      const rad = (place.cardAngle * Math.PI) / 180
      return { marker, card: keep({ x: marker.x + Math.cos(rad) * place.cardDistance, y: marker.y + Math.sin(rad) * place.cardDistance }) }
    })
    for (let pass = 0; pass < 40; pass++) {
      let moved = false
      for (let i = 0; i < start.length; i++)
        for (let j = i + 1; j < start.length; j++) {
          const a = start[i].card
          const b = start[j].card
          const ox = CARD_WIDTH + GAP - Math.abs(a.x - b.x)
          const oy = CARD_HEIGHT + GAP - Math.abs(a.y - b.y)
          if (ox <= 0 || oy <= 0) continue
          moved = true
          const [axis, push] = ox < oy ? (['x', ox] as const) : (['y', oy] as const)
          const dir = a[axis] <= b[axis] ? 1 : -1
          a[axis] -= (dir * push) / 2
          b[axis] += (dir * push) / 2
          start[i].card = keep(a)
          start[j].card = keep(b)
        }
      if (!moved) break
    }
    // From now on each card keeps this pixel offset from its pin
    const offsets = start.map(({ marker, card }) => ({ dx: card.x - marker.x, dy: card.y - marker.y }))

    const update = () => {
      if (map.getZoom() < showFrom) return setPositions([])
      setPositions(
        places.map((place, i) => {
          const marker = map.project(place.lngLat)
          return { place, marker: { x: marker.x, y: marker.y }, card: { x: marker.x + offsets[i].dx, y: marker.y + offsets[i].dy } }
        }),
      )
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
  }, [map, places])

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
            className="stroke-ink/25"
            strokeWidth={1}
          />
        ))}
      </svg>

      {positions.map(({ place, card }) => (
        <article
          key={place.id}
          className="pointer-events-auto absolute -translate-1/2"
          style={{ left: card.x, top: card.y, width: CARD_WIDTH }}
        >
          <div
            className={`spatial-glass animate-card-in rounded-[26px] p-2 text-ink transition-transform duration-300 hover:scale-[1.03] ${
              place.hidden ? 'ring-2 ring-clay/70 shadow-[0_0_40px_rgb(217_119_87/0.45)]' : ''
            }`}
            style={{ animationDelay: '200ms' }}
          >
            {/* Inset header: photo, or the place's tint with its icon */}
            <div className="relative grid h-20 place-items-center overflow-hidden rounded-[20px]" style={{ background: place.tint }}>
              {/* Icon underneath: shows if there's no photo or the photo fails to load (hotlink blocked etc.) */}
              <place.icon size={26} strokeWidth={1.5} style={{ color: place.iconColor }} />
              {place.image && (
                <img
                  src={place.image}
                  alt={place.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                  className="absolute inset-0 size-full object-cover"
                />
              )}
              {place.time && (
                <span className="absolute top-2 right-2 max-w-[70%] truncate rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums backdrop-blur-md">
                  {place.time.replace(/^Tonight · /, '')}
                </span>
              )}
              {place.verified && (
                <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 backdrop-blur-md">
                  <BadgeCheck size={12} /> Verified
                </span>
              )}
            </div>
            <div className="px-1.5 pt-2.5 pb-1">
              <h3 className="truncate text-[13.5px] leading-tight font-semibold" title={place.name}>
                {place.name}
              </h3>
              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted">{place.description}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="truncate rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-medium text-muted">
                  {place.tag}
                </span>
                {place.url && (
                  <a
                    href={place.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[11px] font-semibold text-clay hover:text-clay-dark"
                  >
                    Details ›
                  </a>
                )}
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
