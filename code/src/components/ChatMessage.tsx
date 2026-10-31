import { Copy, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { Message } from '../data'
import EmbedFrame from './EmbedFrame'

// Tiny markdown subset: paragraphs, "- " lists and **bold**
function Bold({ text }: { text: string }) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))
}

function Markdown({ text }: { text: string }) {
  return text.split('\n\n').map((block, i) => {
    const lines = block.split('\n')
    if (lines.every((l) => l.startsWith('- '))) {
      return (
        <ul key={i} className="list-disc space-y-1 pl-6">
          {lines.map((l, j) => <li key={j}><Bold text={l.slice(2)} /></li>)}
        </ul>
      )
    }
    return <p key={i} className="whitespace-pre-line"><Bold text={block} /></p>
  })
}

export default function ChatMessage({ role, content, embed }: Message) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-bubble px-4 py-2.5">{content}</div>
      </div>
    )
  }

  return (
    <div className="group">
      <div className="space-y-3 font-serif text-[17px] leading-relaxed">
        <Markdown text={content} />
      </div>
      {embed && <EmbedFrame {...embed} />}
      <div className="mt-2 flex gap-1 text-muted opacity-0 transition group-hover:opacity-100">
        {[Copy, ThumbsUp, ThumbsDown, RotateCcw].map((Icon, i) => (
          <button key={i} className="rounded-md p-1.5 hover:bg-bubble"><Icon size={15} /></button>
        ))}
      </div>
    </div>
  )
}
