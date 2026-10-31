import type { ReactNode } from 'react'
import { Building2, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import type { Field, Floor } from '../../data/vendor'
import { LIGHTS, type Light } from './Venue'
import { PanelHead, Seg, Swatches, glass } from './ui'

const panel = `${glass} absolute top-16 bottom-4 z-10 flex w-[300px] flex-col overflow-hidden`
const row = 'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition'

const Section = ({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) => (
  <section>
    <p className="flex px-1 pb-1.5 text-xs font-semibold text-neutral-500">
      {title}
      <span className="ml-auto font-normal text-neutral-400">{detail}</span>
    </p>
    <div className="space-y-0.5">{children}</div>
  </section>
)

// ─── Left: what Acme read from the website, editable in place ────────────────

function FieldRow({ f, onChange, onConfirm }: { f: Field; onChange: (v: string) => void; onConfirm: () => void }) {
  const review = f.confidence < 70
  return (
    <div
      className={`rounded-2xl px-3 py-2 transition ${review ? 'bg-amber-100/60' : 'focus-within:bg-white/80 hover:bg-white/50'}`}
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="text-neutral-500">{f.label}</span>
        {review && (
          <button onClick={onConfirm} className="ml-auto font-medium text-acme hover:underline">
            Looks right
          </button>
        )}
      </div>
      <input
        value={f.value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Add ${f.label.toLowerCase()}`}
        aria-label={f.label}
        className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
      />
    </div>
  )
}

type ProfileProps = {
  url?: string
  profile: Field[]
  onField: (key: string, patch: Partial<Field>) => void
}

export function ProfilePanel({ url, profile, onField }: ProfileProps) {
  const name = profile[0].value
  const toReview = profile.filter((f) => f.confidence < 70).length

  return (
    <aside className={`${panel} left-4`}>
      <div className="flex items-center gap-3 border-b border-black/5 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-900 text-lg font-semibold text-white">
          {name[0]?.toUpperCase() ?? '?'}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{name || 'Your club'}</p>
          <p className="truncate text-xs text-neutral-500">{url ?? 'Set up by hand'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <Section title="Your club" detail={toReview ? `${toReview} to check` : undefined}>
          {profile.map((f) => (
            <FieldRow
              key={f.key}
              f={f}
              onChange={(value) => onField(f.key, { value, confidence: 100 })}
              onConfirm={() => onField(f.key, { confidence: 100 })}
            />
          ))}
        </Section>
      </div>
    </aside>
  )
}

// ─── Right: walk the building, floor by floor, room by room ──────────────────

type BuildingProps = {
  floors: Floor[]
  open: string | null
  room: number | null
  hover: string | null
  onHover: (id: string | null) => void
  onOpen: (id: string | null) => void
  onRoom: (index: number | null) => void
  onCapacity: (capacity: number) => void
  party: boolean
  onParty: (party: boolean) => void
  light: Light
  onLight: (light: Light) => void
}

export function BuildingPanel(p: BuildingProps) {
  const floor = p.floors.find((f) => f.id === p.open)
  const step = 'grid size-5 place-items-center rounded-full bg-black/[0.06] hover:bg-black/10'

  return (
    <aside className={`${panel} right-4`}>
      <div className="border-b border-black/5 p-4">
        {floor ? (
          <>
            <button onClick={() => p.onOpen(null)} className="-ml-1 flex items-center text-sm text-acme hover:underline">
              <ChevronLeft size={16} /> All floors
            </button>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-lg font-semibold tracking-tight">{floor.name}</span>
              <span className="flex items-center gap-1.5 text-sm">
                <button aria-label="Fewer guests" onClick={() => p.onCapacity(floor.capacity - 10)} className={step}>
                  <Minus size={11} />
                </button>
                <span className="tabular-nums">{floor.capacity} guests</span>
                <button aria-label="More guests" onClick={() => p.onCapacity(floor.capacity + 10)} className={step}>
                  <Plus size={11} />
                </button>
              </span>
            </div>
            <p className="text-xs text-neutral-500">{floor.music}</p>
          </>
        ) : (
          <>
            <PanelHead icon={Building2} title="Building" />
            <p className="mt-1 text-xs text-neutral-500">Hover a floor to look inside, click to open, right-click to go back.</p>
          </>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-3">
        {floor ? (
          <Section title="Rooms">
            {floor.rooms.map((r, i) => (
              <button
                key={r.name}
                onClick={() => p.onRoom(p.room === i ? null : i)}
                className={`${row} ${p.room === i ? 'bg-white shadow-sm ring-1 ring-black/5' : 'hover:bg-white/50'}`}
              >
                <span className="text-sm font-medium">{r.name}</span>
                <ChevronRight size={15} className="ml-auto text-neutral-400" />
              </button>
            ))}
          </Section>
        ) : (
          <Section title="Floors">
            {p.floors.map((f) => (
              <button
                key={f.id}
                onMouseEnter={() => p.onHover(f.id)}
                onMouseLeave={() => p.onHover(null)}
                onClick={() => p.onOpen(f.id)}
                className={`${row} ${p.hover === f.id ? 'bg-white shadow-sm ring-1 ring-black/5' : 'hover:bg-white/50'}`}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-black/[0.06] text-xs font-semibold text-neutral-600">
                  {f.level || 'G'}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{f.name}</span>
                  <span className="block text-xs text-neutral-500">
                    {f.music} · {f.capacity} guests
                  </span>
                </span>
                <ChevronRight size={15} className="ml-auto shrink-0 text-neutral-400" />
              </button>
            ))}
          </Section>
        )}

        <Section title="Lights">
          <div className="flex items-center justify-between px-3 py-1.5 text-sm">
            Mode
            <Seg
              options={[['house', 'House'], ['party', 'Party']]}
              value={p.party ? 'party' : 'house'}
              onChange={(v) => p.onParty(v === 'party')}
            />
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 text-sm">
            Color
            <Swatches colors={LIGHTS} value={p.light} onChange={p.onLight} />
          </div>
        </Section>
      </div>
    </aside>
  )
}
