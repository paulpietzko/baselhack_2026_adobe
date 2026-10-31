import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { BookOpen, Code, Coffee, Lightbulb, PenLine } from 'lucide-react'
import ChatInput from '../components/ChatInput'
import ClaudeLogo from '../components/ClaudeLogo'
import Journey from '../components/tonight/Journey'

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

  // Whatever the crew asks first, Claude answers with the world instead of a page
  if (query) return <Journey key={key} first={query} />

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
