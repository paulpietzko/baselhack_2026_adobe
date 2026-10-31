import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { MapPin } from 'lucide-react'
import Globe from './Globe'
import PlaceCards from './PlaceCards'
import { BASEL_CAMERA, BASEL_PLACES } from '../data/basel'

// How long the globe spins before we fly to the destination
const GLOBE_INTRO_MS = 500
const FLY_DURATION_MS = 2500

const VISIBLE_PLACES = BASEL_PLACES.filter((p) => !p.hidden)

/**
 * Globe embedded in a Claude answer: spins, flies to Basel, shows places. No frame, like a Vision Pro persona:
 * - sidebar open: an inset, rounded window into the map that dissolves on every side
 * - sidebar collapsed: the map fills the whole chat behind the messages, top to edges, and fades out at the bottom
 */
export default function GlobeView({ unlocked = false }: { unlocked?: boolean }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [map, setMap] = useState<mapboxgl.Map | null>(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const handleLoad = (m: mapboxgl.Map, stopSpin: () => void) => {
    timer.current = setTimeout(() => {
      stopSpin()
      // Fixed end view (see BASEL_CAMERA); flat map (no pitch/bearing) for now
      m.flyTo({ ...BASEL_CAMERA, bearing: 0, pitch: 0, duration: FLY_DURATION_MS, essential: true })
      // Registered after flyTo, so the interrupted spin animation's moveend doesn't count
      m.once('moveend', () => setMap(m))
    }, GLOBE_INTRO_MS)
  }

  return (
    <div className="pointer-events-auto relative mx-auto my-2 min-h-0 w-[92%] flex-1 sidebar-collapsed:fixed sidebar-collapsed:z-0 sidebar-collapsed:top-0 sidebar-collapsed:right-0 sidebar-collapsed:left-14 sidebar-collapsed:mt-0 sidebar-collapsed:h-screen sidebar-collapsed:w-auto">
      {/* Wrapper does the positioning: mapbox-gl.css forces `position: relative` on the map element itself */}
      <div className="persona-fade absolute inset-0 animate-globe-in sidebar-collapsed:rounded-none sidebar-collapsed:[mask-image:linear-gradient(to_bottom,#000_65%,transparent_95%)]">
        <Globe className="size-full" onLoad={handleLoad} />
      </div>

      {map && <PlaceCards map={map} places={unlocked ? BASEL_PLACES : VISIBLE_PLACES} />}

      {map && (
        <span className="absolute top-3 left-1/2 sidebar-collapsed:top-16 flex h-8 -translate-x-1/2 animate-fade-in items-center gap-1.5 rounded-full bg-surface/80 px-3 text-xs font-medium backdrop-blur">
          <MapPin size={14} className="text-clay" /> Basel, Switzerland
        </span>
      )}
    </div>
  )
}
