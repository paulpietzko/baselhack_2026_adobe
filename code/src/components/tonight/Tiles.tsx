import { useState, type ReactNode } from 'react'
import { BadgeCheck, CalendarDays, Car, Check, ChevronRight, DoorOpen, Layers, type LucideIcon, MapPin, Music, Shirt, Store } from 'lucide-react'
import Waveform from '../Waveform'
import { vendor } from '../../data/vendor'
import { BUDGETS, CASINO, CLUB, COLORS, FLOOR_EXTRAS, OUTFITS, PEOPLE, VIBES, WEATHER, articlesFor, floorById, outfitById, shopById, type FloorId } from '../../data/tonight'
import { dressCheck } from '../../../engine/world.ts'
import { checkAvailability } from '../../lib/presence'
import { perPerson, unitPrice, type Intent, type Journey, type TileId } from '../../lib/journey'

/** Room the tiles take up on the right; the world and the map keep clear of it */
export const TILES_WIDTH = 400

type TilesProps = { j: Journey; act: (intent: Intent) => void }

function Tile({ icon: Icon, title, hint, delay = 0, children }: { icon: LucideIcon; title: string; hint?: string; delay?: number; children: ReactNode }) {
  return (
    <section className="spatial-glass animate-card-in shrink-0 rounded-[30px] p-5 text-ink" style={{ animationDelay: `${delay}ms` }}>
      <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <Icon size={18} className="text-clay" /> {title}
        {hint && <span className="ml-auto truncate pl-2 text-[13px] font-normal text-muted">{hint}</span>}
      </h3>
      {children}
    </section>
  )
}

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

function Go({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-clay py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-clay-dark">
      {children} <ChevronRight size={17} />
    </button>
  )
}

const Headline = ({ children }: { children: ReactNode }) => <p className="font-serif text-2xl leading-tight">{children}</p>

const fmtTime = (iso: string) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')

/** Where a fact came from: the owner's record, not the model */
function Source({ path }: { path: string }) {
  return (
    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
      <BadgeCheck size={14} className="shrink-0 text-emerald-400" />
      Published by {CLUB.name}
      {path && ` from ${path}`}
      {CLUB.publishedAt && `, ${fmtTime(CLUB.publishedAt)}`}
    </p>
  )
}

/** A tile that shows its headline, and opens in place when you're curious */
function Peek({ id, icon: Icon, title, headline, j, act, children }: { id: TileId; icon: LucideIcon; title: string; headline: string; j: Journey; act: TilesProps['act']; children: ReactNode }) {
  const open = j.tile === id
  return (
    <section className={`spatial-glass animate-card-in shrink-0 rounded-[28px] text-ink transition-shadow ${open ? 'ring-1 ring-clay' : ''}`}>
      <button onClick={() => act({ kind: 'tile', id })} aria-expanded={open} className="flex w-full items-center gap-4 p-4 text-left">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-clay/20"><Icon size={21} className="text-clay" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-muted">{title}</span>
          <span className="block font-serif text-[21px] leading-tight">{headline}</span>
        </span>
        <ChevronRight size={18} className={`shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div className="animate-card-in px-4 pb-4">{children}</div>}
    </section>
  )
}

/** Asks the club's system, shows the answer, and only reserves once the group confirms */
function EventsDetail({ j, act }: TilesProps) {
  const [check, setCheck] = useState<{ available: boolean; ticketsLeft: number; total: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const ask = async () => {
    setBusy(true)
    setCheck(await checkAvailability(PEOPLE).finally(() => setBusy(false)))
  }
  if (j.ticketRef) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-ink/[0.06] p-3.5 text-[15px] font-semibold">
        <Check size={18} className="text-clay" /> {PEOPLE} tickets, {j.ticketRef}
      </p>
    )
  }
  return (
    <>
      <p className="text-sm">{CLUB.entry}. {CLUB.age}.</p>
      {!check && <Go onClick={ask}>{busy ? 'Asking the club…' : 'Can we get in?'}</Go>}
      {check && (
        <div className="animate-card-in">
          <p className="mt-3 text-sm">
            {check.available ? `Yes, ${check.ticketsLeft} tickets left. ${PEOPLE} would be CHF ${check.total}.` : `Only ${check.ticketsLeft} tickets left.`}
          </p>
          {check.available && <Go onClick={() => act({ kind: 'reserve' })}>Reserve {PEOPLE} tickets</Go>}
        </div>
      )}
      <Source path={CLUB.sources.entry ?? ''} />
    </>
  )
}

export function VenueTiles({ j, act }: TilesProps) {
  const current = (j.floor ?? 'main-hall') as FloorId
  const extra = FLOOR_EXTRAS[current]
  return (
    <>
      <Peek id="music" icon={Music} title="Music" headline={extra.dj} j={j} act={act}>
        <div className="flex items-center gap-3">
          <Waveform bars={30} className="h-9 flex-1" />
          {extra.bpm > 0 && <span className="text-[13px] text-muted tabular-nums">{extra.bpm} BPM</span>}
        </div>
        <p className="mt-2 text-sm text-muted">Curated preview, generated for this demo.</p>
      </Peek>
      <Peek id="floors" icon={Layers} title="Floors" headline={`${vendor.floors.length} floors`} j={j} act={act}>
        <div className="flex flex-col gap-1.5">
          {vendor.floors.map((f) => (
            <Row key={f.id} active={j.floor === f.id && j.inside} onClick={() => act({ kind: 'floor', id: f.id as FloorId })}>
              <span className="flex-1 text-base font-medium">{f.name}</span>
              <span className="text-[13px] text-muted">{f.music} · {f.capacity}</span>
            </Row>
          ))}
        </div>
        <Source path="/floors" />
      </Peek>
      <Peek id="dress" icon={Shirt} title="Dress code" headline={CLUB.dress} j={j} act={act}>
        <p className="text-sm">Tonight is masked. {CLUB.age}.</p>
        <Source path={CLUB.sources.dress ?? ''} />
        <Go onClick={() => act({ kind: 'outfit' })}>We need costumes</Go>
      </Peek>
      <Peek id="events" icon={CalendarDays} title="Tonight" headline={CLUB.tonight.replace('Halloween: ', 'Halloween, ')} j={j} act={act}>
        <EventsDetail j={j} act={act} />
      </Peek>
    </>
  )
}

export function OutfitTiles({ j, act }: TilesProps) {
  const floor = (j.floor ?? 'main-hall') as FloorId
  const door = (o: (typeof OUTFITS)[number]) => dressCheck(o, CLUB.dress)
  const fits = (o: (typeof OUTFITS)[number]) => door(o).ok && (j.budget === null || o.price <= j.budget) && (!j.vibe || o.vibe === j.vibe)
  const pill = (active: boolean) => `rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${active ? 'bg-clay text-white' : 'bg-ink/[0.07] hover:bg-ink/[0.14]'}`
  return (
    <Tile icon={Shirt} title="For tonight" hint={`${CLUB.name}, ${floorById(floor)!.name}`}>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {BUDGETS.map((max) => (
          <button key={String(max)} onClick={() => act({ kind: 'budget', max })} className={pill(j.budget === max)}>{max ? `Under ${max}` : 'Any price'}</button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {VIBES.map((v) => (
          <button key={v} onClick={() => act({ kind: 'vibe', id: j.vibe === v ? null : v })} className={pill(j.vibe === v)}>{v}</button>
        ))}
        <span className="ml-auto text-[13px] text-muted">{WEATHER}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {OUTFITS.map((o) => (
          <div key={o.id} className={fits(o) ? '' : 'opacity-35'}>
            <Row active={j.outfit === o.id} onClick={() => act({ kind: 'pick', id: o.id })}>
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
      {j.outfit && (
        <div className="animate-card-in">
          <div className="mt-3 flex gap-3 px-1">
            {COLORS.map((c) => (
              <button
                key={c.id}
                title={c.name}
                aria-label={c.name}
                onClick={() => act({ kind: 'color', id: c.id })}
                className={`size-9 rounded-full transition ${j.color === c.id ? 'ring-2 ring-ink ring-offset-2 ring-offset-black/40' : 'opacity-70 hover:opacity-100'}`}
                style={{ background: c.hex }}
              />
            ))}
          </div>
          <Go onClick={() => act({ kind: 'shop' })}>Where can we get it?</Go>
        </div>
      )}
    </Tile>
  )
}

export function ShopTiles({ j, act }: TilesProps) {
  const outfit = outfitById(j.outfit)
  const shop = shopById(j.shop)
  if (!outfit || !shop) return null
  return (
    <Tile icon={Store} title={shop.name} hint={`For ${CLUB.name}, tonight`}>
      <p className="mb-3 text-sm text-muted">{shop.kind}</p>
      <div className="flex flex-col gap-1.5">
        {articlesFor(outfit, shop).map((a) => {
          const held = j.reserved.find((r) => r.id === a.id)
          return (
            <div key={a.id} className={`rounded-2xl px-4 py-3 ${held ? 'bg-clay/25 ring-1 ring-clay' : 'bg-ink/[0.06]'}`}>
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-serif text-xl">{a.name}</span>
                <span className="text-sm text-muted tabular-nums">CHF {a.price}</span>
              </span>
              <span className="mt-0.5 flex items-center justify-between gap-2">
                <span className="text-[13px] text-muted">{a.note}</span>
                {held ? (
                  <span className="flex items-center gap-1 text-[13px] font-semibold"><Check size={15} className="text-clay" /> {held.ref}</span>
                ) : (
                  <button onClick={() => act({ kind: 'reserveArticle', id: a.id })} className="rounded-full bg-clay px-3 py-1 text-[13px] font-semibold text-white transition-colors hover:bg-clay-dark">
                    Reserve {PEOPLE}
                  </button>
                )}
              </span>
            </div>
          )
        })}
      </div>
      <Go onClick={() => act({ kind: 'casino' })}>Now, how does the night end?</Go>
    </Tile>
  )
}

export function CasinoTiles({ j, act }: TilesProps) {
  const outfit = outfitById(j.outfit)
  return (
    <>
      <Tile icon={DoorOpen} title="At the door" hint={CASINO.hours}>
        <Headline>
          {outfit ? (
            <span className="flex items-center gap-2">
              {outfit.casino.ok && <Check size={22} className="shrink-0 text-clay" />}
              {outfit.name}
            </span>
          ) : (
            'Smart dress'
          )}
        </Headline>
        <p className={`mt-1 text-sm leading-snug ${outfit && !outfit.casino.ok ? 'text-clay' : 'text-muted'}`}>
          {outfit ? outfit.casino.note : 'You haven’t picked outfits yet.'}
        </p>
        <p className="mt-2 text-[13px] text-muted">18+, bring ID. CHF {CASINO.entry} entry.</p>
      </Tile>
      <Tile icon={Car} title="Getting there" delay={80}>
        <Headline>8 min by taxi</Headline>
        <p className="mt-1 text-sm text-muted">From {CLUB.name}. Leave around 02:15.</p>
        <p className="mt-2 text-[13px] text-muted">Fictional venue. Fun, not a way to pay for a costume.</p>
        <Go onClick={() => act({ kind: 'plan' })}>Lock in the plan</Go>
      </Tile>
    </>
  )
}

export function PlanTiles({ j, act }: TilesProps) {
  const floor = floorById(j.floor)
  const outfit = outfitById(j.outfit)
  const stops = [
    outfit && { time: '19:30', title: shopById(j.shop)?.name ?? 'Costumes: where from?', detail: `${outfit.name} × ${PEOPLE}`, price: unitPrice(j), to: 'shop' as const },
    { time: '23:00', title: CLUB.name, detail: floor ? `${floor.name}, ${FLOOR_EXTRAS[floor.id as FloorId].dj}` : 'Floor still open', price: CLUB.presale, to: 'venue' as const },
    j.casino && { time: '02:30', title: CASINO.name, detail: 'Taxi, then the tables', price: CASINO.entry + CASINO.taxi, to: 'casino' as const },
  ].filter((s) => !!s)

  return (
    <Tile icon={MapPin} title="Tonight" hint={`${PEOPLE} people`}>
      <ol className="flex flex-col gap-1.5">
        {stops.map((s) => (
          <li key={s.time}>
            <Row onClick={() => act({ kind: s.to })}>
              <span className="w-12 shrink-0 text-[15px] font-semibold text-clay tabular-nums">{s.time}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium">{s.title}</span>
                <span className="block truncate text-[13px] text-muted">{s.detail}</span>
              </span>
              <span className="text-sm text-muted tabular-nums">{s.price}</span>
            </Row>
          </li>
        ))}
      </ol>
      <p className="mt-4 flex items-baseline justify-between px-1">
        <span className="text-sm text-muted">Per person</span>
        <span className="font-serif text-3xl tabular-nums">CHF {perPerson(j)}</span>
      </p>
      {j.ticketRef ? (
        <p className="animate-card-in mt-3 rounded-2xl bg-ink/[0.06] p-3.5 text-[15px] font-semibold">
          <span className="flex items-center gap-2"><Check size={18} className="text-clay" /> Tickets confirmed: {j.ticketRef}</span>
          <span className="mt-1 block text-[13px] font-normal text-muted">{j.reserved.length ? `${j.reserved.length} articles on hold at ${shopById(j.shop)?.name}. ` : ''}The casino isn't booked in this demo.</span>
        </p>
      ) : (
        <Go onClick={() => act({ kind: 'book' })}>Reserve the club tickets</Go>
      )}
    </Tile>
  )
}
