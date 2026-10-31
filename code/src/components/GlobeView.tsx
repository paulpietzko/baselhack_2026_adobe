import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { MapPin } from 'lucide-react'
import Globe from './Globe'
import PlaceCards from './PlaceCards'
import { BASEL_CAMERA, type Place } from '../data/basel'

// Web Mercator y (0 at the top, 1 at the bottom) for a latitude
const mercY = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2

/**
 * Center and zoom that fit all places into the middle ~45% of the map, leaving the outer band for their cards.
 * Computed by hand: Mapbox's cameraForBounds is off while the map is still a zoomed-out globe.
 */
function fit(places: Place[], w: number, h: number) {
  const lngs = places.map((p) => p.lngLat[0])
  const lats = places.map((p) => p.lngLat[1])
  const [west, east, south, north] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)]
  const spanX = (east - west) / 360
  const spanY = mercY(south) - mercY(north)
  // world width at zoom z is 512 * 2^z px
  const zoom = Math.log2(Math.min((w * 0.45) / (512 * spanX || 1e-9), (h * 0.4) / (512 * spanY || 1e-9)))
  return { center: [(west + east) / 2, (south + north) / 2] as [number, number], zoom: Math.min(zoom, 15.5) }
}

// How long the globe spins before we fly to the destination
const GLOBE_INTRO_MS = 500
const FLY_DURATION_MS = 2500

/**
 * Globe embedded in a Claude answer: spins until the agent's places arrive, flies to them, shows their cards.
 * No frame, like a Vision Pro persona:
 * - sidebar open: an inset, rounded window into the map that dissolves on every side
 * - sidebar collapsed: the map fills the whole chat behind the messages, top to edges, and fades out at the bottom
 */
export default function GlobeView({ places }: { places: Place[] | null }) {
  const [loaded, setLoaded] = useState<{ map: mapboxgl.Map; stopSpin: () => void } | null>(null)
  const [map, setMap] = useState<mapboxgl.Map | null>(null)
  const flown = useRef(false)

  // Fly once both the map and the answer are ready; the globe keeps spinning while the agent searches
  useEffect(() => {
    if (!loaded || !places || flown.current) return
    const timer = setTimeout(() => {
      flown.current = true
      const { map: m, stopSpin } = loaded
      stopSpin()
      const { clientWidth: w, clientHeight: h } = m.getContainer()
      const camera = places.length ? fit(places, w, h) : BASEL_CAMERA
      m.flyTo({ ...camera, bearing: 0, pitch: 0, duration: FLY_DURATION_MS, essential: true })
      // Registered after flyTo, so the interrupted spin animation's moveend doesn't count
      m.once('moveend', () => setMap(m))
    }, GLOBE_INTRO_MS)
    return () => clearTimeout(timer)
  }, [loaded, places])

  return (
    <div className="pointer-events-auto relative mx-auto my-2 min-h-0 w-[92%] flex-1 sidebar-collapsed:fixed sidebar-collapsed:z-0 sidebar-collapsed:top-0 sidebar-collapsed:right-0 sidebar-collapsed:left-14 sidebar-collapsed:mt-0 sidebar-collapsed:h-screen sidebar-collapsed:w-auto">
      {/* Wrapper does the positioning: mapbox-gl.css forces `position: relative` on the map element itself */}
      <div className="persona-fade absolute inset-0 animate-globe-in sidebar-collapsed:rounded-none sidebar-collapsed:[mask-image:linear-gradient(to_bottom,#000_65%,transparent_95%)]">
        <Globe className="size-full" onLoad={(m, stopSpin) => setLoaded({ map: m, stopSpin })} />
      </div>

      {map && places && <PlaceCards map={map} places={places} />}

      {map && (
        <span className="absolute top-3 left-1/2 sidebar-collapsed:top-16 flex h-8 -translate-x-1/2 animate-fade-in items-center gap-1.5 rounded-full bg-surface/80 px-3 text-xs font-medium backdrop-blur">
          <MapPin size={14} className="text-clay" /> Basel, Switzerland
        </span>
      )}
    </div>
  )
}
