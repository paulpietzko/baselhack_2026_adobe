import { useState } from 'react'
import { ChevronRight, Globe } from 'lucide-react'
import { vendor } from '../../data/vendor'
import { cta, glass } from './ui'

export default function Connect({ onScan, onManual }: { onScan: (url: string) => void; onManual: () => void }) {
  const [url, setUrl] = useState('')

  return (
    <main className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
      <div className="pointer-events-auto flex w-full max-w-2xl animate-rise flex-col items-center">
        <p className="mb-3 text-sm font-semibold text-acme">Acme for Clubs</p>
        <h1 className="text-6xl leading-[1.05] font-semibold tracking-tight">
          Your club.
          <br />
          <span className="text-neutral-400">Ready for AI.</span>
        </h1>
        <p className="mt-5 max-w-md text-lg leading-snug text-neutral-500">
          Paste your website. We read every page and rebuild your floors in 3D, so guests find you right in Claude.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onScan(url.trim() || vendor.demoUrl)
          }}
          className={`${glass} mt-9 flex w-full max-w-lg items-center gap-2 rounded-full p-1.5 pl-5`}
        >
          <Globe size={17} className="shrink-0 text-neutral-400" />
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={vendor.demoUrl}
            aria-label="Website address"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
          />
          <button className={`${cta} h-10 px-5 text-sm`}>Continue</button>
        </form>
        <button onClick={onManual} className="mt-5 flex items-center text-sm text-acme hover:underline">
          No website? Set it up by hand <ChevronRight size={15} />
        </button>
      </div>
    </main>
  )
}
