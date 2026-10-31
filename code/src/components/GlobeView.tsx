import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { ChevronLeft, Keyboard, MapPin, Mic } from 'lucide-react'
import Globe from './Globe'
import PlaceCards from './PlaceCards'
import Waveform from './Waveform'
import ClaudeLogo from './ClaudeLogo'
import { BASEL_CAMERA, BASEL_PLACES, BASEL_TITLE } from '../data/basel'

// How long the globe spins before we fly to the destination
const GLOBE_INTRO_MS = 500
const FLY_DURATION_MS = 2500

const iconBtn = 'grid size-10 place-items-center rounded-xl border border-border text-muted hover:bg-hover hover:text-ink'

/** Full-screen globe shown after the user asks a question: spins, flies to Basel, shows places. */
export default function GlobeView({ onClose }: { onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [map, setMap] = useState<mapboxgl.Map | null>(null)
  const [arrived, setArrived] = useState(false)

  useEffect(() => () => clearTimeout(timer.current), [])

  const handleLoad = (m: mapboxgl.Map, stopSpin: () => void) => {
    timer.current = setTimeout(() => {
      stopSpin()
      // Fixed end view (see BASEL_CAMERA); flat map (no pitch/bearing) for now
      m.flyTo({ ...BASEL_CAMERA, bearing: 0, pitch: 0, duration: FLY_DURATION_MS, essential: true })
      // Registered after flyTo, so the interrupted spin animation's moveend doesn't count
      m.once('moveend', () => {
        setMap(m)
        setArrived(true)
      })
    }, GLOBE_INTRO_MS)
  }

  return (
    <div className="fixed inset-0 z-40 bg-[rgb(11,11,25)]">
      {/* Wrapper does the positioning: mapbox-gl.css forces `position: relative` on the map element itself */}
      <div className="absolute inset-0 animate-globe-in">
        <Globe className="size-full" onLoad={handleLoad} />
      </div>

      {arrived && map && <PlaceCards map={map} places={BASEL_PLACES} />}

      <div className="absolute top-4 left-4 flex gap-2">
        <button
          onClick={onClose}
          aria-label="Back to chat"
          className="grid size-11 animate-fade-in place-items-center rounded-xl border border-border bg-surface/90 text-ink backdrop-blur hover:bg-hover"
        >
          <ChevronLeft size={18} />
        </button>
        {arrived && (
          <span className="flex h-11 animate-fade-in items-center gap-2 rounded-xl border border-border bg-surface/90 px-4 text-sm font-medium backdrop-blur">
            <MapPin size={16} className="text-clay" /> Basel, Switzerland
          </span>
        )}
      </div>

      {arrived && (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4">
          <h2 className="flex h-9 animate-fade-in items-center gap-2 rounded-full border border-border bg-surface/90 px-4 font-serif text-sm backdrop-blur">
            <ClaudeLogo size={14} /> {BASEL_TITLE}
          </h2>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-5 flex justify-center px-4">
        <div className="flex w-full max-w-md animate-bar-in items-center gap-3 rounded-2xl border border-border bg-surface/95 py-2 pr-2 pl-4 shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur">
          <Waveform bars={10} className="h-5 shrink-0" />
          <input
            ref={input}
            placeholder="Ask a follow-up..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <button aria-label="Type instead" onClick={() => input.current?.focus()} className={iconBtn}>
            <Keyboard size={16} />
          </button>
          <button aria-label="Voice input" className={iconBtn}>
            <Mic size={16} />
          </button>
          <button
            onClick={onClose}
            className="h-10 rounded-xl bg-clay px-4 text-sm font-medium text-bg hover:bg-clay-dark"
          >
            End
          </button>
        </div>
      </div>
    </div>
  )
}
