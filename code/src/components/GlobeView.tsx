import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import Globe from './Globe'
import PlaceCards from './PlaceCards'
import type { Camera, Place } from '../data/basel'

// How long the globe spins before we fly to the destination
const GLOBE_INTRO_MS = 500
const ROUTE_DRAW_MS = 2400

/** The city's own buildings rise up when the camera tilts in, so the 3D venue stands in a 3D city */
function addBuildings(map: mapboxgl.Map) {
  const dark = document.documentElement.dataset.theme !== 'light'
  const labels = map.getStyle()?.layers?.find((l) => l.type === 'symbol' && l.layout?.['text-field'])?.id
  map.addLayer(
    {
      id: 'buildings-3d',
      source: 'composite',
      'source-layer': 'building',
      filter: ['==', 'extrude', 'true'],
      type: 'fill-extrusion',
      minzoom: 13,
      paint: {
        'fill-extrusion-color': dark ? '#2b2a33' : '#dedbd2',
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'min_height'],
        'fill-extrusion-opacity': 0.85,
      },
    },
    labels,
  )
}

function addRoute(map: mapboxgl.Map) {
  map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  const line = { 'line-cap': 'round', 'line-join': 'round' } as const
  map.addLayer({ id: 'route-glow', type: 'line', source: 'route', layout: line, paint: { 'line-color': '#d97757', 'line-width': 12, 'line-blur': 8, 'line-opacity': 0.6 } })
  map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: line, paint: { 'line-color': '#ffb394', 'line-width': 3 } })
}

/** The first `k` (0–1) of a path, by length */
function along(path: [number, number][], k: number) {
  const lengths = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]))
  let left = lengths.reduce((a, b) => a + b, 0) * k
  const out = [path[0]]
  for (let i = 0; i < lengths.length; i++) {
    if (left >= lengths[i]) {
      out.push(path[i + 1])
      left -= lengths[i]
      continue
    }
    const t = left / lengths[i]
    out.push([path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t])
    break
  }
  return out
}

/**
 * The real city behind the whole journey: spins, then keeps flying wherever the conversation goes,
 * showing place cards when it lands and drawing the route between stops.
 */
export default function GlobeView({ camera, places, highlight, route, onSelect }: {
  camera: Camera
  places: Place[]
  highlight?: string
  route?: [number, number][] | null
  onSelect?: (place: Place) => void
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [map, setMap] = useState<mapboxgl.Map | null>(null)
  const [landed, setLanded] = useState(false)

  useEffect(() => () => clearTimeout(timer.current), [])

  const handleLoad = (m: mapboxgl.Map, stopSpin: () => void) => {
    timer.current = setTimeout(() => {
      stopSpin()
      addBuildings(m)
      addRoute(m)
      setMap(m)
    }, GLOBE_INTRO_MS)
  }

  useEffect(() => {
    if (!map) return
    setLanded(false)
    map.flyTo({ ...camera, essential: true })
    const t = setTimeout(() => setLanded(true), camera.duration)
    return () => clearTimeout(t)
  }, [map, camera])

  useEffect(() => {
    const source = map?.getSource('route') as mapboxgl.GeoJSONSource | undefined
    if (!source) return
    const draw = (coordinates: number[][]) =>
      void source.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })
    if (!route) return draw([])
    const start = performance.now()
    let raf = 0
    const tick = () => {
      const k = Math.min((performance.now() - start) / ROUTE_DRAW_MS, 1)
      draw(along(route, k))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [map, route])

  return (
    <div className="absolute inset-0">
      {/* Wrapper does the positioning: mapbox-gl.css forces `position: relative` on the map element itself */}
      <div className="absolute inset-0 animate-globe-in">
        <Globe className="size-full" onLoad={handleLoad} />
      </div>
      {map && landed && places.length > 0 && <PlaceCards map={map} places={places} highlight={highlight} onSelect={onSelect} />}
    </div>
  )
}
