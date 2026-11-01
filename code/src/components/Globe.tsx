import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const TOKEN = import.meta.env.VITE_MAPBOX_KEY as string | undefined

// Globe spin settings (same as TripTune)
const SECONDS_PER_REVOLUTION = 120
const MAX_SPIN_ZOOM = 5
const SLOW_SPIN_ZOOM = 3

// The real city at blue hour, like an atlas plate. Painted into the map's own layers rather than filtered over the canvas,
// so what's added on top keeps its colour: the mall in the crew's look, the casino in gold.
const ATLAS = { land: '#1d3040', park: '#223949', water: '#36566b', road: '#2f4557', mainRoad: '#425a6c', border: '#3f5566', text: '#93a5b5', halo: '#1d3040' }

function paintAtlas(map: mapboxgl.Map) {
  for (const layer of map.getStyle()?.layers ?? []) {
    const { id, type } = layer
    if (type === 'background') map.setPaintProperty(id, 'background-color', ATLAS.land)
    else if (type === 'fill') map.setPaintProperty(id, 'fill-color', /water/.test(id) ? ATLAS.water : /park|landuse|landcover|pitch|national/.test(id) ? ATLAS.park : ATLAS.land)
    else if (type === 'line') map.setPaintProperty(id, 'line-color', /water/.test(id) ? ATLAS.water : /motorway|trunk|primary/.test(id) ? ATLAS.mainRoad : /road|bridge|tunnel|street|path/.test(id) ? ATLAS.road : ATLAS.border)
    else if (type === 'symbol') {
      map.setPaintProperty(id, 'text-color', ATLAS.text)
      map.setPaintProperty(id, 'text-halo-color', ATLAS.halo)
    }
  }
}

/**
 * Spinning Mapbox globe. Calls onLoad once the map is ready, with a function that
 * stops the spin for good (call it before your own flyTo, or the spin fights it).
 */
export default function Globe({ className = '', controls = false, onLoad }: {
  className?: string
  controls?: boolean
  onLoad?: (map: mapboxgl.Map, stopSpin: () => void) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const onLoadRef = useRef(onLoad)
  onLoadRef.current = onLoad

  useEffect(() => {
    if (!container.current || !TOKEN) return
    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      projection: 'globe',
      zoom: 2,
      center: [0, 20],
      attributionControl: false,
    })
    if (controls) map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right')

    let userInteracting = false
    let spinStopped = false

    const spinGlobe = () => {
      const zoom = map.getZoom()
      if (spinStopped || userInteracting || zoom >= MAX_SPIN_ZOOM) return
      let distancePerSecond = 360 / SECONDS_PER_REVOLUTION
      if (zoom > SLOW_SPIN_ZOOM) {
        distancePerSecond *= (MAX_SPIN_ZOOM - zoom) / (MAX_SPIN_ZOOM - SLOW_SPIN_ZOOM)
      }
      const center = map.getCenter()
      center.lng -= distancePerSecond
      map.easeTo({ center, duration: 1000, easing: (n) => n })
    }

    const stop = () => (userInteracting = true)
    const resume = () => {
      userInteracting = false
      spinGlobe()
    }

    map.on('style.load', () => {
      paintAtlas(map)
      map.setFog({
        color: 'rgb(29, 48, 64)',
        'high-color': 'rgb(44, 66, 86)',
        'horizon-blend': 0.1,
        'space-color': 'rgb(17, 28, 39)',
        'star-intensity': 0.3,
      })
    })
    map.on('load', () => {
      spinGlobe()
      onLoadRef.current?.(map, () => (spinStopped = true))
    })
    map.on('mousedown', stop)
    map.on('dragstart', stop)
    map.on('mouseup', resume)
    map.on('dragend', resume)
    map.on('touchend', resume)
    map.on('moveend', spinGlobe)
    // Mapbox only follows window resizes, not its container's
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container.current)

    return () => {
      observer.disconnect()
      map.remove()
    }
  }, [controls])

  if (!TOKEN) {
    return (
      <div className={`flex items-center justify-center p-6 text-center text-muted ${className}`}>
        <p>
          Missing Mapbox token. Add <code className="mx-1 rounded bg-bubble px-1.5">VITE_MAPBOX_KEY=pk...</code> to
          <code className="mx-1 rounded bg-bubble px-1.5">.env</code> and restart the dev server.
        </p>
      </div>
    )
  }

  return <div ref={container} className={className} />
}
