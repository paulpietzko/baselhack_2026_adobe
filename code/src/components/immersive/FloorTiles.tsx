import type { ReactNode } from 'react'
import { BadgeCheck, CalendarDays, ChevronRight, Layers, type LucideIcon, Music, Shirt } from 'lucide-react'
import Waveform from '../Waveform'
import { FLOORS, FLOOR_EXTRAS, HAFENLICHT, type FloorId } from '../../data/floors'

export const TILES_WIDTH = 400

export type TileId = 'music' | 'floors' | 'dress' | 'events'

function Row({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${active ? 'bg-clay/25 ring-1 ring-clay' : 'bg-ink/[0.06] hover:bg-ink/[0.12]'}`}
    >
      {children}
    </button>
  )
}

/** Where a fact came from: the owner's record, not the model */
function Source({ path }: { path: string }) {
  return (
    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
      <BadgeCheck size={14} className="shrink-0 text-emerald-400" />
      Published by {HAFENLICHT.name} from {path}, 20:00
    </p>
  )
}

/** A tile that shows its headline, and opens in place when you're curious */
function Peek({ id, icon: Icon, title, headline, open, onToggle, children }: {
  id: TileId
  icon: LucideIcon
  title: string
  headline: string
  open: TileId | null
  onToggle: (id: TileId) => void
  children: ReactNode
}) {
  const isOpen = open === id
  return (
    <section className={`spatial-glass animate-card-in shrink-0 rounded-[28px] text-ink transition-shadow ${isOpen ? 'ring-1 ring-clay' : ''}`}>
      <button onClick={() => onToggle(id)} aria-expanded={isOpen} className="flex w-full items-center gap-4 p-4 text-left">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-clay/20"><Icon size={21} className="text-clay" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-muted">{title}</span>
          <span className="block font-serif text-[21px] leading-tight">{headline}</span>
        </span>
        <ChevronRight size={18} className={`shrink-0 text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && <div className="animate-card-in px-4 pb-4">{children}</div>}
    </section>
  )
}

/** Right-hand tiles of the immersive floor view (story branch: tonight/Tiles.tsx VenueTiles) */
export default function FloorTiles({ floor, open, onToggle, onFloor }: {
  floor: FloorId
  open: TileId | null
  onToggle: (id: TileId) => void
  onFloor: (id: FloorId) => void
}) {
  const extra = FLOOR_EXTRAS[floor]
  const p = { open, onToggle }
  return (
    <>
      <Peek id="music" icon={Music} title="Music" headline={extra.dj} {...p}>
        <div className="flex items-center gap-3">
          <Waveform stream={null} mock bars={30} className="h-9 flex-1" />
          <span className="text-[13px] text-muted tabular-nums">{extra.bpm} BPM</span>
        </div>
        <p className="mt-2 text-sm text-muted">Curated preview, generated for this demo.</p>
      </Peek>
      <Peek id="floors" icon={Layers} title="Floors" headline={`${FLOORS.length} floors`} {...p}>
        <div className="flex flex-col gap-1.5">
          {FLOORS.map((f) => (
            <Row key={f.id} active={floor === f.id} onClick={() => onFloor(f.id)}>
              <span className="flex-1 text-base font-medium">{f.name}</span>
              <span className="text-[13px] text-muted">{f.music} · {f.capacity}</span>
            </Row>
          ))}
        </div>
        <Source path="/floors" />
      </Peek>
      <Peek id="dress" icon={Shirt} title="Dress code" headline={HAFENLICHT.dress} {...p}>
        <p className="text-sm">Tonight is masked. {HAFENLICHT.age}.</p>
        <Source path="/house-rules" />
      </Peek>
      <Peek id="events" icon={CalendarDays} title="Tonight" headline={HAFENLICHT.tonight} {...p}>
        <p className="text-sm">Doors at 23:00. Coat check until 05:30.</p>
        <Source path="/program/halloween" />
      </Peek>
    </>
  )
}
