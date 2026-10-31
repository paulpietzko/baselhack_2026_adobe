import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { BookOpen, Code, Coffee, Lightbulb, PenLine } from 'lucide-react'
import ChatInput from '../components/ChatInput'
import ClaudeLogo from '../components/ClaudeLogo'
import GlobeView from '../components/GlobeView'
import { BASEL_TITLE } from '../data/basel'

const SUGGESTIONS = [
  { icon: PenLine, label: 'Write' },
  { icon: BookOpen, label: 'Learn' },
  { icon: Code, label: 'Code' },
  { icon: Coffee, label: 'Life stuff' },
  { icon: Lightbulb, label: "Claude's choice" },
]

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Home() {
  const [query, setQuery] = useState<string | null>(null)
  // "New chat" navigates to / again: start over
  const { key } = useLocation()
  useEffect(() => setQuery(null), [key])

  // Mock answer: whatever was asked, Claude replies with the Basel globe right in the chat
  if (query) {
    return (
      <main className="flex min-h-0 flex-1 flex-col">
        {/* With the sidebar collapsed the map sits behind this layer, so only the messages take clicks */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto sidebar-collapsed:pointer-events-none">
          {/* Fullscreen map: the map is the answer, so the messages step aside */}
          <div className="pointer-events-auto relative z-10 mx-auto w-full max-w-3xl px-6 pt-8 sidebar-collapsed:hidden">
            <p className="ml-auto w-fit max-w-[80%] rounded-2xl bg-bubble px-4 py-2.5">{query}</p>
            <p className="mt-6 flex w-fit items-center gap-2 rounded-full font-serif text-lg sidebar-collapsed:bg-bg/80 sidebar-collapsed:px-3 sidebar-collapsed:py-1 sidebar-collapsed:backdrop-blur">
              <ClaudeLogo size={20} /> {BASEL_TITLE}
            </p>
          </div>
          <GlobeView key={query} />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-4">
          <ChatInput onSend={setQuery} placeholder="Reply to Claude…" />
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24">
      <h1 className="mb-8 flex items-center gap-3 font-serif text-4xl font-normal">
        <ClaudeLogo size={36} />
        {greeting()}, John Doe
      </h1>
      <div className="w-full max-w-2xl">
        <ChatInput onSend={setQuery} />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map(({ icon: Icon, label }) => (
            <button
              key={label}
              className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-muted hover:bg-bubble hover:text-ink"
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
