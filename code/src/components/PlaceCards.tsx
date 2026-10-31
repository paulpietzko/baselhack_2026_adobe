import { useEffect, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import { ImageIcon } from 'lucide-react'
import type { Place } from '../data/basel'

const CARD_WIDTH = 220
const CARD_HEIGHT = 240 // approximate, used to keep cards on screen
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
    return () => {
      map.off('move', update)
      map.off('resize', update)
    }
  }, [map, places])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 size-full animate-fade-in">
        {positions.map(({ place, marker, card }) => (
          <line
            key={place.id}
            x1={marker.x}
            y1={marker.y}
            x2={card.x}
            y2={card.y}
            className="stroke-clay"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            opacity={0.7}
          />
        ))}
      </svg>

      {positions.map(({ place, marker }, i) => (
        <span
          key={place.id}
          className="absolute grid size-8 -translate-1/2 animate-pop-in place-items-center rounded-full bg-clay text-sm font-semibold text-white ring-4 ring-clay/30"
          style={{ left: marker.x, top: marker.y, animationDelay: `${i * 120}ms` }}
        >
          {i + 1}
        </span>
      ))}

      {positions.map(({ place, card }, i) => (
        <article
          key={place.id}
          className="pointer-events-auto absolute -translate-1/2"
          style={{ left: card.x, top: card.y, width: CARD_WIDTH }}
        >
          <div
            className="animate-card-in overflow-hidden rounded-xl border border-border bg-surface/95 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur"
            style={{ animationDelay: `${200 + i * 120}ms` }}
          >
            {place.image ? (
              <img src={place.image} alt={place.name} className="h-24 w-full object-cover" />
            ) : (
              <div className="grid h-24 place-items-center bg-gradient-to-br from-clay/35 via-bubble to-surface text-muted">
                <ImageIcon size={22} strokeWidth={1.5} />
              </div>
            )}
            <div className="space-y-1.5 p-3">
              <div className="flex items-center gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-clay text-[11px] font-semibold text-white">
                  {i + 1}
                </span>
                <h3 className="truncate text-sm font-semibold">{place.name}</h3>
              </div>
              <p className="text-xs leading-snug text-muted">{place.description}</p>
              <p className="text-[11px] font-medium text-clay">{place.meta}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
