import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { MapPin } from 'lucide-react'
import Globe from './Globe'
import PlaceCards from './PlaceCards'
import ClubDetails from './ClubDetails'
import { BASEL_CAMERA, BASEL_PLACES, CLUB_ROUGE, type Place } from '../data/basel'

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

const GEM = BASEL_PLACES.find((p) => p.id === CLUB_ROUGE.id)!
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

// The club's two floors sit on top of its building: the bottom 60% stays grey, the top 40% is split into two clay floors
const CLUB_FROM = 0.6
const FLOORS = [
  { id: 'gem-floor-lower', name: 'lower', from: 0.6, to: 0.8, color: '#c96a4b', hover: '#f0a487' },
  { id: 'gem-floor-upper', name: 'upper', from: 0.8, to: 1, color: '#e08463', hover: '#f8c2ad' },
] as const
export type ClubFloor = (typeof FLOORS)[number]['name']
const DIVIDER_M = 0.4 // dark slab between the two floors, so they read as separate floors

/** Height at a fraction of the building, from its base to its roof */
const at = (f: number, dm = 0) =>
  ['+', ['get', 'min_height'], ['*', ['-', ['get', 'height'], ['get', 'min_height']], f], dm] as unknown as mapboxgl.ExpressionSpecification

/** Find the building under the gem: grey below, its top two floors in clay as separate, hoverable layers */
function highlightBuilding(m: mapboxgl.Map, dark: boolean): string | number | undefined {
  const p = m.project(GEM.lngLat)
  // Widen the search until we hit a building (the pin may sit on a street)
  let building: (mapboxgl.GeoJSONFeature & { id?: string | number }) | undefined
  for (const r of [8, 24, 48]) {
    building = m.queryRenderedFeatures([[p.x - r, p.y - r], [p.x + r, p.y + r]], { layers: ['3d-buildings'] })[0]
    if (building) break
  }
  if (!building || building.id == null || m.getLayer('gem-building')) return
  // Drop the club from the grey layer, otherwise the layers' walls overlap and z-fight (stripes)
  m.setFilter('3d-buildings', ['all', EXTRUDED, ['!=', ['id'], building.id]] as unknown as mapboxgl.FilterSpecification)
  const filter = ['==', ['id'], building.id] as mapboxgl.FilterSpecification
  const base = { type: 'fill-extrusion' as const, source: 'composite', 'source-layer': 'building', filter }
  // Rest of the building, grey like its neighbours
  m.addLayer({
    ...base,
    id: 'gem-building',
    paint: {
      'fill-extrusion-color': dark ? '#3a3a3c' : '#d6d3cc',
      'fill-extrusion-base': ['get', 'min_height'],
      'fill-extrusion-height': at(CLUB_FROM),
      'fill-extrusion-opacity': 1,
    },
  })
  for (const f of FLOORS) {
    m.addLayer({
      ...base,
      id: f.id,
      paint: {
        'fill-extrusion-color': ['case', ['boolean', ['feature-state', f.id], false], f.hover, f.color] as mapboxgl.ExpressionSpecification,
        'fill-extrusion-base': at(f.from),
        // The lower floor stops short of the upper one, the divider fills the gap
        'fill-extrusion-height': f.to < 1 ? at(f.to, -DIVIDER_M) : at(f.to),
        'fill-extrusion-opacity': 1,
      },
    })
  }
  m.addLayer({
    ...base,
    id: 'gem-floor-divider',
    paint: {
      'fill-extrusion-color': '#7a3a26',
      'fill-extrusion-base': at(FLOORS[0].to, -DIVIDER_M),
      'fill-extrusion-height': at(FLOORS[0].to),
      'fill-extrusion-opacity': 1,
    },
  })
  return building.id
}

/** Hovering a club floor lights it up with a pointer cursor; clicking it calls onClick. Returns a cleanup. */
function makeClubFloorsInteractive(m: mapboxgl.Map, id: string | number, onClick: (floor: ClubFloor) => void) {
  const feature = { source: 'composite', sourceLayer: 'building', id }
  const off = FLOORS.map((f) => {
    const enter = () => {
      m.setFeatureState(feature, { [f.id]: true })
      m.getCanvas().style.cursor = 'pointer'
    }
    const leave = () => {
      m.setFeatureState(feature, { [f.id]: false })
      m.getCanvas().style.cursor = ''
    }
    const click = () => onClick(f.name)
    m.on('mouseenter', f.id, enter)
    m.on('mouseleave', f.id, leave)
    m.on('click', f.id, click)
    return () => {
      m.off('mouseenter', f.id, enter)
      m.off('mouseleave', f.id, leave)
      m.off('click', f.id, click)
    }
  })
  return () => {
    off.forEach((o) => o())
    m.getCanvas().style.cursor = ''
  }
}

/**
 * Globe embedded in a Claude answer: spins until the agent's places arrive, flies to them, shows their cards.
 * No frame, like a Vision Pro persona:
 * - sidebar open: an inset, rounded window into the map that dissolves on every side
 * - sidebar collapsed: the map fills the whole chat behind the messages, top to edges, and fades out at the bottom
 */
export default function GlobeView({ places, focused = false, searching = null, onClubFloorsClick }: {
  places: Place[] | null
  /** Zoom into the hidden gem in 3D and show its detail cards */
  focused?: boolean
  /** While the agent searches: what it's looking up right now ('' before its first step); null when done */
  searching?: string | null
  /** Clicked one of the club's two floors on top of its building */
  onClubFloorsClick?: (floor: ClubFloor) => void
}) {
  const [loaded, setLoaded] = useState<{ map: mapboxgl.Map; stopSpin: () => void } | null>(null)
  const [map, setMap] = useState<mapboxgl.Map | null>(null)
  const [arrivedAtGem, setArrivedAtGem] = useState(false)
  // Latest handler without re-running the fly-in effect
  const onClubFloorsClickRef = useRef(onClubFloorsClick)
  onClubFloorsClickRef.current = onClubFloorsClick

  useEffect(() => {
    if (!map || !focused) return
    const dark = document.documentElement.dataset.theme !== 'light'
    add3dBuildings(map, dark)
    map.flyTo({ center: GEM.lngLat, zoom: 18.2, pitch: 60, bearing: -25, offset: [0, -40], duration: 3000, essential: true })
    let cleanupFloors: (() => void) | undefined
    // Wait for the zoomed-in building tiles to render before looking up the club's building
    const onIdle = () => {
      const id = highlightBuilding(map, dark)
      if (id != null) cleanupFloors = makeClubFloorsInteractive(map, id, (floor) => onClubFloorsClickRef.current?.(floor))
    }
    const onArrive = () => {
      setArrivedAtGem(true)
      map.once('idle', onIdle)
    }
    map.once('moveend', onArrive)
    return () => {
      map.off('moveend', onArrive)
      map.off('idle', onIdle)
      cleanupFloors?.()
    }
  }, [map, focused])

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

      {map && places && !focused && <PlaceCards map={map} places={places} />}

      {arrivedAtGem && <ClubDetails />}

      {searching !== null && (
        <span className="spatial-glass absolute top-3 right-3 flex max-w-[60%] animate-fade-in items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium sidebar-collapsed:top-16 sidebar-collapsed:right-4">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-clay/60" />
            <span className="size-2 rounded-full bg-clay" />
          </span>
          <span className="truncate">{searching ? `Searching for ${searching}` : 'Searching…'}</span>
        </span>
      )}

      {map && (
        <span className="absolute top-3 left-1/2 sidebar-collapsed:top-10 flex h-8 -translate-x-1/2 animate-fade-in items-center gap-1.5 rounded-full bg-surface/80 px-3 text-xs font-medium backdrop-blur">
          <MapPin size={14} className="text-clay" /> {arrivedAtGem ? `${GEM.name} · Basel` : 'Basel, Switzerland'}
        </span>
      )}
    </div>
  )
}
