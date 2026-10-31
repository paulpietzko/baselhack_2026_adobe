import { useMatch } from 'react-router'
import { ChevronDown, Moon, Share, Sun } from 'lucide-react'
import { findChat } from '../data'
import { useTheme } from '../hooks/useTheme'

export default function TopBar() {
  const chat = findChat(useMatch('/chat/:id')?.params.id)
  const { theme, toggle } = useTheme()

  return (
    <header className="flex items-center gap-2 px-4 py-2.5">
      {chat && (
        <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium hover:bg-bubble">
          {chat.title} <ChevronDown size={14} className="text-muted" />
        </button>
      )}
      <button
        onClick={toggle}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="ml-auto grid size-8 place-items-center rounded-lg text-muted hover:bg-bubble hover:text-ink"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-bubble">
        <Share size={14} /> Share
      </button>
    </header>
  )
}
