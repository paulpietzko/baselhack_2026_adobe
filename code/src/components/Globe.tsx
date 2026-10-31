import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const TOKEN = import.meta.env.VITE_MAPBOX_KEY as string | undefined

// Globe spin settings (same as TripTune)
const SECONDS_PER_REVOLUTION = 120
const MAX_SPIN_ZOOM = 5
const SLOW_SPIN_ZOOM = 3

/** Spinning Mapbox globe. Calls onLoad with the map once it's ready. */
export default function Globe({ className = '', controls = false, onLoad }: {
  className?: string
  controls?: boolean
  onLoad?: (map: mapboxgl.Map) => void
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

    const spinGlobe = () => {
      const zoom = map.getZoom()
      if (userInteracting || zoom >= MAX_SPIN_ZOOM) return
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
      map.setFog({
        color: 'rgb(10, 20, 30)',
        'high-color': 'rgb(20, 30, 50)',
        'horizon-blend': 0.1,
        'space-color': 'rgb(11, 11, 25)',
        'star-intensity': 0.6,
      })
    })
    map.on('load', () => {
      spinGlobe()
      onLoadRef.current?.(map)
    })
    map.on('mousedown', stop)
    map.on('dragstart', stop)
    map.on('mouseup', resume)
    map.on('dragend', resume)
    map.on('touchend', resume)
    map.on('moveend', spinGlobe)

    return () => map.remove()
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
