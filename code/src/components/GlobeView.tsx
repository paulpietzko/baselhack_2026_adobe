import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import Globe from './Globe'
import PlaceCards from './PlaceCards'
import type { Camera, Place } from '../data/basel'

// How long the globe spins before we fly to the destination
const GLOBE_INTRO_MS = 500
const ROUTE_DRAW_MS = 2400

function addRoute(map: mapboxgl.Map) {
  map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  const line = { 'line-cap': 'round', 'line-join': 'round' } as const
  map.addLayer({ id: 'route-glow', type: 'line', slot: 'top', source: 'route', layout: line, paint: { 'line-color': '#56e6b3', 'line-width': 18, 'line-blur': 12, 'line-opacity': 0.8, 'line-emissive-strength': 1 } })
  map.addLayer({ id: 'route-line', type: 'line', slot: 'top', source: 'route', layout: line, paint: { 'line-color': '#c9f7e4', 'line-width': 4, 'line-emissive-strength': 1 } })
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
export default function GlobeView({ camera, lightPreset, places, highlight, route, safeRight, onSelect }: {
  camera: Camera
  lightPreset: 'day' | 'night'
  safeRight?: number
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
        <Globe className="size-full" lightPreset={lightPreset} onLoad={handleLoad} />
      </div>
      {map && landed && places.length > 0 && <PlaceCards map={map} places={places} highlight={highlight} safeRight={safeRight} onSelect={onSelect} />}
    </div>
  )
}
