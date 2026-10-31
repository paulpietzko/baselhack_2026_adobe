import { ExternalLink } from 'lucide-react'
import type { Embed } from '../data'

// Relative srcs point to local widgets in /public/embeds, absolute ones to the open web
const resolve = (src: string) => (src.startsWith('http') ? src : import.meta.env.BASE_URL + src)

export default function EmbedFrame({ title, src, height }: Embed) {
  const url = resolve(src)
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border bg-white">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-sm">
        <span className="font-medium">{title}</span>
        <a href={url} target="_blank" className="text-muted hover:text-ink">
          <ExternalLink size={15} />
        </a>
      </div>
      <iframe src={url} title={title} style={{ height }} className="block w-full" />
    </div>
  )
}
