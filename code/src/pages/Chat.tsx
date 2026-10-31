import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router'
import { ChevronDown, Share } from 'lucide-react'
import ChatInput from '../components/ChatInput'
import ChatMessage from '../components/ChatMessage'
import ClaudeLogo from '../components/ClaudeLogo'
import { findChat, type Message } from '../data'

const FAKE_REPLY: Message = {
  role: 'assistant',
  content: "Great question! This is a mock — in the post-internet, the answer would show up right here, interactive and ready to use.",
}

export default function Chat() {
  const { id } = useParams()
  const { state } = useLocation()
  const chat = findChat(id)
  // A message typed on the home screen starts a new chat
  const [messages, setMessages] = useState<Message[]>(
    chat?.messages ?? (state?.text ? [{ role: 'user', content: state.text }] : []),
  )
  const bottom = useRef<HTMLDivElement>(null)
  const waiting = messages.at(-1)?.role === 'user'

  const send = (text: string) => setMessages((m) => [...m, { role: 'user', content: text }])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
    if (!waiting) return
    const t = setTimeout(() => setMessages((m) => [...m, FAKE_REPLY]), 900)
    return () => clearTimeout(t)
  }, [messages])

  return (
    <main className="flex h-screen flex-1 flex-col">
      <header className="flex items-center justify-between px-4 py-2.5">
        <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium hover:bg-bubble">
          {chat?.title ?? 'New chat'} <ChevronDown size={14} className="text-muted" />
        </button>
        <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-bubble">
          <Share size={14} /> Share
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
          {messages.map((m, i) => <ChatMessage key={i} {...m} />)}
          {waiting && <div className="animate-pulse"><ClaudeLogo size={28} /></div>}
          {!waiting && messages.length > 0 && <ClaudeLogo size={28} />}
          <div ref={bottom} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-6 pb-2">
        <ChatInput onSend={send} placeholder="Reply to Claude..." />
        <p className="py-2 text-center text-xs text-muted">Claude can make mistakes. Please double-check responses.</p>
      </div>
    </main>
  )
}
