import { useEffect, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Place } from '../data/basel'

const CLAY = '#d97757' // --color-clay; Mapbox markers need a literal color
const CARD_WIDTH = 240
const CARD_HEIGHT = 210 // approximate, used to keep cards on screen
// Keep cards clear of the screen edges, the top buttons and the bottom voice bar
const SAFE = { top: 76, bottom: 100, side: 16 }

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max))

type Positioned = { place: Place; marker: { x: number; y: number }; card: { x: number; y: number } }

/** Numbered markers with floating cards, tied to map coordinates (approach from bako's BakeryCards). */
export default function PlaceCards({ map, places }: { map: mapboxgl.Map; places: Place[] }) {
  const [positions, setPositions] = useState<Positioned[]>([])

  useEffect(() => {
    const update = () => {
      const { clientWidth: w, clientHeight: h } = map.getContainer()
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
              x: clamp(x, SAFE.side + CARD_WIDTH / 2, w - SAFE.side - CARD_WIDTH / 2),
              y: clamp(y, SAFE.top + CARD_HEIGHT / 2, h - SAFE.bottom - CARD_HEIGHT / 2),
            },
          }
        }),
      )
    }
    update()
    map.on('move', update)
    map.on('resize', update)
    // Plain Mapbox pins, like bako (the tip sits on the place)
    const markers = places.map((p) => new mapboxgl.Marker({ color: CLAY }).setLngLat(p.lngLat).addTo(map))
    return () => {
      map.off('move', update)
      map.off('resize', update)
      markers.forEach((m) => m.remove())
    }
  }, [map, places])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 size-full animate-fade-in">
        {positions.map(({ place, marker, card }) => (
          <g key={place.id}>
            <line
              x1={marker.x}
              y1={marker.y}
              x2={card.x}
              y2={card.y}
              className="stroke-clay"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              opacity={0.7}
            />
            <circle cx={marker.x} cy={marker.y} r={4} className="fill-clay" />
          </g>
        ))}
      </svg>

      {positions.map(({ place, card }) => (
        <article
          key={place.id}
          className="pointer-events-auto absolute -translate-1/2"
          style={{ left: card.x, top: card.y, width: CARD_WIDTH }}
        >
          <div
            className="animate-card-in overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
            style={{ animationDelay: '200ms' }}
          >
            {/* Header: photo, or tinted placeholder with an icon */}
            <div className="relative h-24" style={{ background: place.tint }}>
              {place.image ? (
                <img src={place.image} alt={place.name} className="size-full object-cover" />
              ) : (
                <>
                  <place.icon
                    size={32}
                    strokeWidth={1.5}
                    className="absolute top-1/2 left-1/2 -translate-1/2"
                    style={{ color: place.iconColor }}
                  />
                  <span className="absolute bottom-1.5 left-2 rounded bg-black/45 px-1 text-[9px] tracking-wide text-ink/80">
                    [PHOTO]
                  </span>
                </>
              )}
              <span className="absolute top-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-[#f0b48f]">
                {place.time}
              </span>
            </div>

            <div className="p-3">
              {/* Name always on one line (truncates as a last resort) */}
              <h3 className="truncate font-serif text-base leading-tight" title={place.name}>
                {place.name}
              </h3>
              <span className="mt-1 inline-block rounded-full border border-[#8b83d8]/70 px-2 py-px text-[10px] font-medium text-[#b9b2f5]">
                {place.tag}
              </span>
              {/* Details sits on the description's last line */}
              <div className="mt-1 flex items-end gap-3">
                <p className="flex-1 text-xs leading-snug text-muted">{place.description}</p>
                <button className="shrink-0 text-xs font-medium text-clay hover:text-clay-dark">Details →</button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
