import { useEffect, useState, type ReactNode } from 'react'
import {
  Car,
  Check,
  ChevronRight,
  Coins,
  Dices,
  DoorOpen,
  IdCard,
  Layers,
  type LucideIcon,
  MapPin,
  Music,
  PartyPopper,
  Shirt,
  Sparkles,
  Store,
  Ticket,
  Users,
} from 'lucide-react'
import Waveform from '../Waveform'
import { Avatar, CrewStack } from './Crew'
import { vendor } from '../../data/vendor'
import {
  BUDGET_DISCOUNT,
  CASINO,
  CLUB,
  COLORS,
  CREW,
  CROWD_HOURS,
  FLOOR_EXTRAS,
  FLOOR_VOTES,
  OUTFITS,
  OUTFIT_VOTES,
  SHOPS,
  floorById,
  outfitById,
  shopById,
  type CrewId,
  type FloorId,
} from '../../data/tonight'
import { APPROVAL_MS, perPerson, unitPrice, type Intent, type Journey } from '../../lib/journey'

type Act = (intent: Intent) => void
type TilesProps = { j: Journey; act: Act }

function Tile({ icon: Icon, title, hint, delay = 0, children }: { icon: LucideIcon; title: string; hint?: string; delay?: number; children: ReactNode }) {
  return (
    <section className="spatial-glass animate-card-in shrink-0 rounded-[22px] p-3 text-ink" style={{ animationDelay: `${delay}ms` }}>
      <h3 className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold">
        <Icon size={14} className="text-clay" /> {title}
        {hint && <span className="ml-auto truncate pl-2 text-[10.5px] font-normal text-muted">{hint}</span>}
      </h3>
      {children}
    </section>
  )
}

function Row({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition-colors ${active ? 'bg-clay/25 ring-1 ring-clay' : 'bg-ink/[0.05] hover:bg-ink/10'}`}
    >
      {children}
    </button>
  )
}

function Go({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl bg-clay py-1.5 text-xs font-semibold text-white hover:bg-clay-dark">
      {children} <ChevronRight size={13} />
    </button>
  )
}

/** Who's behind an option: the others' votes, plus yours if you picked it */
const voters = <T,>(votes: Partial<Record<CrewId, T>>, mine: T | null, id: T) => [
  ...(mine === id ? (['you'] as CrewId[]) : []),
  ...CREW.map((c) => c.id).filter((c) => votes[c] === id),
]

export function VenueTiles({ j, act }: TilesProps) {
  const current = (j.floor ?? 'main-hall') as FloorId
  const extra = FLOOR_EXTRAS[current]
  return (
    <>
      <Tile icon={Layers} title="Floors" hint="Published by the club">
        <div className="flex flex-col gap-1">
          {vendor.floors.map((f) => (
            <Row key={f.id} active={j.floor === f.id && j.inside} onClick={() => act({ kind: 'floor', id: f.id as FloorId })}>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{f.name}</span>
                <span className="block truncate text-[10.5px] text-muted">{f.music} · {f.capacity}</span>
              </span>
              <CrewStack ids={voters(FLOOR_VOTES, j.floor, f.id as FloorId)} size={18} />
            </Row>
          ))}
        </div>
      </Tile>
      <Tile icon={Music} title="Music" hint={floorById(current)!.name} delay={80}>
        <button onClick={() => act({ kind: 'music' })} className="block w-full text-left">
          <p className="truncate text-xs font-medium">{extra.dj}</p>
          <div className="mt-1 flex items-center gap-2">
            <Waveform bars={22} className="h-5 flex-1" />
            {extra.bpm > 0 && <span className="text-[10.5px] text-muted tabular-nums">{extra.bpm} BPM</span>}
          </div>
        </button>
      </Tile>
      <Tile icon={Shirt} title="Dress code" hint={CLUB.age} delay={160}>
        <p className="text-xs">Masked. {CLUB.dress}.</p>
        <Go onClick={() => act({ kind: 'outfit' })}>Dress the crew</Go>
      </Tile>
      <Tile icon={Users} title="Crowd" hint="Best before 00:00" delay={240}>
        <button onClick={() => act({ kind: 'crowd' })} className="flex h-12 w-full items-end gap-1.5">
          {extra.crowd.map((v, i) => (
            <span key={i} className="flex h-full flex-1 flex-col justify-end gap-0.5 text-center text-[9.5px] text-muted">
              <span className="rounded-sm bg-clay/80 transition-[height] duration-500" style={{ height: `${v * 0.7}%` }} />
              {CROWD_HOURS[i]}
            </span>
          ))}
        </button>
      </Tile>
      <Tile icon={Ticket} title="At the door" hint={`CHF ${CLUB.presale} presale`} delay={320}>
        <Row active={j.guestlist} onClick={() => act({ kind: 'guestlist' })}>
          {j.guestlist ? <Check size={13} className="text-clay" /> : <CrewStack size={18} />}
          <span className="font-medium">{j.guestlist ? 'All 4 on the list' : 'Put us on the list'}</span>
        </Row>
      </Tile>
    </>
  )
}

export function OutfitTiles({ j, act }: TilesProps) {
  const floor = (j.floor ?? 'main-hall') as FloorId
  const chosen = outfitById(j.outfit)
  return (
    <>
      <Tile icon={Shirt} title="The look" hint={`For the ${floorById(floor)!.name}`}>
        <div className="flex flex-col gap-1">
          {OUTFITS.map((o) => (
            <Row key={o.id} active={j.outfit === o.id} onClick={() => act({ kind: 'pick', id: o.id })}>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-1 font-medium">
                  {o.name}
                  <span className="font-normal text-muted tabular-nums">CHF {o.price - (j.budget ? BUDGET_DISCOUNT : 0)}</span>
                </span>
                <span className="mt-0.5 block text-[10.5px] leading-snug text-muted">{o.onFloor[floor]}</span>
                <span className="mt-1 block"><CrewStack ids={voters(OUTFIT_VOTES, j.outfit, o.id)} size={16} /></span>
              </span>
            </Row>
          ))}
        </div>
      </Tile>
      {chosen && (
        <Tile icon={Sparkles} title="Refine it" delay={80}>
          <p className="mb-1 text-[10.5px] text-muted">{chosen.id === 'skeleton' ? 'Mask colour' : 'Lining and mask'}</p>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c.id}
                title={c.name}
                aria-label={c.name}
                onClick={() => act({ kind: 'color', id: c.id })}
                className={`size-7 rounded-full transition ${j.color === c.id ? 'ring-2 ring-ink ring-offset-2 ring-offset-transparent' : 'opacity-80 hover:opacity-100'}`}
                style={{ background: c.hex }}
              />
            ))}
          </div>
          <div className="mt-2">
            <Row active={j.budget} onClick={() => act({ kind: 'budget' })}>
              <Coins size={13} className="text-clay" />
              <span>{j.budget ? `Rental cut, CHF ${BUDGET_DISCOUNT} less each` : 'Show a cheaper cut'}</span>
            </Row>
          </div>
          <Go onClick={() => act({ kind: 'shop' })}>Where to get it</Go>
        </Tile>
      )}
    </>
  )
}

export function ShopTiles({ j, act }: TilesProps) {
  const outfit = outfitById(j.outfit)
  return (
    <>
      <Tile icon={Store} title={`${outfit?.name ?? 'Costumes'} for 4`} hint="In stock now">
        <div className="flex flex-col gap-1">
          {SHOPS.map((s) => (
            <Row key={s.id} active={j.shop === s.id} onClick={() => act({ kind: 'pickShop', id: s.id })}>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-1 font-medium">
                  {s.name}
                  <span className="font-normal text-muted tabular-nums">
                    CHF {(outfit?.price ?? 0) + s.extra - (j.budget ? BUDGET_DISCOUNT : 0)}
                  </span>
                </span>
                <span className="block text-[10.5px] text-muted">{s.kind}</span>
                <span className="mt-0.5 block text-[10.5px] leading-snug">{s.stock}</span>
              </span>
            </Row>
          ))}
        </div>
      </Tile>
      <Tile icon={MapPin} title="How it fits tonight" delay={80}>
        <p className="text-xs leading-snug">
          Doors at {CLUB.name} open at 23:00, so there's time to change first. The coat check at the Entrance takes anything too big for the {floorById(j.floor)?.name ?? 'Main Hall'}.
        </p>
      </Tile>
      {j.shop && (
        <Tile icon={Dices} title="Then what?" delay={160}>
          <p className="text-xs">The night still needs an ending.</p>
          <Go onClick={() => act({ kind: 'casino' })}>Find a casino</Go>
        </Tile>
      )}
    </>
  )
}

export function CasinoTiles({ j, act }: TilesProps) {
  const outfit = outfitById(j.outfit)
  const winner = CREW.find((c) => c.id === j.winner)
  return (
    <>
      <Tile icon={DoorOpen} title="At the door" hint={CASINO.hours}>
        <p className={`flex items-start gap-1.5 text-xs leading-snug ${outfit && !outfit.casino.ok ? 'text-clay' : ''}`}>
          {outfit?.casino.ok && <Check size={13} className="mt-px shrink-0 text-clay" />}
          {outfit ? `${outfit.name}: ${outfit.casino.note}` : 'Smart dress at the door, and you haven’t picked outfits yet.'}
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-muted">
          <IdCard size={13} /> 18+, bring ID · CHF {CASINO.entry} entry
        </p>
      </Tile>
      <Tile icon={Car} title="Getting there" hint="From Hafenlicht" delay={80}>
        <p className="text-xs leading-snug">{CASINO.ride}. Leave around 02:15.</p>
      </Tile>
      <Tile icon={Dices} title="Tables" delay={160}>
        <ul className="space-y-0.5 text-xs">
          {CASINO.tables.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </Tile>
      <Tile icon={Coins} title="Who buys the first round?" delay={240}>
        <Row onClick={() => !j.spinning && act({ kind: 'spin' })}>
          {winner ? <Avatar id={winner.id} size={18} /> : <Dices size={13} className={`text-clay ${j.spinning ? 'animate-spin' : ''}`} />}
          <span className="font-medium">
            {j.spinning ? 'Spinning…' : winner ? `${winner.name === 'You' ? 'You buy' : `${winner.name} buys`}. Spin again?` : 'Spin the wheel'}
          </span>
        </Row>
      </Tile>
      <button onClick={() => act({ kind: 'plan' })} className="animate-card-in flex shrink-0 items-center justify-center gap-1 rounded-[22px] bg-clay py-2.5 text-sm font-semibold text-white hover:bg-clay-dark" style={{ animationDelay: '320ms' }}>
        Lock in the plan <ChevronRight size={15} />
      </button>
    </>
  )
}

export function PlanTiles({ j, act }: TilesProps) {
  const [approved, setApproved] = useState(j.booked ? 3 : 0)
  useEffect(() => {
    const timers = APPROVAL_MS.map((ms, i) => setTimeout(() => setApproved((n) => Math.max(n, i + 1)), ms))
    return () => timers.forEach(clearTimeout)
  }, [])

  const floor = floorById(j.floor)
  const outfit = outfitById(j.outfit)
  const shop = shopById(j.shop)
  const stops = [
    outfit && { time: '19:30', title: shop?.name ?? 'Costumes: still to decide', detail: `${outfit.name} × 4`, price: unitPrice(j), to: 'outfit' as const },
    { time: '23:00', title: CLUB.name, detail: floor ? `${floor.name} · ${FLOOR_EXTRAS[floor.id as FloorId].dj}` : 'Floor still open', price: CLUB.presale, to: 'venue' as const },
    j.casino && { time: '02:30', title: CASINO.name, detail: j.winner ? `${CREW.find((c) => c.id === j.winner)!.name} got the first round` : 'Taxi, then roulette', price: CASINO.entry + 6, to: 'casino' as const },
  ].filter((s) => !!s)
  const others = CREW.filter((c) => c.id !== 'you')

  return (
    <>
      <Tile icon={MapPin} title="Tonight" hint="Halloween · 4 people">
        <ol className="flex flex-col gap-1">
          {stops.map((s) => (
            <li key={s.time}>
              <Row onClick={() => act({ kind: s.to })}>
                <span className="w-9 shrink-0 font-medium text-clay tabular-nums">{s.time}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.title}</span>
                  <span className="block truncate text-[10.5px] text-muted">{s.detail}</span>
                </span>
                <span className="text-[10.5px] text-muted tabular-nums">{s.price}</span>
              </Row>
            </li>
          ))}
        </ol>
        <p className="mt-2 flex justify-between px-1 text-xs font-semibold">
          Per person <span className="tabular-nums">CHF {perPerson(j)}</span>
        </p>
      </Tile>
      <Tile icon={Users} title="The crew" hint={`${approved} of ${others.length} in`} delay={80}>
        <ul className="flex gap-3">
          {others.map((c, i) => (
            <li key={c.id} className={`relative transition-opacity duration-300 ${i < approved ? '' : 'opacity-35'}`}>
              <Avatar id={c.id} size={28} />
              {i < approved && (
                <span className="animate-card-in absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full bg-emerald-500 text-white">
                  <Check size={9} strokeWidth={3} />
                </span>
              )}
            </li>
          ))}
        </ul>
      </Tile>
      {j.booked ? (
        <Tile icon={PartyPopper} title="You’re going out">
          <dl className="grid grid-cols-3 gap-1 text-center">
            {[
              [stops.length, 'bookings'],
              [4, 'people'],
              [0, 'websites opened'],
            ].map(([n, label]) => (
              <div key={label} className="rounded-xl bg-ink/[0.05] py-2">
                <dd className="font-serif text-2xl">{n}</dd>
                <dt className="text-[10px] leading-tight text-muted">{label}</dt>
              </div>
            ))}
          </dl>
        </Tile>
      ) : (
        <button
          disabled={approved < others.length}
          onClick={() => act({ kind: 'book' })}
          className="animate-card-in flex shrink-0 items-center justify-center gap-1 rounded-[22px] bg-clay py-2.5 text-sm font-semibold text-white hover:bg-clay-dark disabled:opacity-50"
          style={{ animationDelay: '160ms' }}
        >
          {approved < others.length ? 'Waiting for the crew…' : 'Book it all, split four ways'}
        </button>
      )}
    </>
  )
}
