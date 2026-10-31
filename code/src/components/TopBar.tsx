import { Moon, Share, Sun } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export default function TopBar() {
  const { theme, toggle } = useTheme()

  return (
    <header className="relative z-20 flex items-center gap-2 px-4 py-2.5">
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
