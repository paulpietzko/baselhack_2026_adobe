import {
  Beer,
  Building2,
  Coffee,
  Ghost,
  Landmark,
  Martini,
  Music,
  Shirt,
  ShoppingBag,
  Ticket,
  Trees,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import type { Icon, SearchResult } from '../../server/agent'
import type { Place } from './basel'

// Card header per icon the agent can pick: [icon, tint, icon colour]
const LOOKS: Record<Icon, [LucideIcon, string, string]> = {
  shirt: [Shirt, '#2c2840', '#a99ff0'],
  'shopping-bag': [ShoppingBag, '#2e3440', '#9fc3f0'],
  martini: [Martini, '#3a2433', '#e09ac4'],
  beer: [Beer, '#40331f', '#f0c06e'],
  utensils: [Utensils, '#4a3222', '#e8a571'],
  coffee: [Coffee, '#3d2f26', '#d9b08c'],
  music: [Music, '#2e2240', '#c39af0'],
  ghost: [Ghost, '#2e2240', '#f0a050'],
  landmark: [Landmark, '#26343a', '#8fd0d8'],
  ticket: [Ticket, '#402626', '#f09a8a'],
  trees: [Trees, '#223a2a', '#8fd8a0'],
  building: [Building2, '#4a2226', '#e8828a'],
}

export type Answer = { title: string; intro: string; places: Place[] }

/**
 * Ask the search agent (server route, see server/agent.ts) and turn its picks into map cards.
 * `onStep` gets each live search step, e.g. "night clubs, bars".
 */
export async function searchPlaces(query: string, onStep: (label: string) => void, signal?: AbortSignal): Promise<Answer> {
  const res = await fetch('/api/search', { method: 'POST', body: JSON.stringify({ query }), signal })
  if (!res.body) throw new Error(`Search failed (${res.status})`)

  // Newline-delimited JSON events: {step} while searching, then {result} or {error}
  let data: SearchResult | undefined
  let buffer = ''
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  for (;;) {
    const { value, done } = await reader.read()
    buffer += value ?? ''
    const lines = buffer.split('\n')
    // Keep a partial last line for the next chunk; at the end, it's the last event (or a plain JSON error)
    buffer = done ? '' : lines.pop()!
    for (const line of lines.filter(Boolean)) {
      const event = JSON.parse(line) as { step?: string; result?: SearchResult; error?: string }
      if (event.error) throw new Error(event.error)
      if (event.step) onStep(event.step)
      if (event.result) data = event.result
    }
    if (done) break
  }
  if (!data) throw new Error(`Search failed (${res.status})`)

  // Cards point away from the middle of the group, so they fan out around their pins
  const cx = data.places.reduce((s, p) => s + p.lngLat[0], 0) / (data.places.length || 1)
  const cy = data.places.reduce((s, p) => s + p.lngLat[1], 0) / (data.places.length || 1)

  return {
    title: data.title,
    intro: data.intro,
    places: data.places.map((p) => {
      const [icon, tint, iconColor] = LOOKS[p.icon] ?? LOOKS.building
      const dx = p.lngLat[0] - cx
      const dy = cy - p.lngLat[1] // screen y grows downwards
      return {
        id: p.id,
        name: p.name,
        time: p.time ?? '',
        tag: p.tag,
        description: p.description,
        lngLat: p.lngLat,
        icon,
        tint,
        iconColor,
        verified: p.verified,
        image: p.image ?? undefined,
        url: p.url ?? undefined,
        cardAngle: dx || dy ? (Math.atan2(dy, dx) * 180) / Math.PI : -90,
        cardDistance: 150,
      }
    }),
  }
}
