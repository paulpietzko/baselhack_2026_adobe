import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, Check } from 'lucide-react'
import Connect from '../components/acme/Connect'
import Scan from '../components/acme/Scan'
import { BuildingPanel, ProfilePanel } from '../components/acme/Studio'
import Scene, { type Light } from '../components/acme/Venue'
import { AcmeLogo, cta, glass } from '../components/acme/ui'
import { BRAND } from '../brand'
import { vendor, type Field } from '../data/vendor'

type Stage = 'connect' | 'scan' | 'studio'

const SCAN_MS = 3500
const STEPS = ['Connect', 'Scan', 'Design', 'Publish']

/** "my-club.ch" → "My Club" */
const nameFrom = (domain: string) =>
  domain
    .split('.')[0]
    .replace(/[-_]+/g, ' ')
    .replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase())

function Progress({ value }: { value: number }) {
  const c = 2 * Math.PI * 14
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-500">
      <svg width="28" height="28" viewBox="0 0 34 34" className="-rotate-90">
        <circle cx="17" cy="17" r="14" fill="none" stroke="rgb(0 0 0 / 0.08)" strokeWidth="3.5" />
        <circle
          cx="17"
          cy="17"
          r="14"
          fill="none"
          stroke="var(--color-acme)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span>
        <b className="font-semibold text-neutral-900">{Math.round(value * 100)}%</b> complete
      </span>
    </div>
  )
}

function Published({ name, floors, onClose }: { name: string; floors: number; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-white/30 backdrop-blur-md">
      <div className={`${glass} w-[400px] animate-rise p-7 text-center`}>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500 text-white">
          <Check size={26} strokeWidth={2.5} />
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">{name || 'Your club'} is live</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Your club and all {floors} floors are now on {BRAND}. Guests can ask, walk through every room and get in
          without ever opening your website.
        </p>
        <div className="mt-5 rounded-2xl bg-black/[0.04] p-3 text-left text-sm">
          <p className="text-xs text-neutral-500">A question that now finds you</p>
          <p className="mt-1">"Where can we go out in Basel tonight for Halloween?"</p>
        </div>
        <div className="mt-6 flex gap-2 text-sm">
          <button onClick={onClose} className="flex-1 rounded-full bg-black/[0.06] py-2.5 font-medium hover:bg-black/10">
            Keep editing
          </button>
          <Link to="/" className={`${cta} flex-1 py-2.5`}>
            Open in {BRAND} <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function Vendor() {
  const [stage, setStage] = useState<Stage>('connect')
  const [url, setUrl] = useState<string>()
  const [progress, setProgress] = useState(0)
  const [profile, setProfile] = useState<Field[]>(vendor.profile)
  const [floors, setFloors] = useState(vendor.floors)
  const [open, setOpen] = useState<string | null>(null)
  const [room, setRoom] = useState<number | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [party, setParty] = useState(false)
  const [light, setLight] = useState<Light>('pink')
  const [published, setPublished] = useState(false)

  // Mock crawl: progress runs 0 → 1, then the studio opens
  useEffect(() => {
    if (stage !== 'scan') return
    const start = performance.now()
    let raf = 0
    let timer = 0
    const tick = () => {
      const p = Math.min((performance.now() - start) / SCAN_MS, 1)
      setProgress(p)
      if (p < 1) raf = requestAnimationFrame(tick)
      else timer = window.setTimeout(() => setStage('studio'), 500)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [stage])

  // Stable so the memoized scene doesn't re-render on every edit
  const openFloor = useCallback((id: string | null) => {
    setOpen(id)
    setRoom(null)
    setHover(null)
  }, [])
  // Right-click or Esc steps back out: room → floor → building
  const back = () => (room !== null ? setRoom(null) : openFloor(null))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && back()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const setCapacity = (capacity: number) => setFloors((fs) => fs.map((f) => (f.id === open ? { ...f, capacity } : f)))
  const updateField = (key: string, patch: Partial<Field>) =>
    setProfile((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)))
  const manual = () => {
    setProfile(vendor.profile.map((f) => ({ ...f, value: '', confidence: 100 })))
    setProgress(1)
    setStage('studio')
  }

  const complete = profile.filter((f) => f.value && f.confidence >= 70).length / profile.length
  const step = published ? 3 : ['connect', 'scan', 'studio'].indexOf(stage)

  return (
    <div
      onContextMenu={(e) => {
        if (stage !== 'studio' || !(e.target instanceof HTMLCanvasElement)) return
        e.preventDefault()
        back()
      }}
      className="fixed inset-0 overflow-hidden bg-[radial-gradient(80%_60%_at_50%_0%,#ffffff,#f5f5f7_60%,#e8e8ed)] font-system text-neutral-900 antialiased [color-scheme:light]">
      <Scene
        progress={progress}
        interactive={stage === 'studio'}
        floors={floors}
        open={open}
        room={room}
        hover={hover}
        name={profile[0].value || 'your club'}
        party={party}
        light={light}
        onHover={setHover}
        onOpen={openFloor}
        onRoom={setRoom}
      />

      <header className="relative z-20 flex h-14 items-center gap-6 px-5">
        <AcmeLogo />
        <ol className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${i === step ? 'bg-black/[0.06] text-neutral-900' : i < step ? 'text-neutral-500' : 'text-neutral-400'}`}
            >
              {i < step && <Check size={12} />}
              {s}
            </li>
          ))}
        </ol>
        <div className="ml-auto flex items-center gap-4">
          {stage === 'studio' && (
            <>
              <Progress value={complete} />
              <button onClick={() => setPublished(true)} className={`${cta} h-8 px-4 text-sm`}>
                Publish
              </button>
            </>
          )}
          <Link to="/" className="flex items-center gap-0.5 text-sm text-neutral-500 hover:text-neutral-900">
            {BRAND} <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>

      {stage === 'connect' && (
        <Connect
          onScan={(u) => {
            const domain = u.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
            setUrl(domain)
            // A typed address names the club; plain Enter keeps the demo club
            if (domain !== vendor.demoUrl) updateField('name', { value: nameFrom(domain) })
            setStage('scan')
          }}
          onManual={manual}
        />
      )}
      {stage === 'scan' && <Scan url={url!} progress={progress} />}
      {stage === 'studio' && (
        <>
          <ProfilePanel url={url} profile={profile} onField={updateField} />
          <BuildingPanel
            floors={floors}
            open={open}
            room={room}
            hover={hover}
            onHover={setHover}
            onOpen={openFloor}
            onRoom={setRoom}
            onCapacity={setCapacity}
            party={party}
            onParty={setParty}
            light={light}
            onLight={setLight}
          />
        </>
      )}
      {published && <Published name={profile[0].value} floors={floors.length} onClose={() => setPublished(false)} />}
    </div>
  )
}
