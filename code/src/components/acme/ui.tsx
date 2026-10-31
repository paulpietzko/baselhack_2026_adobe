import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

// Frosted glass with a thin specular top edge
export const glass =
  'rounded-3xl border border-white/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_40px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.04] backdrop-blur-2xl backdrop-saturate-150'
export const cta =
  'flex items-center justify-center gap-1.5 rounded-full bg-acme font-medium text-white transition hover:bg-acme/90'

export const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

export function AcmeLogo() {
  return (
    <span className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#1d1d1f" />
        <path d="M16 8 24.5 24h-4.2L16 15.6 11.7 24H7.5z" fill="#fff" />
      </svg>
      Acme
    </span>
  )
}

export function PanelHead({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon size={15} className="text-neutral-400" />
      <span className="font-semibold">{title}</span>
      {detail && <span className="ml-auto truncate text-xs text-neutral-400">{detail}</span>}
    </div>
  )
}

/** Apple-style segmented control */
export function Seg<T extends string>({ options, value, onChange }: { options: [T, ReactNode][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-[10px] bg-black/[0.06] p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-label={typeof label === 'string' ? undefined : cap(v)}
          aria-pressed={v === value}
          className={`flex h-7 items-center rounded-lg px-2.5 text-xs font-medium transition ${v === value ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** Round color pickers; values are CSS backgrounds so a swatch can show a palette pair */
export function Swatches<T extends string>({ colors, value, onChange }: { colors: Record<T, string>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5">
      {(Object.keys(colors) as T[]).map((k) => (
        <button
          key={k}
          title={cap(k)}
          aria-label={cap(k)}
          onClick={() => onChange(k)}
          style={{ background: colors[k] }}
          className={`size-6 rounded-full ring-offset-2 ring-offset-white transition ${k === value ? 'ring-2 ring-acme' : 'ring-1 ring-black/10 hover:scale-110'}`}
        />
      ))}
    </div>
  )
}
