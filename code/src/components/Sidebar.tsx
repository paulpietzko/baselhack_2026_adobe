import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ChevronsUpDown, FolderClosed, Layers, MessagesSquare, PanelLeft, Plus } from 'lucide-react'
import { chats, user } from '../data'

const NAV = [
  { icon: MessagesSquare, label: 'Chats' },
  { icon: FolderClosed, label: 'Projects' },
  { icon: Layers, label: 'Artifacts' },
]

// Every row starts with the same 32px icon slot at the same spot, so icons stay put when the sidebar toggles
const row = 'flex items-center gap-2 rounded-lg px-1 py-0.5 text-sm hover:bg-hover'
const slot = 'grid size-8 shrink-0 place-items-center'

export default function Sidebar() {
  // Remembered per browser, like the theme (see hooks/useTheme.ts)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar') === 'collapsed'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('sidebar', collapsed ? 'collapsed' : 'open')
    } catch {}
  }, [collapsed])
  // Immersive views ask for the whole screen; the toggle still brings the sidebar back
  useEffect(() => {
    const collapse = () => setCollapsed(true)
    window.addEventListener('sidebar:collapse', collapse)
    return () => window.removeEventListener('sidebar:collapse', collapse)
  }, [])
  const open = !collapsed

  return (
    <aside
      data-sidebar={collapsed ? 'collapsed' : 'open'}
      className={`flex h-screen shrink-0 flex-col border-r border-border bg-sidebar ${collapsed ? 'w-14' : 'w-72'}`}
    >
      <div className="flex h-14 items-center px-3">
        {open && (
          <Link to="/" className="pl-1 font-serif text-xl font-medium tracking-tight">
            Claude
          </Link>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`${slot} rounded-lg text-muted hover:bg-hover hover:text-ink ${open ? 'ml-auto' : ''}`}
        >
          <PanelLeft size={18} />
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        <Link to="/" aria-label="New chat" title="New chat" className={`${row} font-medium text-clay-dark`}>
          <span className={slot}>
            <span className="grid size-6 place-items-center rounded-full bg-clay text-white">
              <Plus size={14} strokeWidth={3} />
            </span>
          </span>
          {open && 'New chat'}
        </Link>
        {NAV.map(({ icon: Icon, label }) => (
          <span key={label} aria-label={label} title={label} className={row}>
            <span className={`${slot} text-muted`}>
              <Icon size={18} />
            </span>
            {open && label}
          </span>
        ))}
      </nav>

      {open ? (
        <>
          <p className="px-5 pt-5 pb-2 text-xs text-muted">Recents</p>
          <div className="flex-1 overflow-y-auto px-2">
            {chats.map((c) => (
              <div key={c.id} className="truncate rounded-lg px-3 py-1.5 text-sm hover:bg-hover">
                {c.title}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1" />
      )}

      <div className={`flex h-14 items-center gap-3 border-t px-3 ${open ? 'border-border' : 'border-transparent'}`}>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-bg">
          {user.initials}
        </span>
        {open && (
          <>
            <div className="flex-1 leading-tight">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted">{user.plan}</p>
            </div>
            <ChevronsUpDown size={16} className="text-muted" />
          </>
        )}
      </div>
    </aside>
  )
}
