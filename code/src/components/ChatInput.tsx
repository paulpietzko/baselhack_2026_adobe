import { useEffect, useState } from 'react'
import { ArrowUp, Mic, Plus, SlidersHorizontal, X } from 'lucide-react'
import Waveform from './Waveform'

const iconBtn = 'grid size-8 place-items-center rounded-lg border border-border text-muted hover:bg-bubble'

// Mock speech recognition: silence first, then interim guesses in uneven chunks
// (including a misheard word), then the final transcript. [ms after start, text]
const MOCK_TRANSCRIPT = 'What can I do in Basel?'
const MOCK_INTERIM: [number, string][] = [
  [800, 'What can'],
  [1100, 'What can I do'],
  [1450, 'What can I do in bass'],
  [1800, 'What can I do in Basel'],
  [2100, MOCK_TRANSCRIPT],
]
const AUTO_SEND_MS = 2500

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function ChatInput({ onSend, placeholder = 'How can I help you today?' }: {
  onSend?: (text: string) => void
  placeholder?: string
}) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [seconds, setSeconds] = useState(0)

  const send = () => {
    if (!text.trim()) return
    onSend?.(text.trim())
    setText('')
    setListening(false)
  }

  const startListening = () => {
    setText('')
    setSeconds(0)
    setListening(true)
  }

  const cancel = () => {
    setText('')
    setListening(false)
  }

  useEffect(() => {
    if (!listening) return
    const clock = setInterval(() => setSeconds((s) => s + 1), 1000)
    const interim = MOCK_INTERIM.map(([ms, t]) => setTimeout(() => setText(t), ms))
    // Mock "sends automatically when you pause": the transcript finishes at ~2.1s
    const autoSend = setTimeout(() => {
      onSend?.(MOCK_TRANSCRIPT)
      setText('')
      setListening(false)
    }, AUTO_SEND_MS)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancel()
    window.addEventListener('keydown', onKey)
    return () => {
      clearInterval(clock)
      interim.forEach(clearTimeout)
      clearTimeout(autoSend)
      window.removeEventListener('keydown', onKey)
    }
  }, [listening])

  return (
    <div>
      <div
        className={`rounded-2xl border bg-surface p-3 shadow-[0_4px_20px_rgba(0,0,0,0.25)] ${
          listening ? 'border-clay ring-4 ring-clay/15' : 'border-border focus-within:border-border-strong'
        }`}
      >
        <textarea
          rows={2}
          value={text}
          readOnly={listening}
          placeholder={listening ? '' : placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          className={`w-full resize-none bg-transparent px-1 outline-none transition-colors duration-300 placeholder:text-muted ${
            listening && text !== MOCK_TRANSCRIPT ? 'text-muted' : ''
          }`}
        />

        {listening ? (
          <div className="flex items-center gap-3">
            <span className="relative grid size-3.5 place-items-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-clay/40" />
              <span className="size-2.5 rounded-full bg-clay ring-2 ring-clay/30" />
            </span>
            <span className="text-sm font-medium">Listening</span>
            <span className="text-sm text-muted tabular-nums">{formatTime(seconds)}</span>
            <Waveform className="ml-2 h-6" />
            <button aria-label="Cancel voice input" onClick={cancel} className={`ml-auto ${iconBtn} size-9`}>
              <X size={16} />
            </button>
            <button
              onClick={send}
              className="flex items-center gap-2 rounded-lg bg-clay px-4 py-2 text-sm font-medium text-bg hover:bg-clay-dark"
            >
              <span className="size-2.5 rounded-[2px] bg-bg" /> Send
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button className={iconBtn}><Plus size={16} /></button>
            <button className={iconBtn}><SlidersHorizontal size={15} /></button>
            <button
              aria-label="Voice input"
              onClick={startListening}
              className="ml-auto grid size-8 place-items-center rounded-lg text-muted hover:bg-bubble hover:text-ink"
            >
              <Mic size={17} />
            </button>
            <button
              onClick={send}
              disabled={!text.trim()}
              className="grid size-8 place-items-center rounded-lg bg-clay text-white hover:bg-clay-dark disabled:opacity-50"
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      {listening && (
        <p className="mt-3 flex items-center justify-center gap-3 text-xs text-muted">
          Speak naturally — sends automatically when you pause
          <span aria-hidden>•</span>
          <span>
            <kbd className="rounded border border-border px-1.5 py-0.5 font-sans text-ink">Esc</kbd> to cancel
          </span>
        </p>
      )}
    </div>
  )
}
