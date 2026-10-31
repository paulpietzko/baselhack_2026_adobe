import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const TOKEN = import.meta.env.VITE_MAPBOX_KEY as string | undefined

// Globe spin settings (same as TripTune)
const SECONDS_PER_REVOLUTION = 120
const MAX_SPIN_ZOOM = 5
const SLOW_SPIN_ZOOM = 3
const DUSK_MS = 1100

/**
 * Spinning Mapbox globe. Calls onLoad once the map is ready, with a function that
 * stops the spin for good (call it before your own flyTo, or the spin fights it).
 */
export default function Globe({ className = '', controls = false, lightPreset, onLoad }: {
  className?: string
  controls?: boolean
  /** Use Mapbox's 3D city with this time of day, instead of the flat style that follows the theme */
  lightPreset?: 'day' | 'night'
  onLoad?: (map: mapboxgl.Map, stopSpin: () => void) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const onLoadRef = useRef(onLoad)
  onLoadRef.current = onLoad
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const city = useRef(lightPreset)

  useEffect(() => {
    if (!container.current || !TOKEN) return
    mapboxgl.accessToken = TOKEN
    // The flat styles, for anything not using the 3D city
    const dark = document.documentElement.dataset.theme !== 'light'

    const map = new mapboxgl.Map({
      container: container.current,
      style: city.current ? 'mapbox://styles/mapbox/standard' : dark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
      ...(city.current && { config: { basemap: { lightPreset: city.current === 'day' ? 'dusk' : 'night', showPointOfInterestLabels: false, showTransitLabels: false } } }),
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

    mapRef.current = map
    map.on('style.load', () => {
      if (city.current) return
      map.setFog(
        dark
          ? {
              color: 'rgb(10, 20, 30)',
              'high-color': 'rgb(20, 30, 50)',
              'horizon-blend': 0.1,
              'space-color': 'rgb(11, 11, 25)',
              'star-intensity': 0.6,
            }
          : {
              color: 'rgb(245, 244, 237)',
              'high-color': 'rgb(200, 215, 235)',
              'horizon-blend': 0.1,
              'space-color': 'rgb(250, 249, 245)',
              'star-intensity': 0,
            },
      )
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
    // Mapbox only follows window resizes; the container also changes when the sidebar toggles
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container.current)

    return () => {
      observer.disconnect()
      map.remove()
    }
  }, [controls])

  // Night falls from dusk, so the city visibly changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !lightPreset || !map.isStyleLoaded() || lightPreset === city.current) return
    city.current = lightPreset
    if (lightPreset === 'day') return void map.setConfigProperty('basemap', 'lightPreset', 'dusk')
    map.setConfigProperty('basemap', 'lightPreset', 'dusk')
    const t = setTimeout(() => map.setConfigProperty('basemap', 'lightPreset', 'night'), DUSK_MS)
    return () => clearTimeout(t)
  }, [lightPreset])

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
