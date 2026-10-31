import type { ReactNode } from 'react'
import { Disc3, Martini, Minus, Plus, Ruler, Shirt, Sofa, Zap, type LucideIcon } from 'lucide-react'
import type { Field, Space } from '../../data/vendor'
import { AREAS, FLOORS, LIGHTS, WALLS, type Area, type ClubConfig } from './Venue'
import { PanelHead, Seg, Swatches, glass } from './ui'

const panel = `${glass} absolute top-16 bottom-4 z-10 flex w-[300px] flex-col overflow-hidden`

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
  spaces: Space[]
  spaceId: string
  onSelect: (id: string) => void
  onCapacity: (capacity: number) => void
}

export function ProfilePanel({ url, profile, onField, spaces, spaceId, onSelect, onCapacity }: ProfileProps) {
  const name = profile[0].value
  const toReview = profile.filter((f) => f.confidence < 70).length
  const step = 'grid size-5 place-items-center rounded-full bg-black/[0.06] hover:bg-black/10'

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

      <div className="flex-1 space-y-5 overflow-y-auto p-3">
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

        <Section title="Floors">
          {spaces.map((s) => {
            const active = s.id === spaceId
            return (
              <div
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`cursor-pointer rounded-2xl px-3 py-2.5 transition ${active ? 'bg-white shadow-sm ring-1 ring-black/5' : 'hover:bg-white/50'}`}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{s.name}</span>
                  {active ? (
                    <span className="flex items-center gap-1.5">
                      <button aria-label="Fewer guests" onClick={() => onCapacity(s.capacity - 10)} className={step}>
                        <Minus size={11} />
                      </button>
                      <span className="tabular-nums">{s.capacity} guests</span>
                      <button aria-label="More guests" onClick={() => onCapacity(s.capacity + 10)} className={step}>
                        <Plus size={11} />
                      </button>
                    </span>
                  ) : (
                    <span className="text-neutral-500 tabular-nums">{s.capacity} guests</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">{s.music}</p>
              </div>
            )
          })}
        </Section>
      </div>
    </aside>
  )
}

// ─── Right: shape the floor ──────────────────────────────────────────────────

const ICONS: Record<Area, LucideIcon> = { bar: Martini, lounge: Sofa, coat: Shirt, ball: Disc3, lasers: Zap }
const WALL_SWATCHES = Object.fromEntries(
  Object.entries(WALLS).map(([k, { wall, accent }]) => [k, `linear-gradient(135deg, ${wall} 55%, ${accent} 55%)`]),
) as Record<ClubConfig['wall'], string>

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-center justify-between px-2 py-1.5 text-sm">
    {label}
    {children}
  </div>
)

/** iOS-style switch */
const Switch = ({ on }: { on: boolean }) => (
  <span className={`relative ml-auto h-[22px] w-9 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-black/15'}`}>
    <span
      className={`absolute top-0.5 left-0.5 size-[18px] rounded-full bg-white shadow transition-transform ${on ? 'translate-x-3.5' : ''}`}
    />
  </span>
)

type DesignProps = {
  config: ClubConfig
  onChange: (patch: Partial<ClubConfig>) => void
  plan: boolean
  onPlan: (plan: boolean) => void
  party: boolean
  onParty: (party: boolean) => void
}

export function DesignPanel({ config, onChange, plan, onPlan, party, onParty }: DesignProps) {
  const toggle = (a: Area) =>
    onChange({ areas: config.areas.includes(a) ? config.areas.filter((x) => x !== a) : [...config.areas, a] })

  return (
    <aside className={`${panel} right-4`}>
      <div className="border-b border-black/5 p-4">
        <div className="flex items-center justify-between">
          <PanelHead icon={Ruler} title="Floorplan" />
          <Seg options={[['3d', '3D'], ['plan', 'Top']]} value={plan ? 'plan' : '3d'} onChange={(v) => onPlan(v === 'plan')} />
        </div>
        <p className="mt-2 text-xs text-neutral-500">Drag the booth, bar and lounge to where they really are.</p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-3">
        <Section title="Areas">
          {(Object.keys(AREAS) as Area[]).map((a) => {
            const Icon = ICONS[a]
            const on = config.areas.includes(a)
            return (
              <button
                key={a}
                role="switch"
                aria-checked={on}
                onClick={() => toggle(a)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-white/50"
              >
                <Icon size={16} className="text-neutral-400" />
                {AREAS[a]}
                <Switch on={on} />
              </button>
            )
          })}
        </Section>

        <Section title="Look">
          <Row label="Walls">
            <Swatches colors={WALL_SWATCHES} value={config.wall} onChange={(wall) => onChange({ wall })} />
          </Row>
          <Row label="Floor">
            <Swatches colors={FLOORS} value={config.floor} onChange={(floor) => onChange({ floor })} />
          </Row>
        </Section>

        <Section title="Lights">
          <Row label="Mode">
            <Seg
              options={[['house', 'House'], ['party', 'Party']]}
              value={party ? 'party' : 'house'}
              onChange={(v) => onParty(v === 'party')}
            />
          </Row>
          <Row label="Color">
            <Swatches colors={LIGHTS} value={config.light} onChange={(light) => onChange({ light })} />
          </Row>
        </Section>
      </div>
    </aside>
  )
}
