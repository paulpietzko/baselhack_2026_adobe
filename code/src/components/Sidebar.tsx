import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronsUpDown, FolderClosed, Layers, MessagesSquare, PanelLeft, Plus } from 'lucide-react'
import { chats, user } from '../data'

const NAV = [
  { icon: MessagesSquare, label: 'Chats' },
  { icon: FolderClosed, label: 'Projects' },
  { icon: Layers, label: 'Artifacts' },
]

const item = 'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm hover:bg-hover'
const iconBtn = 'grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-ink'

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const toggle = (
    <button
      onClick={() => setCollapsed((c) => !c)}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className={iconBtn}
    >
      <PanelLeft size={18} />
    </button>
  )

  if (collapsed) {
    return (
      <aside className="flex h-screen w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-sidebar py-3">
        {toggle}
        <Link
          to="/"
          aria-label="New chat"
          className="mt-2 grid size-8 place-items-center rounded-full bg-clay text-white"
        >
          <Plus size={16} strokeWidth={3} />
        </Link>
        {NAV.map(({ icon: Icon, label }) => (
          <span key={label} aria-label={label} title={label} className={iconBtn}>
            <Icon size={18} />
          </span>
        ))}
        <span className="mt-auto grid size-8 place-items-center rounded-full bg-ink text-xs font-semibold text-bg">
          {user.initials}
        </span>
      </aside>
    )
  }

  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex items-center justify-between px-4 py-3">
        <Link to="/" className="font-serif text-xl font-medium tracking-tight">
          Claude
        </Link>
        {toggle}
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        <Link to="/" className={`${item} font-medium text-clay-dark`}>
          <span className="grid size-6 place-items-center rounded-full bg-clay text-white">
            <Plus size={14} strokeWidth={3} />
          </span>
          New chat
        </Link>
        {NAV.map(({ icon: Icon, label }) => (
          <span key={label} className={item}>
            <Icon size={18} className="ml-0.5 text-muted" />
            {label}
          </span>
        ))}
      </nav>

      <p className="px-5 pt-5 pb-2 text-xs text-muted">Recents</p>
      <div className="flex-1 overflow-y-auto px-2">
        {chats.map((c) => (
          <div key={c.id} className={`${item} truncate`}>
            <span className="truncate">{c.title}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-border px-3 py-3">
        <span className="grid size-8 place-items-center rounded-full bg-ink text-xs font-semibold text-bg">
          {user.initials}
        </span>
        <div className="flex-1 leading-tight">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted">{user.plan}</p>
        </div>
        <ChevronsUpDown size={16} className="text-muted" />
      </div>
    </aside>
  )
}
