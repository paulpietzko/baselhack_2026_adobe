import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, Check } from 'lucide-react'
import Connect from '../components/acme/Connect'
import Scan from '../components/acme/Scan'
import { DesignPanel, ProfilePanel } from '../components/acme/Studio'
import Scene, { type ClubConfig, type Zone } from '../components/acme/Venue'
import { AcmeLogo, cta, glass } from '../components/acme/ui'
import { vendor, type Field, type Space } from '../data/vendor'

type Stage = 'connect' | 'scan' | 'studio'

const SCAN_MS = 8000
const STEPS = ['Connect', 'Scan', 'Design', 'Publish']

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
          Your club, its {floors} floors and the floorplan are now on Claude. Guests can ask, look around and get in
          without ever opening your website.
        </p>
        <div className="mt-5 rounded-2xl bg-black/[0.04] p-3 text-left text-sm">
          <p className="text-xs text-neutral-500">A question that now finds you</p>
          <p className="mt-1">"Where can I go out in Basel tonight for Halloween?"</p>
        </div>
        <div className="mt-6 flex gap-2 text-sm">
          <button onClick={onClose} className="flex-1 rounded-full bg-black/[0.06] py-2.5 font-medium hover:bg-black/10">
            Keep editing
          </button>
          <Link to="/" className={`${cta} flex-1 py-2.5`}>
            Open in Claude <ArrowUpRight size={15} />
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
  const [spaces, setSpaces] = useState(vendor.spaces)
  const [spaceId, setSpaceId] = useState(vendor.spaces[0].id)
  const [plan, setPlan] = useState(false)
  const [party, setParty] = useState(false)
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
      else timer = window.setTimeout(() => setStage('studio'), 900)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [stage])

  const space = spaces.find((s) => s.id === spaceId)!
  const updateSpace = (patch: Partial<Space>) =>
    setSpaces((ss) => ss.map((s) => (s.id === spaceId ? { ...s, ...patch } : s)))
  const updateConfig = (patch: Partial<ClubConfig>) => updateSpace({ config: { ...space.config, ...patch } })
  // Stable so the memoized scene doesn't re-render on every edit
  const moveZone = useCallback(
    (zone: Zone, at: [number, number]) =>
      setSpaces((ss) =>
        ss.map((s) => (s.id === spaceId ? { ...s, config: { ...s.config, layout: { ...s.config.layout, [zone]: at } } } : s)),
      ),
    [spaceId],
  )
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
    <div className="fixed inset-0 overflow-hidden bg-[radial-gradient(80%_60%_at_50%_0%,#ffffff,#f5f5f7_60%,#e8e8ed)] font-system text-neutral-900 antialiased [color-scheme:light]">
      <Scene
        progress={progress}
        interactive={stage === 'studio'}
        plan={plan}
        party={party}
        config={space.config}
        onMove={moveZone}
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
            Claude <ArrowUpRight size={14} />
          </Link>
        </div>
      </header>

      {stage === 'connect' && (
        <Connect
          onScan={(u) => {
            setUrl(u.replace(/^https?:\/\//, ''))
            setStage('scan')
          }}
          onManual={manual}
        />
      )}
      {stage === 'scan' && <Scan url={url!} progress={progress} />}
      {stage === 'studio' && (
        <>
          <ProfilePanel
            url={url}
            profile={profile}
            onField={updateField}
            spaces={spaces}
            spaceId={spaceId}
            onSelect={setSpaceId}
            onCapacity={(capacity) => updateSpace({ capacity })}
          />
          <DesignPanel
            config={space.config}
            onChange={updateConfig}
            plan={plan}
            onPlan={setPlan}
            party={party}
            onParty={setParty}
          />
        </>
      )}
      {published && <Published name={profile[0].value} floors={spaces.length} onClose={() => setPublished(false)} />}
    </div>
  )
}
