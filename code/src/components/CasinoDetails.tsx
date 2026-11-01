import { useEffect, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import { ArrowLeft, Car, Clock, Coins, Dices, Gift, IdCard, MapPin, Sparkles, Spade } from 'lucide-react'
import type { ClubBuilding } from './ClubFloorLabels'
import { Beacon } from './ShopDetails'
import { CASINO, JACKPOT, TABLES } from '../data/casino'
import { SHOP } from '../data/shop'

const card = 'spatial-glass pointer-events-auto animate-card-in rounded-[26px] p-2 text-ink'
const edges = 'top-4 bottom-4 sidebar-collapsed:top-16 sidebar-collapsed:bottom-6'
const label = 'flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-muted uppercase'

function meters([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const rad = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(a))
}
// By taxi across town: roads +40%, ~25 km/h through the old town at night
const RIDE_M = meters(SHOP.lngLat, CASINO.lngLat) * 1.4
const RIDE_MIN = Math.max(5, Math.round(RIDE_M / 1000 / 25 * 60))

/** Ad banner: tonight's Halloween jackpot, ticking up live like on the casino floor */
function JackpotBanner() {
  const [jackpot, setJackpot] = useState(JACKPOT.start)
  useEffect(() => {
    const t = setInterval(() => setJackpot((j) => j + 0.05 + Math.random() * 1.2), 120)
    return () => clearInterval(t)
  }, [])

  return (
    <article
      className="pointer-events-auto relative animate-card-in overflow-hidden rounded-[26px] p-4 text-black shadow-[0_0_40px_rgb(212_175_55/0.35)]"
      style={{ animationDelay: '500ms', background: `linear-gradient(135deg, #f7e08a, ${CASINO.color} 45%, #9a7414)` }}
    >
      {/* A light sweep across the gold, every few seconds */}
      <span aria-hidden className="absolute inset-y-0 -left-1/2 w-1/3 animate-jackpot-shine bg-gradient-to-r from-transparent via-white/45 to-transparent" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 rounded-full bg-black px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#f7e08a] uppercase">
            <Sparkles size={11} /> Tonight only
          </span>
          <span className="text-[10px] font-semibold tracking-wide uppercase opacity-70">Ad · {CASINO.name}</span>
        </div>
        <p className="mt-3 text-[11px] font-bold tracking-[0.2em] uppercase opacity-80">{JACKPOT.title}</p>
        <p className="font-serif text-[34px] leading-none font-semibold tabular-nums">
          CHF {jackpot.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="mt-1 text-[11.5px] font-medium">{JACKPOT.drop}</p>
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-black/85 px-3 py-2 text-[11.5px] font-semibold text-[#f7e08a]">
          <Gift size={15} className="shrink-0" />
          {JACKPOT.offer}
        </div>
        <p className="mt-2 text-[9.5px] opacity-70">{JACKPOT.fineprint}</p>
      </div>
    </article>
  )
}

/** Overlay once we've flown on from the mall to the casino */
export default function CasinoDetails({ map, building, onBack }: { map: mapboxgl.Map; building: ClubBuilding | null; onBack: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onBack()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  return (
    <div className="pointer-events-none absolute inset-0 font-system">
      {building && <Beacon map={map} building={building} color={CASINO.color} text={`${CASINO.name} · Tables open`} icon={Dices} />}

      {/* Top left: back to the mall */}
      <button
        onClick={onBack}
        data-hand-back
        className="spatial-glass pointer-events-auto absolute top-3 left-3 flex animate-fade-in items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:text-clay sidebar-collapsed:top-10 sidebar-collapsed:left-6"
      >
        <ArrowLeft size={14} /> Back to {SHOP.name}
      </button>

      {/* Bottom left: the casino */}
      <article className={`${card} absolute bottom-4 left-4 w-[300px] sidebar-collapsed:bottom-6 sidebar-collapsed:left-6`} style={{ animationDelay: '100ms' }}>
        <div className="relative h-32 overflow-hidden rounded-[20px] bg-[#17151c]">
          <img src={CASINO.image} alt={CASINO.name} className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${CASINO.color}b3, transparent 60%)` }} />
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-black">
            <Sparkles size={11} /> Next stop
          </span>
          <span className="absolute bottom-2 left-3 text-[11px] font-semibold text-white/80">{CASINO.kind}</span>
        </div>
        <div className="px-2 pt-3 pb-1.5">
          <p className={label} style={{ color: CASINO.color }}>
            <MapPin size={11} /> Basel · by the airport road
          </p>
          <h3 className="mt-1 text-[17px] leading-tight font-semibold">{CASINO.name}</h3>
          <p className="mt-0.5 text-[11.5px] text-muted">{CASINO.address}</p>
          <dl className="mt-3 space-y-1.5 text-[11.5px]">
            {[
              { icon: Clock, k: 'Open', v: CASINO.open },
              { icon: IdCard, k: 'Entry', v: CASINO.entry },
              { icon: Car, k: `From ${SHOP.name}`, v: `${RIDE_MIN} min taxi · ${(RIDE_M / 1000).toFixed(1)} km` },
            ].map(({ icon: Icon, k, v }) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <dt className={label}>
                  <Icon size={12} /> {k}
                </dt>
                <dd className="font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </article>

      {/* Right column: tables on top, the door below */}
      <div className={`absolute ${edges} right-4 flex w-[300px] flex-col justify-between gap-3 overflow-y-auto [scrollbar-width:none] sidebar-collapsed:right-6`}>
        <article className={card} style={{ animationDelay: '300ms' }}>
          <div className="px-2 pt-2 pb-1.5">
            <p className={label}>
              <Spade size={12} /> Tables tonight
            </p>
            <ul className="mt-2.5 space-y-2 text-[11.5px]">
              {TABLES.map((t, i) => (
                <li key={t.game} className="flex animate-card-in items-center gap-2" style={{ animationDelay: `${450 + i * 90}ms` }}>
                  <span className="grid size-6 shrink-0 place-items-center rounded-full" style={{ background: `${CASINO.color}26`, color: CASINO.color }}>
                    <Coins size={12} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{t.game}</span>
                    <span className="block text-[10.5px] text-muted">{t.open}</span>
                  </span>
                  <span className="text-muted tabular-nums">min CHF {t.min}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <JackpotBanner />
      </div>
    </div>
  )
}
