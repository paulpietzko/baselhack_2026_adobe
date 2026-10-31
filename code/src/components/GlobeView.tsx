import { useRef } from 'react'
import { ChevronLeft, Keyboard, Mic } from 'lucide-react'
import Globe from './Globe'
import Waveform from './Waveform'

// How long the globe spins before we zoom to the destination (zoom not implemented yet)
export const GLOBE_INTRO_MS = 1500

const iconBtn = 'grid size-10 place-items-center rounded-xl border border-border text-muted hover:bg-hover hover:text-ink'

/** Full-screen globe shown after the user asks a question, with a compact voice bar. */
export default function GlobeView({ onClose }: { onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <div className="fixed inset-0 z-40 bg-[rgb(11,11,25)]">
      {/* Wrapper does the positioning: mapbox-gl.css forces `position: relative` on the map element itself */}
      <div className="absolute inset-0 animate-globe-in">
        <Globe className="size-full" />
      </div>

      <button
        onClick={onClose}
        aria-label="Back to chat"
        className="absolute top-4 left-4 grid size-11 animate-fade-in place-items-center rounded-xl border border-border bg-surface/90 text-ink backdrop-blur hover:bg-hover"
      >
        <ChevronLeft size={18} />
      </button>

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
