import { useEffect, useState } from 'react'
import { ArrowUp, Keyboard, Mic, Plus, Presentation, SlidersHorizontal, X } from 'lucide-react'
import Waveform from './Waveform'
import { useSpeech } from '../hooks/useSpeech'

const iconBtn = 'grid size-8 place-items-center rounded-lg border border-border text-muted hover:bg-bubble'

// Presentation mock (no mic needed): silence first, then interim guesses in uneven chunks
// (including a misheard word), then the final transcript. [ms after start, text]
const MOCK_TRANSCRIPT = 'What can I do in Basel?'
const MOCK_INTERIM: [number, string][] = [
  [800, 'What can'],
  [1100, 'What can I do'],
  [1450, 'What can I do in bass'],
  [1800, 'What can I do in Basel'],
  [2100, MOCK_TRANSCRIPT],
]
const MOCK_AUTO_SEND_MS = 2500

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function ChatInput({
  onSend,
  placeholder = 'How can I help you today? I’d be absolutely delighted!',
  compact = false,
  voiceMode = false,
  onEndVoice,
}: {
  /** viaMock: sent by the presentation mock, so the conversation continues in the voice bar */
  onSend?: (text: string, viaMock?: boolean) => void
  placeholder?: string
  /** Start as a slim one-line pill that expands into the full box when clicked */
  compact?: boolean
  /** Presentation: show the voice bar ("Ask a follow-up…") instead of the pill */
  voiceMode?: boolean
  onEndVoice?: () => void
}) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [typing, setTyping] = useState(false)
  const [seconds, setSeconds] = useState(0)
  // Real speech-to-text: sends by itself when you pause
  const speech = useSpeech((heard) => onSend?.(heard))
  // Presentation mock: same UI as the real mic, scripted transcript
  const [mock, setMock] = useState(false)
  const [mockText, setMockText] = useState('')
  const listening = speech.listening || mock
  const heardText = mock ? mockText : speech.text
  const heardFinal = mock ? mockText === MOCK_TRANSCRIPT : speech.final

  const startMock = () => {
    setMockText('')
    setMock(true)
  }
  const cancel = () => (mock ? setMock(false) : speech.cancel())

  useEffect(() => {
    if (!mock) return
    const interim = MOCK_INTERIM.map(([ms, t]) => setTimeout(() => setMockText(t), ms))
    const autoSend = setTimeout(() => {
      setMock(false)
      onSend?.(MOCK_TRANSCRIPT, true)
    }, MOCK_AUTO_SEND_MS)
    return () => {
      interim.forEach(clearTimeout)
      clearTimeout(autoSend)
    }
  }, [mock]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    if (mock) {
      setMock(false)
      if (mockText) onSend?.(mockText, true)
      return
    }
    if (listening) return speech.stop() // sends what was heard
    if (!text.trim()) return
    onSend?.(text.trim())
    setText('')
  }

  useEffect(() => {
    if (!listening) return
    setSeconds(0)
    const clock = setInterval(() => setSeconds((s) => s + 1), 1000)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancel()
    window.addEventListener('keydown', onKey)
    return () => {
      clearInterval(clock)
      window.removeEventListener('keydown', onKey)
    }
  }, [listening, mock]) // eslint-disable-line react-hooks/exhaustive-deps

  if (voiceMode && !listening && !typing) {
    // Presentation voice bar: live waveform, slides in with animate-bar-in
    const barBtn = 'grid size-10 place-items-center rounded-xl border border-border text-muted hover:bg-hover hover:text-ink'
    return (
      <div className="flex justify-center">
        <div className="flex w-full max-w-md animate-bar-in items-center gap-3 rounded-2xl border border-border bg-surface/95 py-2 pr-2 pl-4 shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur">
          <Waveform stream={speech.stream} mock bars={10} className="h-5 shrink-0" />
          <input
            value={text}
            placeholder="Ask a follow-up..."
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <button
            aria-label="Type instead"
            onClick={() => {
              setTyping(true)
              setOpen(true)
            }}
            className={barBtn}
          >
            <Keyboard size={16} />
          </button>
          <button aria-label="Voice input" onClick={speech.start} disabled={!speech.supported} className={barBtn}>
            <Mic size={16} />
          </button>
          <button aria-label="Mock voice input (presentation)" title="Mock voice (presentation)" onClick={startMock} className={barBtn}>
            <Presentation size={16} />
          </button>
          <button
            onClick={() => {
              setText('')
              onEndVoice?.()
            }}
            className="h-10 rounded-xl bg-clay px-4 text-sm font-medium text-bg hover:bg-clay-dark"
          >
            End
          </button>
        </div>
      </div>
    )
  }

  const collapsed = compact && !open && !text && !listening

  return (
    <div className={`mx-auto w-full transition-[max-width] duration-300 ${collapsed ? 'max-w-md' : 'max-w-3xl'}`}>
      {collapsed ? (
        <div
          onClick={() => setOpen(true)}
          className="flex cursor-text items-center gap-1 rounded-full border border-border bg-surface py-1.5 pr-1.5 pl-4 shadow-[0_4px_20px_rgba(0,0,0,0.18)] hover:border-border-strong"
        >
          <span className="flex-1 truncate text-sm text-muted">{placeholder}</span>
          <button
            aria-label="Voice input"
            onClick={(e) => {
              e.stopPropagation()
              speech.start()
            }}
            disabled={!speech.supported}
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-bubble hover:text-ink disabled:opacity-40"
          >
            <Mic size={16} />
          </button>
          <button
            aria-label="Mock voice input (presentation)"
            title="Mock voice (presentation)"
            onClick={(e) => {
              e.stopPropagation()
              startMock()
            }}
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-bubble hover:text-ink"
          >
            <Presentation size={16} />
          </button>
          <span className="grid size-8 place-items-center rounded-full bg-clay text-white opacity-50">
            <ArrowUp size={15} strokeWidth={2.5} />
          </span>
        </div>
      ) : (
        <div
          // Leaving the box empty folds it back into the pill
          onBlur={(e) => compact && !text && !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}
          className={`rounded-2xl border bg-surface p-3 shadow-[0_4px_20px_rgba(0,0,0,0.25)] ${
            listening ? 'border-clay ring-4 ring-clay/15' : 'border-border focus-within:border-border-strong'
          }`}
        >
          <textarea
            rows={2}
            autoFocus={compact}
            value={listening ? heardText : text}
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
              listening && !heardFinal ? 'text-muted' : ''
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
              <Waveform stream={speech.stream} mock={mock} className="ml-2 h-6" />
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
                title={speech.supported ? 'Voice input' : 'Voice input needs Chrome, Edge or Safari'}
                onClick={speech.start}
                disabled={!speech.supported}
                className="ml-auto grid size-8 place-items-center rounded-lg text-muted hover:bg-bubble hover:text-ink disabled:opacity-40"
              >
                <Mic size={17} />
              </button>
              <button
                aria-label="Mock voice input (presentation)"
                title="Mock voice (presentation)"
                onClick={startMock}
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-bubble hover:text-ink"
              >
                <Presentation size={17} />
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
      )}

      {speech.error && !listening && <p className="mt-3 text-center text-xs text-clay">{speech.error}</p>}
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
