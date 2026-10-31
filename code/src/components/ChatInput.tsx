import { useState } from 'react'
import { ArrowUp, ChevronDown, Plus, SlidersHorizontal } from 'lucide-react'

const iconBtn = 'grid size-8 place-items-center rounded-lg border border-border text-muted hover:bg-bubble'

export default function ChatInput({ onSend, placeholder = 'How can I help you today?' }: {
  onSend?: (text: string) => void
  placeholder?: string
}) {
  const [text, setText] = useState('')

  const send = () => {
    if (!text.trim()) return
    onSend?.(text.trim())
    setText('')
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-3 shadow-[0_4px_20px_rgba(0,0,0,0.04)] focus-within:border-[#d5d2c6]">
      <textarea
        rows={2}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            send()
          }
        }}
        className="w-full resize-none bg-transparent px-1 outline-none placeholder:text-muted"
      />
      <div className="flex items-center gap-2">
        <button className={iconBtn}><Plus size={16} /></button>
        <button className={iconBtn}><SlidersHorizontal size={15} /></button>
        <button className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted hover:bg-bubble">
          Opus 5.5 <ChevronDown size={14} />
        </button>
        <button
          onClick={send}
          disabled={!text.trim()}
          className="grid size-8 place-items-center rounded-lg bg-clay text-white hover:bg-clay-dark disabled:opacity-50"
        >
          <ArrowUp size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
