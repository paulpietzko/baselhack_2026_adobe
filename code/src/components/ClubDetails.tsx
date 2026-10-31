import { Check, Clock, MapPin, Music, Shirt, Sparkles, Ticket, TrendingUp, Users, X } from 'lucide-react'
import { BASEL_PLACES, CLUB_ROUGE } from '../data/basel'

const club = BASEL_PLACES.find((p) => p.id === CLUB_ROUGE.id)!

// Same glass tiles as the place cards, a little bigger
const card = 'spatial-glass pointer-events-auto animate-card-in rounded-[26px] p-2 text-ink'
// Fullscreen map (sidebar collapsed): clear the top bar; the chat input sits centred between the bottom cards
const edges = 'top-4 bottom-4 sidebar-collapsed:top-16 sidebar-collapsed:bottom-6'

const label = 'flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted uppercase'

/** Overlay for the 3D close-up of the hidden gem: club info, dress code and tonight's crowd (ideas from bako + TripTune). */
export default function ClubDetails() {
  const max = Math.max(...CLUB_ROUGE.crowd.map((c) => c.value))

  return (
    <div className="pointer-events-none absolute inset-0 font-system">
      {/* Bottom left: about the club */}
      <article
        className={`${card} absolute bottom-4 left-4 w-[300px] sidebar-collapsed:bottom-6 sidebar-collapsed:left-6`}
        style={{ animationDelay: '100ms' }}
      >
        {/* Photo header with the badges on top, like the place cards */}
        <div className="relative h-32 overflow-hidden rounded-[20px]" style={{ background: club.tint }}>
          {club.image && <img src={club.image} alt={club.name} className="absolute inset-0 size-full object-cover" />}
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-clay px-2 py-0.5 text-[10px] font-semibold text-bg">
            <Sparkles size={11} /> Hidden gem
          </span>
          <span className="absolute top-2 right-2 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums backdrop-blur-md">
            {club.time.replace(/^Tonight · /, '')}
          </span>
        </div>
        <div className="px-2 pt-3 pb-1.5">
          <p className={`${label} text-clay`}>
            <MapPin size={11} /> {CLUB_ROUGE.floor}
          </p>
          <h3 className="mt-1 text-[17px] leading-tight font-semibold">{club.name}</h3>
          <p className="mt-0.5 text-[11.5px] text-muted">{CLUB_ROUGE.address}</p>
          <p className="mt-2 text-[11.5px] leading-snug">{CLUB_ROUGE.lineup}</p>

          <dl className="mt-3 space-y-1.5 text-[11.5px]">
            {[
              { icon: Clock, k: 'Open', v: CLUB_ROUGE.open },
              { icon: Ticket, k: 'Entry', v: CLUB_ROUGE.entry },
              { icon: Users, k: 'Age', v: CLUB_ROUGE.age },
            ].map(({ icon: Icon, k, v }) => (
              <div key={k} className="flex items-center justify-between">
                <dt className={label}>
                  <Icon size={12} /> {k}
                </dt>
                <dd className="font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Music size={12} className="text-muted" />
            {CLUB_ROUGE.genres.map((g) => (
              <span key={g} className="rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-medium text-muted">
                {g}
              </span>
            ))}
          </div>
        </div>
      </article>

      {/* Right column: crowd on top, dress code at the bottom */}
      <div className={`absolute ${edges} right-4 flex w-[280px] flex-col justify-between gap-3 sidebar-collapsed:right-6`}>
        {/* Top right: tonight's crowd (like TripTune's visitor box) */}
        <article className={card} style={{ animationDelay: '400ms' }}>
          <div className="px-2 pt-2 pb-1.5">
            <div className="flex items-center justify-between">
              <p className={label}>
                <TrendingUp size={12} /> Crowd tonight
              </p>
              <span className="flex items-center gap-1.5 rounded-full bg-ink/[0.06] px-2 py-0.5 text-[10px] font-semibold">
                <span className="relative flex size-1.5">
                  <span className="absolute inset-0 animate-ping rounded-full bg-clay" />
                  <span className="size-1.5 rounded-full bg-clay" />
                </span>
                Live
              </span>
            </div>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-clay tabular-nums">{CLUB_ROUGE.liveCrowd}%</span>
              <span className="text-[11px] text-muted">full · filling up</span>
            </p>

            {/* Hourly bars, the current hour in clay */}
            <div className="mt-3 flex h-16 items-end gap-1.5">
              {CLUB_ROUGE.crowd.map((c, i) => (
                <div key={c.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className={`w-full origin-bottom animate-[grow-up_700ms_cubic-bezier(0.22,1,0.36,1)_both] rounded-md ${
                      i === CLUB_ROUGE.nowIndex ? 'bg-clay' : 'bg-ink/15'
                    }`}
                    style={{ height: `${(c.value / max) * 100}%`, animationDelay: `${500 + i * 60}ms` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-1.5">
              {CLUB_ROUGE.crowd.map((c, i) => (
                <span
                  key={c.hour}
                  className={`flex-1 text-center text-[9.5px] tabular-nums ${i === CLUB_ROUGE.nowIndex ? 'font-semibold text-clay' : 'text-muted'}`}
                >
                  {c.hour}
                </span>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-ink/10 pt-2.5">
              <div>
                <p className="text-[10px] text-muted">Best arrival</p>
                <p className="text-[12px] font-semibold text-emerald-500 tabular-nums">{CLUB_ROUGE.recommended}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted">Peak</p>
                <p className="text-[12px] font-semibold text-red-400 tabular-nums">{CLUB_ROUGE.peak}</p>
              </div>
            </div>
          </div>
        </article>
        {/* Bottom right: dress code */}
        <article className={card} style={{ animationDelay: '250ms' }}>
          <div className="px-2 pt-2 pb-1.5">
            <p className={label}>
              <Shirt size={12} /> Dress code
            </p>
            <h3 className="mt-1 text-[14px] leading-snug font-semibold">{CLUB_ROUGE.dressCode.theme}</h3>
            <ul className="mt-2.5 space-y-1 text-[11.5px]">
              {CLUB_ROUGE.dressCode.dos.map((d) => (
                <li key={d} className="flex items-center gap-2">
                  <span className="grid size-4 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
                    <Check size={10} strokeWidth={3} />
                  </span>
                  {d}
                </li>
              ))}
              {CLUB_ROUGE.dressCode.donts.map((d) => (
                <li key={d} className="flex items-center gap-2 text-muted">
                  <span className="grid size-4 place-items-center rounded-full bg-red-500/15 text-red-400">
                    <X size={10} strokeWidth={3} />
                  </span>
                  {d}
                </li>
              ))}
            </ul>
            <p className="mt-2.5 rounded-xl bg-clay/12 px-2.5 py-1.5 text-[11px] font-medium text-clay">
              {CLUB_ROUGE.dressCode.note}
            </p>
          </div>
        </article>
      </div>
    </div>
  )
}
