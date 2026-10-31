import { Check, FileText, LoaderCircle, Sparkles } from 'lucide-react'
import { vendor } from '../../data/vendor'
import { PanelHead, glass } from './ui'

const panel = `${glass} absolute top-20 z-10 w-72 p-4`

export default function Scan({ url, progress }: { url: string; progress: number }) {
  const pages = vendor.pages.filter((p) => progress >= p.at)
  const facts = vendor.facts.filter((f) => progress >= f.at)
  const done = progress >= 1
  const status = done ? 'Done' : progress < 0.75 ? `Reading ${url}` : 'Building your floorplan'

  return (
    <>
      <div className="absolute top-20 left-1/2 z-10 w-72 -translate-x-1/2 text-center text-sm">
        <p className="font-medium">{status}</p>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full bg-acme" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <aside className={`${panel} left-5`}>
        <PanelHead icon={FileText} title="Pages" detail={`${pages.length} read`} />
        <ul className="mt-3">
          {pages.map((p, i) => (
            <li key={p.path} className="flex animate-rise items-center gap-2 py-1 text-[13px]">
              {i === pages.length - 1 && !done ? (
                <LoaderCircle size={14} className="shrink-0 animate-spin text-neutral-400" />
              ) : (
                <Check size={14} className="shrink-0 text-emerald-500" />
              )}
              <span className="whitespace-nowrap">{p.path}</span>
              <span className="ml-auto truncate text-xs text-neutral-400">{p.note}</span>
            </li>
          ))}
        </ul>
      </aside>

      <aside className={`${panel} right-5`}>
        <PanelHead icon={Sparkles} title="Understood" detail={`${facts.length} of ${vendor.facts.length}`} />
        <ul className="mt-3 space-y-1.5">
          {facts.map((f) => (
            <li key={f.label} className="animate-rise rounded-2xl bg-white/70 px-3 py-2">
              <p className="text-xs text-neutral-500">{f.label}</p>
              <p className="text-sm font-medium">{f.value}</p>
            </li>
          ))}
        </ul>
      </aside>
    </>
  )
}
