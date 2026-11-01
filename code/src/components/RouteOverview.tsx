import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { ArrowLeft, Footprints, MapPin, PartyPopper } from 'lucide-react'
import { CASINO } from '../data/casino'
import { SHOP } from '../data/shop'
import { BASEL_PLACES, HAFENLICHT_CLUB } from '../data/basel'

const club = BASEL_PLACES.find((p) => p.id === HAFENLICHT_CLUB.id)!

/** Tonight in order: change at the mall, try your luck, dance it off */
const STOPS = [
  { name: SHOP.name, time: '20:00', what: 'Change into costume', image: '/shopping_mall.jpg', color: '#e0566b', lngLat: SHOP.lngLat },
  { name: CASINO.name, time: '21:15', what: 'Try your luck · CHF 20 free play', image: CASINO.image, color: CASINO.color, lngLat: CASINO.lngLat },
  { name: club.name, time: '23:00', what: 'Dance it off till late', image: club.image ?? '', color: '#d97757', lngLat: club.lngLat },
]

const LINE = '#d97757'
const DRAW_MS = 2200

type Leg = { meters: number; minutes: number }

function meters([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const rad = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(a))
}

/** Walking route through the stops (Mapbox Directions); straight lines if that fails */
async function walkingRoute(signal: AbortSignal): Promise<{ coords: [number, number][]; legs: Leg[] }> {
  const straight = () => ({
    coords: STOPS.map((s) => s.lngLat),
    legs: STOPS.slice(1).map((s, i) => {
      const m = meters(STOPS[i].lngLat, s.lngLat) * 1.25
      return { meters: m, minutes: Math.round(m / 80) }
    }),
  })
  try {
    const path = STOPS.map((s) => s.lngLat.join(',')).join(';')
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/walking/${path}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`,
      { signal },
    )
    if (!res.ok) return straight()
    const route = (await res.json()).routes?.[0]
    if (!route) return straight()
    return {
      coords: route.geometry.coordinates,
      legs: route.legs.map((l: { distance: number; duration: number }) => ({ meters: l.distance, minutes: Math.round(l.duration / 60) })),
    }
  } catch {
    if (signal.aborted) throw new Error('aborted')
    return straight()
  }
}

/** Numbered pin on the map, kept in place as the camera moves */
function Pin({ map, stop, n, active, onHover }: { map: mapboxgl.Map; stop: (typeof STOPS)[number]; n: number; active: boolean; onHover: (on: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const place = () => {
      if (!ref.current) return
      const p = map.project(stop.lngLat)
      ref.current.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`
    }
    place()
    map.on('render', place)
    return () => {
      map.off('render', place)
    }
  }, [map, stop])

  return (
    // Outer div is positioned on the map, the inner one animates (both use transform)
    <div ref={ref} className="pointer-events-auto absolute top-0 left-0 z-10" onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}>
      <div className="relative flex animate-pill-in items-center" style={{ animationDelay: `${1400 + n * 600}ms` }}>
        <span
          className={`grid place-items-center rounded-full border-[3px] bg-[#232220] font-semibold text-white transition-all duration-300 ${active ? 'size-12 text-lg' : 'size-10 text-base'}`}
          style={{ borderColor: stop.color, boxShadow: active ? `0 0 22px ${stop.color}99` : '0 2px 10px rgb(0 0 0 / 0.5)' }}
        >
          {n}
        </span>
        <span className="absolute left-full ml-2 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-black shadow-lg">
          {stop.name}
        </span>
      </div>
    </div>
  )
}

/** "a" at the casino: zoom out to see the whole night, mall → casino → club, with a card rail like the place cards */
export default function RouteOverview({ map, onBack }: { map: mapboxgl.Map; onBack: () => void }) {
  const [legs, setLegs] = useState<Leg[] | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const [started, setStarted] = useState(false)

  const bannerRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)

  // Zoom out to fit all three stops, flat like a map, into the gap between the banner and the card rail
  useEffect(() => {
    const bounds = new mapboxgl.LngLatBounds()
    STOPS.forEach((s) => bounds.extend(s.lngLat))
    const box = map.getContainer().getBoundingClientRect()
    const bannerBottom = bannerRef.current?.getBoundingClientRect().bottom ?? box.top + 160
    // Top of the rail = top of its tallest (active) card
    const railTop = railRef.current?.getBoundingClientRect().top ?? box.bottom - 320
    const top = Math.max(0, bannerBottom - box.top) + 36
    // + room for a hovered card growing upwards
    const bottom = Math.max(0, box.bottom - railTop) + 36 + 32
    map.fitBounds(bounds, {
      padding: { top, bottom: Math.min(bottom, box.height - top - 120), left: 160, right: 240 },
      maxZoom: 15,
      pitch: 0,
      bearing: 0,
      duration: 2800,
      essential: true,
    })
  }, [map])

  // The walking line, drawing itself from the mall to the club
  useEffect(() => {
    const abort = new AbortController()
    let frame = 0
    walkingRoute(abort.signal)
      .then(({ coords, legs }) => {
        setLegs(legs)
        const data = (c: [number, number][]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: c } })
        if (!map.getSource('night-route')) map.addSource('night-route', { type: 'geojson', data: data(coords.slice(0, 1)) })
        if (!map.getLayer('night-route-casing'))
          map.addLayer({ id: 'night-route-casing', type: 'line', source: 'night-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1a1a1a', 'line-width': 9, 'line-opacity': 0.8 } })
        if (!map.getLayer('night-route'))
          map.addLayer({ id: 'night-route', type: 'line', source: 'night-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': LINE, 'line-width': 4, 'line-dasharray': [0.6, 1.6] } })
        // Start drawing once the camera has mostly zoomed out
        const start = performance.now() + 1400
        const tick = (now: number) => {
          const t = Math.max(0, Math.min(1, (now - start) / DRAW_MS))
          const k = 1 - (1 - t) ** 2
          const n = Math.max(2, Math.ceil(coords.length * k))
          ;(map.getSource('night-route') as mapboxgl.GeoJSONSource | undefined)?.setData(data(coords.slice(0, n)))
          if (t < 1) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
      })
      .catch(() => {})
    return () => {
      abort.abort()
      cancelAnimationFrame(frame)
      if (map.getLayer('night-route')) map.removeLayer('night-route')
      if (map.getLayer('night-route-casing')) map.removeLayer('night-route-casing')
      if (map.getSource('night-route')) map.removeSource('night-route')
    }
  }, [map])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onBack()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])


  return (
    <div className="pointer-events-none absolute inset-0 font-system">
      {STOPS.map((s, i) => (
        <Pin key={s.name} map={map} stop={s} n={i + 1} active={active === i} onHover={(on) => setActive(on ? i : null)} />
      ))}

      <button
        onClick={onBack}
        className="spatial-glass pointer-events-auto absolute top-3 left-3 flex animate-fade-in items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:text-clay sidebar-collapsed:top-10 sidebar-collapsed:left-6"
      >
        <ArrowLeft size={14} /> Back to {CASINO.name}
      </button>

      {/* The kick-off banner, until the crew says go */}
      <div ref={bannerRef} className="absolute top-3 left-1/2 flex -translate-x-1/2 justify-center sidebar-collapsed:top-14">
        {started ? (
          <span className="spatial-glass flex animate-pill-in items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap text-ink">
            <PartyPopper size={15} className="text-clay" /> Night started. First stop: {STOPS[0].name}, {STOPS[0].time}
          </span>
        ) : (
          <div className="spatial-glass pointer-events-auto flex animate-pill-in items-center gap-2.5 rounded-full py-1 pr-1 pl-3 text-sm whitespace-nowrap text-ink" style={{ animationDelay: '2600ms' }}>
            <span aria-hidden>🎃</span>
            <span className="font-medium">Dress up. Cash in. Dance it off.</span>
            <button
              onClick={() => setStarted(true)}
              className="rounded-full bg-clay px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-clay-dark"
            >
              Let's haunt
            </button>
          </div>
        )}
      </div>

      {/* Card rail: one per stop, the hovered one pops up (like the place cards) */}
      <div ref={railRef} className="absolute inset-x-0 bottom-28 flex items-end justify-center gap-8 px-4 sidebar-collapsed:bottom-32">
        {STOPS.map((s, i) => (
          <article
            key={s.name}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={`spatial-glass pointer-events-auto animate-card-in overflow-hidden rounded-[22px] text-ink transition-all duration-300 ${
              active === i ? 'w-[250px]' : 'w-[220px]'
            }`}
            style={{ animationDelay: `${1600 + i * 150}ms`, boxShadow: active === i ? `0 0 0 1.5px ${s.color}, 0 0 30px ${s.color}55` : undefined }}
          >
            <div className={`relative overflow-hidden transition-all duration-300 ${active === i ? 'h-24' : 'h-16'}`} style={{ background: s.color }}>
              {s.image && <img src={s.image} alt={s.name} className="absolute inset-0 size-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <span className="absolute top-2 left-2 grid size-6 place-items-center rounded-full border-2 bg-[#232220] text-xs font-semibold text-white" style={{ borderColor: s.color }}>
                {i + 1}
              </span>
              <span className="absolute top-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums backdrop-blur-md">
                Tonight · {s.time}
              </span>
            </div>
            <div className="px-3 pt-2 pb-2.5">
              <h3 className={`leading-tight font-semibold ${active === i ? 'font-serif text-lg' : 'text-[14px]'}`}>{s.name}</h3>
              <p className="text-[11.5px] text-muted">{s.what}</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-clay">
                {i === 0 ? (
                  <>
                    <MapPin size={12} /> Start here
                  </>
                ) : (
                  <>
                    <Footprints size={12} /> {legs?.[i - 1] ? `${legs[i - 1].minutes} min walk from stop ${i}` : 'On foot'}
                  </>
                )}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
