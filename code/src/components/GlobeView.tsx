import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import mapboxgl from 'mapbox-gl'
import { MapPin } from 'lucide-react'
import Globe from './Globe'
import PlaceCards from './PlaceCards'
import ClubDetails from './ClubDetails'
import ImmersiveFloor from './immersive/ImmersiveFloor'
import ClubFloorLabels, { type ClubBuilding, type FloorLabel } from './ClubFloorLabels'
import ShopDetails from './ShopDetails'
import type { OutfitChoice } from './immersive/FloorTiles'
import type { FloorId } from '../data/floors'
import { COLORS } from '../data/costumes'
import { SHOP } from '../data/shop'
import { CASINO } from '../data/casino'
import CasinoDetails from './CasinoDetails'
import RouteOverview from './RouteOverview'
import { BASEL_CAMERA, BASEL_PLACES, HAFENLICHT_CLUB, type Place } from '../data/basel'

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

const GEM = BASEL_PLACES.find((p) => p.id === HAFENLICHT_CLUB.id)!
// Looking at the club from across the street
const GEM_CAMERA = { center: GEM.lngLat, zoom: 18.2, pitch: 60, bearing: -25, offset: [0, -40] as [number, number] }
// Clicking a floor dives at it: towards the building for the hall, up to a near-horizontal skyline for the roof
const FLOOR_DIVE_MS = 1400
const FLOOR_CAMERA: Record<FloorId, mapboxgl.CameraOptions> = {
  'main-hall': { center: GEM.lngLat, zoom: 19.6, pitch: 70, bearing: -25 },
  rooftop: { center: GEM.lngLat, zoom: 17.4, pitch: 82, bearing: 155 },
}
// How far the city steps back: indoors it's gone, on the roof it's the view (story: Journey.tsx mapMood)
const FLOOR_MOOD: Record<FloorId, string> = { 'main-hall': 'brightness-[0.2] blur-[10px]', rooftop: 'brightness-90 blur-[1.5px]' }
const EXTRUDED = ['==', ['get', 'extrude'], 'true'] as const

// Buildings drawn by their own layer (club, mall, casino), kept out of the grey layer so the walls don't z-fight
const excluded = new WeakMap<mapboxgl.Map, Set<string | number>>()
function exclude(m: mapboxgl.Map, id: string | number, on: boolean) {
  const ids = excluded.get(m) ?? new Set()
  excluded.set(m, ids)
  if (on) ids.add(id)
  else ids.delete(id)
  if (!m.getLayer('3d-buildings')) return
  m.setFilter('3d-buildings', ['all', EXTRUDED, ...[...ids].map((i) => ['!=', ['id'], i])] as unknown as mapboxgl.FilterSpecification)
}

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
function highlightBuilding(m: mapboxgl.Map, dark: boolean): ClubBuilding | undefined {
  const p = m.project(GEM.lngLat)
  // Widen the search until we hit a building (the pin may sit on a street)
  let building: (mapboxgl.GeoJSONFeature & { id?: string | number }) | undefined
  for (const r of [8, 24, 48]) {
    building = m.queryRenderedFeatures([[p.x - r, p.y - r], [p.x + r, p.y + r]], { layers: ['3d-buildings'] })[0]
    if (building) break
  }
  if (!building || building.id == null || m.getLayer('gem-building')) return
  // Drop the club from the grey layer, otherwise the layers' walls overlap and z-fight (stripes)
  exclude(m, building.id, true)
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
  // Footprint and height, for the floor labels
  const { geometry: g, properties } = building as unknown as { geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> | null }
  // Polygon → one polygon, MultiPolygon → several; the outer ring of each
  const polygons = (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []) as number[][][][]
  const rings = polygons.map((p) => p[0])
  const props = properties ?? {}
  return {
    id: building.id,
    ring: rings.flat() as [number, number][],
    base: Number(props.min_height ?? 0),
    height: Number(props.height ?? 0),
  }
}

// Flying to the mall, like bako flies to a bakery: straight in, tilted to 3D
const SHOP_CAMERA = { center: SHOP.lngLat, zoom: 17.5, pitch: 60, bearing: -20, offset: [0, 60] as [number, number] }
const SHOP_FLY_MS = 3000
const SHOP_RISE_MS = 1400

// On from the mall to the casino: same move, out by the airport road
const CASINO_CAMERA = { center: CASINO.lngLat, zoom: 17.3, pitch: 60, bearing: 25, offset: [0, 60] as [number, number] }

/**
 * Light up a building like bako lights up a bakery (the mall in the colour of the look, the casino in gold):
 * it rises out of the ground. Returns its footprint (for the beacon) and a cleanup.
 */
function highlightRising(m: mapboxgl.Map, lngLat: [number, number], layerId: string, color: string): { building: ClubBuilding | null; cleanup: () => void } {
  const p = m.project(lngLat)
  let building: (mapboxgl.GeoJSONFeature & { id?: string | number }) | undefined
  for (const r of [8, 24, 48]) {
    building = m.queryRenderedFeatures([[p.x - r, p.y - r], [p.x + r, p.y + r]], { layers: ['3d-buildings'] })[0]
    if (building) break
  }
  if (!building || building.id == null || m.getLayer(layerId)) return { building: null, cleanup: () => {} }
  const id = building.id
  // Out of the grey layer, so the rising building isn't hidden inside its own grey copy
  exclude(m, id, true)
  const filter = ['==', ['id'], id] as mapboxgl.FilterSpecification
  const base = { source: 'composite', 'source-layer': 'building', filter }
  m.addLayer({
    ...base,
    id: layerId,
    type: 'fill-extrusion',
    paint: {
      'fill-extrusion-color': color,
      'fill-extrusion-base': ['get', 'min_height'],
      'fill-extrusion-height': ['get', 'min_height'],
      'fill-extrusion-opacity': 1,
      'fill-extrusion-vertical-gradient': true,
    },
  })
  // Rise with an ease-out
  const start = performance.now()
  let frame = requestAnimationFrame(function tick(now) {
    if (!m.getLayer(layerId)) return
    const t = Math.min(1, (now - start) / SHOP_RISE_MS)
    const k = 1 - (1 - t) ** 3
    m.setPaintProperty(layerId, 'fill-extrusion-height', [
      '+', ['get', 'min_height'], ['*', ['-', ['get', 'height'], ['get', 'min_height']], k],
    ] as unknown as mapboxgl.ExpressionSpecification)
    if (t < 1) frame = requestAnimationFrame(tick)
  })
  const { geometry: g, properties } = building as unknown as { geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> | null }
  const polygons = (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []) as number[][][][]
  return {
    building: {
      id,
      ring: polygons.map((poly) => poly[0]).flat() as [number, number][],
      base: Number(properties?.min_height ?? 0),
      height: Number(properties?.height ?? 0),
    },
    cleanup: () => {
      cancelAnimationFrame(frame)
      if (m.getLayer(layerId)) m.removeLayer(layerId)
      exclude(m, id, false)
    },
  }
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
export default function GlobeView({ places, fixedCamera = false, focused = false, searching = null, onClubFloorsClick, floor = null, onFloor, onShop, casino = false, onCasino, route = false, onRoute }: {
  places: Place[] | null
  /** Presentation mock: always fly to the hand-tuned BASEL_CAMERA instead of fitting the places */
  fixedCamera?: boolean
  /** Zoom into the hidden gem in 3D and show its detail cards */
  focused?: boolean
  /** While the agent searches: what it's looking up right now ('' before its first step); null when done */
  searching?: string | null
  /** Clicked one of the club's two floors on top of its building */
  onClubFloorsClick?: (floor: ClubFloor) => void
  /** Standing on one of the club's floors: the map goes fullscreen behind the immersive view */
  floor?: FloorId | null
  /** Switch floors (id) or leave (null) from inside the immersive view */
  onFloor?: (floor: FloorId | null) => void
  /** Off to the mall with a look (or back from it), so the chat can show what we're shopping for */
  onShop?: (choice: OutfitChoice | null) => void
  /** On from the mall to the casino (only once we're at the mall) */
  casino?: boolean
  /** Back from the casino to the mall */
  onCasino?: (on: boolean) => void
  /** Zoomed out over the whole night: mall → casino → club (only once we're at the casino) */
  route?: boolean
  /** Back from the overview to the casino */
  onRoute?: (on: boolean) => void
}) {
  const [loaded, setLoaded] = useState<{ map: mapboxgl.Map; stopSpin: () => void } | null>(null)
  const [map, setMap] = useState<mapboxgl.Map | null>(null)
  const [arrivedAtGem, setArrivedAtGem] = useState(false)
  // The club's real building once found, so its floors can get labels
  const [club, setClub] = useState<ClubBuilding | null>(null)
  // Latest handler without re-running the fly-in effect
  const onClubFloorsClickRef = useRef(onClubFloorsClick)
  onClubFloorsClickRef.current = onClubFloorsClick

  useEffect(() => {
    if (!map || !focused) return
    const dark = document.documentElement.dataset.theme !== 'light'
    add3dBuildings(map, dark)
    map.flyTo({ ...GEM_CAMERA, duration: 3000, essential: true })
    let cleanupFloors: (() => void) | undefined
    // Wait for the zoomed-in building tiles to render before looking up the club's building
    const onIdle = () => {
      const found = highlightBuilding(map, dark)
      if (!found) return
      setClub(found)
      cleanupFloors = makeClubFloorsInteractive(map, found.id, (floor) => onClubFloorsClickRef.current?.(floor))
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
      setClub(null)
    }
  }, [map, focused])

  // Upper clay floor is the Rooftop, lower the Main Hall (same mapping as Home)
  const floorLabels = useMemo<FloorLabel[]>(
    () => [
      { layerId: 'gem-floor-upper', from: 0.8, to: 1, title: 'Rooftop', subtitle: 'House & disco', side: 'left', onClick: () => onClubFloorsClickRef.current?.('upper') },
      { layerId: 'gem-floor-lower', from: 0.6, to: 0.8, title: 'Main Hall', subtitle: 'Techno', side: 'right', onClick: () => onClubFloorsClickRef.current?.('lower') },
    ],
    [],
  )

  // "Where can we get it?": leave the floor and fly across town to the mall with the look the crew picked
  const [shop, setShop] = useState<OutfitChoice | null>(null)
  const [shopBuilding, setShopBuilding] = useState<ClubBuilding | null>(null)
  const [atShop, setAtShop] = useState(false)
  const goShopping = (choice: OutfitChoice) => {
    setShop(choice)
    onShop?.(choice)
    onFloor?.(null)
  }
  const shopColor = shop && COLORS.find((c) => c.id === shop.color)!.hex
  useEffect(() => {
    if (!map || !shopColor) return
    const dark = document.documentElement.dataset.theme !== 'light'
    add3dBuildings(map, dark)
    map.flyTo({ ...SHOP_CAMERA, duration: SHOP_FLY_MS, essential: true })
    let cleanup: (() => void) | undefined
    const onIdle = () => {
      const found = highlightRising(map, SHOP.lngLat, 'shop-building', shopColor)
      setShopBuilding(found.building)
      setAtShop(true)
      cleanup = found.cleanup
    }
    const onArrive = () => map.once('idle', onIdle)
    map.once('moveend', onArrive)
    return () => {
      map.off('moveend', onArrive)
      map.off('idle', onIdle)
      cleanup?.()
      setShopBuilding(null)
      setAtShop(false)
    }
  }, [map, shopColor])
  const leaveShop = () => {
    setShop(null)
    onShop?.(null)
    map?.flyTo({ ...GEM_CAMERA, duration: SHOP_FLY_MS, essential: true })
  }

  // "a" at the mall: fly on to the casino, its building rises in gold
  const toCasino = casino && !!shop
  const [casinoBuilding, setCasinoBuilding] = useState<ClubBuilding | null>(null)
  const [atCasino, setAtCasino] = useState(false)
  useEffect(() => {
    if (!map || !toCasino) return
    const dark = document.documentElement.dataset.theme !== 'light'
    add3dBuildings(map, dark)
    map.flyTo({ ...CASINO_CAMERA, duration: SHOP_FLY_MS, essential: true })
    let cleanup: (() => void) | undefined
    const onIdle = () => {
      const found = highlightRising(map, CASINO.lngLat, 'casino-building', CASINO.color)
      setCasinoBuilding(found.building)
      setAtCasino(true)
      cleanup = found.cleanup
    }
    const onArrive = () => map.once('idle', onIdle)
    map.once('moveend', onArrive)
    return () => {
      map.off('moveend', onArrive)
      map.off('idle', onIdle)
      cleanup?.()
      setCasinoBuilding(null)
      setAtCasino(false)
    }
  }, [map, toCasino])
  const showRoute = route && toCasino && atCasino
  const leaveRoute = () => {
    onRoute?.(false)
    map?.flyTo({ ...CASINO_CAMERA, duration: SHOP_FLY_MS, essential: true })
  }
  const leaveCasino = () => {
    onCasino?.(false)
    map?.flyTo({ ...SHOP_CAMERA, duration: SHOP_FLY_MS, essential: true })
  }

  // Into a floor: dive at it. Out again: back across the street (unless we're off to the shops).
  const wasOnFloor = useRef(false)
  useEffect(() => {
    if (!map) return
    if (floor) map.flyTo({ ...FLOOR_CAMERA[floor], duration: FLOOR_DIVE_MS, essential: true })
    else if (wasOnFloor.current && !shop) map.flyTo({ ...GEM_CAMERA, duration: FLOOR_DIVE_MS, essential: true })
    wasOnFloor.current = !!floor
  }, [map, floor]) // eslint-disable-line react-hooks/exhaustive-deps

  const flown = useRef(false)

  // Fly once both the map and the answer are ready; the globe keeps spinning while the agent searches
  useEffect(() => {
    if (!loaded || !places || flown.current) return
    const timer = setTimeout(() => {
      flown.current = true
      const { map: m, stopSpin } = loaded
      stopSpin()
      const { clientWidth: w, clientHeight: h } = m.getContainer()
      const camera = places.length && !fixedCamera ? fit(places, w, h) : BASEL_CAMERA
      m.flyTo({ ...camera, bearing: 0, pitch: 0, duration: FLY_DURATION_MS, essential: true })
      // Registered after flyTo, so the interrupted spin animation's moveend doesn't count
      m.once('moveend', () => setMap(m))
    }, GLOBE_INTRO_MS)
    return () => clearTimeout(timer)
  }, [loaded, places])

  return (
    <div className={`pointer-events-auto relative mx-auto my-2 min-h-0 w-[92%] flex-1 sidebar-collapsed:fixed sidebar-collapsed:top-0 sidebar-collapsed:right-0 sidebar-collapsed:left-14 sidebar-collapsed:mt-0 sidebar-collapsed:h-screen sidebar-collapsed:w-auto ${floor ? '' : 'sidebar-collapsed:z-0'}`}>
      {/* Wrapper does the positioning: mapbox-gl.css forces `position: relative` on the map element itself.
          On a floor it breaks out to fill the screen behind the immersive view (Home drops its stacking context for this). */}
      <div
        className={`animate-globe-in transition-[filter] duration-1000 ${
          floor
            ? `fixed inset-0 z-30 bg-black ${FLOOR_MOOD[floor]}`
            : 'persona-fade absolute inset-0 sidebar-collapsed:rounded-none sidebar-collapsed:[mask-image:linear-gradient(to_bottom,#000_65%,transparent_95%)]'
        }`}
      >
        <Globe className="size-full" onLoad={(m, stopSpin) => setLoaded({ map: m, stopSpin })} />
      </div>

      {floor && onFloor &&
        createPortal(<ImmersiveFloor floor={floor} onFloor={onFloor} onClose={() => onFloor(null)} onWhereToGet={goShopping} />, document.body)}

      {map && places && !focused && <PlaceCards map={map} places={places} />}

      {map && club && !floor && !shop && <ClubFloorLabels map={map} building={club} floors={floorLabels} />}

      {arrivedAtGem && !shop && <ClubDetails />}

      {/* Cards wait for the camera to land, like the club's */}
      {map && shop && atShop && !floor && !toCasino && <ShopDetails key={`${shop.outfit}-${shop.color}`} map={map} building={shopBuilding} choice={shop} onBack={leaveShop} />}

      {map && toCasino && atCasino && !floor && !showRoute && <CasinoDetails map={map} building={casinoBuilding} onBack={leaveCasino} />}

      {map && showRoute && !floor && <RouteOverview map={map} onBack={leaveRoute} />}

      {searching !== null && (
        <span className="spatial-glass absolute top-3 right-3 flex max-w-[60%] animate-fade-in items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium sidebar-collapsed:top-16 sidebar-collapsed:right-4">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-clay/60" />
            <span className="size-2 rounded-full bg-clay" />
          </span>
          <span className="truncate">{searching ? `Searching for ${searching}` : 'Searching…'}</span>
        </span>
      )}

      {map && !showRoute && (
        <span className="absolute top-3 left-1/2 sidebar-collapsed:top-10 flex h-8 -translate-x-1/2 animate-fade-in items-center gap-1.5 rounded-full bg-surface/80 px-3 text-xs font-medium backdrop-blur">
          <MapPin size={14} className="text-clay" /> {toCasino ? `${CASINO.name} · Basel` : shop ? `${SHOP.name} · Basel` : arrivedAtGem ? `${GEM.name} · Basel` : 'Basel, Switzerland'}
        </span>
      )}
    </div>
  )
}
