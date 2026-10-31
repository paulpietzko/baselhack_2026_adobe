import { useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Place } from '../data/basel'

const CARD_WIDTH = 220
const CARD_HEIGHT = 190 // approximate, used to keep cards on screen
// Keep cards clear of the edges and the location pill on top
const SAFE = { top: 52, bottom: 16, side: 16 }
// Full-width mode sits behind the top bar and messages, and fades out at the bottom
const SAFE_FULL = { top: 200, bottom: 150, side: 24 }

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max))

type Positioned = { place: Place; marker: { x: number; y: number }; card: { x: number; y: number } }

/** Pins with floating glass cards in the spirit of visionOS, tied to map coordinates (approach from bako's BakeryCards). */
export default function PlaceCards({ map, places }: { map: mapboxgl.Map; places: Place[] }) {
  const [positions, setPositions] = useState<Positioned[]>([])

  useEffect(() => {
    const update = () => {
      const { clientWidth: w, clientHeight: h } = map.getContainer()
      const safe = document.querySelector('[data-sidebar=collapsed]') ? SAFE_FULL : SAFE
      setPositions(
        places.map((place) => {
          const marker = map.project(place.lngLat)
          const rad = (place.cardAngle * Math.PI) / 180
          const x = marker.x + Math.cos(rad) * place.cardDistance
          const y = marker.y + Math.sin(rad) * place.cardDistance
          return {
            place,
            marker: { x: marker.x, y: marker.y },
            card: {
              x: clamp(x, safe.side + CARD_WIDTH / 2, w - safe.side - CARD_WIDTH / 2),
              y: clamp(y, safe.top + CARD_HEIGHT / 2, h - safe.bottom - CARD_HEIGHT / 2),
            },
          }
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
              {place.image ? (
                <img src={place.image} alt={place.name} className="absolute inset-0 size-full object-cover" />
              ) : (
                <place.icon size={26} strokeWidth={1.5} style={{ color: place.iconColor }} />
              )}
              <span className="absolute top-2 right-2 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums backdrop-blur-md">
                {place.time.replace(/^Tonight · /, '')}
              </span>
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
                <button className="shrink-0 text-[11px] font-semibold text-clay hover:text-clay-dark">Details ›</button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
