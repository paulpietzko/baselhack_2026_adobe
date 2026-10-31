import type { ReactNode } from 'react'
import { BadgeCheck, CalendarDays, ChevronRight, Layers, type LucideIcon, Music, Shirt } from 'lucide-react'
import Waveform from '../Waveform'
import { FLOORS, FLOOR_EXTRAS, HAFENLICHT, type FloorId } from '../../data/floors'
import { BUDGETS, COLORS, OUTFITS, VIBES, WEATHER, dressCheck, type ColorId, type Outfit, type OutfitId, type Vibe } from '../../data/costumes'

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

function Go({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-clay py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-clay-dark">
      {children} <ChevronRight size={17} />
    </button>
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
export default function FloorTiles({ floor, open, onToggle, onFloor, onCostumes }: {
  floor: FloorId
  open: TileId | null
  onToggle: (id: TileId) => void
  onFloor: (id: FloorId) => void
  onCostumes: () => void
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
        <Go onClick={onCostumes}>We need costumes</Go>
      </Peek>
      <Peek id="events" icon={CalendarDays} title="Tonight" headline={HAFENLICHT.tonight} {...p}>
        <p className="text-sm">Doors at 23:00. Coat check until 05:30.</p>
        <Source path="/program/halloween" />
      </Peek>
    </>
  )
}

export type OutfitChoice = { outfit: OutfitId | null; color: ColorId; budget: number | null; vibe: Vibe | null }

/** The costume picker that replaces the floor tiles (story branch: tonight/Tiles.tsx OutfitTiles) */
export function OutfitTiles({ floor, choice, onBudget, onVibe, onPick, onColor, onWhereToGet }: {
  floor: FloorId
  choice: OutfitChoice
  onBudget: (max: number | null) => void
  onVibe: (vibe: Vibe | null) => void
  onPick: (id: OutfitId) => void
  onColor: (id: ColorId) => void
  onWhereToGet: () => void
}) {
  const name = FLOORS.find((f) => f.id === floor)!.name
  const door = (o: Outfit) => dressCheck(o, HAFENLICHT.dress)
  const fits = (o: Outfit) => door(o).ok && (choice.budget === null || o.price <= choice.budget) && (!choice.vibe || o.vibe === choice.vibe)
  const pill = (active: boolean) => `rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${active ? 'bg-clay text-white' : 'bg-ink/[0.07] hover:bg-ink/[0.14]'}`
  return (
    <section className="spatial-glass animate-card-in shrink-0 rounded-[30px] p-5 text-ink">
      <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <Shirt size={18} className="text-clay" /> For tonight
        <span className="ml-auto truncate pl-2 text-[13px] font-normal text-muted">{HAFENLICHT.name}, {name}</span>
      </h3>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {BUDGETS.map((max) => (
          <button key={String(max)} onClick={() => onBudget(max)} className={pill(choice.budget === max)}>{max ? `Under ${max}` : 'Any price'}</button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {VIBES.map((v) => (
          <button key={v} onClick={() => onVibe(choice.vibe === v ? null : v)} className={pill(choice.vibe === v)}>{v}</button>
        ))}
        <span className="ml-auto text-[13px] text-muted">{WEATHER}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {OUTFITS.map((o) => (
          <div key={o.id} className={fits(o) ? '' : 'opacity-35'}>
            <Row active={choice.outfit === o.id} onClick={() => onPick(o.id)}>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-serif text-xl">{o.name}</span>
                  <span className="text-sm text-muted tabular-nums">CHF {o.price}</span>
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted">{door(o).ok ? o.onFloor[floor] : door(o).reason}</span>
              </span>
            </Row>
          </div>
        ))}
      </div>
      {choice.outfit && (
        <div className="animate-card-in">
          <div className="mt-3 flex gap-3 px-1">
            {COLORS.map((c) => (
              <button
                key={c.id}
                title={c.name}
                aria-label={c.name}
                onClick={() => onColor(c.id)}
                className={`size-9 rounded-full transition ${choice.color === c.id ? 'ring-2 ring-ink ring-offset-2 ring-offset-black/40' : 'opacity-70 hover:opacity-100'}`}
                style={{ background: c.hex }}
              />
            ))}
          </div>
          <Go onClick={onWhereToGet}>Where can we get it?</Go>
        </div>
      )}
    </section>
  )
}
