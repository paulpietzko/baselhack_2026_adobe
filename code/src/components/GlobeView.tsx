import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { MapPin } from 'lucide-react'
import Globe from './Globe'
import PlaceCards from './PlaceCards'
import ClubDetails from './ClubDetails'
import { BASEL_CAMERA, BASEL_PLACES, CLUB_ROUGE } from '../data/basel'

// How long the globe spins before we fly to the destination
const GLOBE_INTRO_MS = 500
const FLY_DURATION_MS = 2500

const VISIBLE_PLACES = BASEL_PLACES.filter((p) => !p.hidden)
const GEM = BASEL_PLACES.find((p) => p.id === CLUB_ROUGE.id)!
const GEM_COLOR = '#d97757' // clay
const EXTRUDED = ['==', ['get', 'extrude'], 'true'] as const

/** 3D buildings like bako: grey extrusions from zoom 15, under the labels */
function add3dBuildings(m: mapboxgl.Map, dark: boolean) {
  if (m.getLayer('3d-buildings')) return
  const labelLayerId = m.getStyle()?.layers?.find((l) => l.type === 'symbol' && l.layout && 'text-field' in l.layout)?.id
  m.addLayer(
    {
      id: '3d-buildings',
      source: 'composite',
      'source-layer': 'building',
      filter: EXTRUDED as unknown as mapboxgl.FilterSpecification,
      type: 'fill-extrusion',
      minzoom: 15,
      paint: {
        'fill-extrusion-color': dark ? '#3a3a3c' : '#d6d3cc',
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'height']],
        'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'min_height']],
        // Fully opaque: a solid city like bako, no see-through walls
        'fill-extrusion-opacity': 1,
      },
    },
    labelLayerId,
  )
}

/** Find the building under the gem and extrude it in clay */
function highlightBuilding(m: mapboxgl.Map) {
  const p = m.project(GEM.lngLat)
  // Widen the search until we hit a building (the pin may sit on a street)
  let building: (mapboxgl.GeoJSONFeature & { id?: string | number }) | undefined
  for (const r of [8, 24, 48]) {
    building = m.queryRenderedFeatures([[p.x - r, p.y - r], [p.x + r, p.y + r]], { layers: ['3d-buildings'] })[0]
    if (building) break
  }
  if (!building || building.id == null || m.getLayer('gem-building')) return
  // Drop the club from the grey layer, otherwise grey and clay walls overlap and z-fight (stripes)
  m.setFilter('3d-buildings', ['all', EXTRUDED, ['!=', ['id'], building.id]] as unknown as mapboxgl.FilterSpecification)
  m.addLayer({
    id: 'gem-building',
    type: 'fill-extrusion',
    source: 'composite',
    'source-layer': 'building',
    filter: ['==', ['id'], building.id],
    paint: {
      'fill-extrusion-color': GEM_COLOR,
      // True height, same as the grey buildings around it
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'min_height'],
      'fill-extrusion-opacity': 1,
    },
  })
}

/**
 * Globe embedded in a Claude answer: spins, flies to Basel, shows places. No frame, like a Vision Pro persona:
 * - sidebar open: an inset, rounded window into the map that dissolves on every side
 * - sidebar collapsed: the map fills the whole chat behind the messages, top to edges, and fades out at the bottom
 */
export default function GlobeView({ unlocked = false, focused = false }: {
  unlocked?: boolean
  /** Zoom into the hidden gem in 3D and show its detail cards */
  focused?: boolean
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [map, setMap] = useState<mapboxgl.Map | null>(null)
  const [arrivedAtGem, setArrivedAtGem] = useState(false)

  useEffect(() => {
    if (!map || !focused) return
    add3dBuildings(map, document.documentElement.dataset.theme !== 'light')
    map.flyTo({ center: GEM.lngLat, zoom: 18.2, pitch: 60, bearing: -25, offset: [0, -40], duration: 3000, essential: true })
    // Wait for the zoomed-in building tiles to render before looking up the club's building
    const onIdle = () => highlightBuilding(map)
    const onArrive = () => {
      setArrivedAtGem(true)
      map.once('idle', onIdle)
    }
    map.once('moveend', onArrive)
    return () => {
      map.off('moveend', onArrive)
      map.off('idle', onIdle)
    }
  }, [map, focused])

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

      {map && !focused && <PlaceCards map={map} places={unlocked ? BASEL_PLACES : VISIBLE_PLACES} />}

      {arrivedAtGem && <ClubDetails />}

      {map && (
        <span className="absolute top-3 left-1/2 sidebar-collapsed:top-10 flex h-8 -translate-x-1/2 animate-fade-in items-center gap-1.5 rounded-full bg-surface/80 px-3 text-xs font-medium backdrop-blur">
          <MapPin size={14} className="text-clay" /> {arrivedAtGem ? `${GEM.name} · Basel` : 'Basel, Switzerland'}
        </span>
      )}
    </div>
  )
}
