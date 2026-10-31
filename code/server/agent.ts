/**
 * Local-search agent: an OpenAI model with tool calling looks up real places in Basel
 * (OpenStreetMap via the free Nominatim API) plus the businesses published through Acme,
 * then recommends a handful. Coordinates always come from the tools, never from the model.
 *
 * Runs server-side only (Vite dev middleware locally, a Vercel function in production),
 * so OPENAI_API_KEY never reaches the browser.
 */
import { rank, type Ranked } from '../engine/rank.ts'
import { getBusiness, getWorld } from './business.ts'

export const ICONS = [
  'shirt',
  'shopping-bag',
  'martini',
  'beer',
  'utensils',
  'coffee',
  'music',
  'ghost',
  'landmark',
  'ticket',
  'trees',
  'building',
] as const
export type Icon = (typeof ICONS)[number]

export type SearchPlace = {
  id: string
  name: string
  lngLat: [number, number]
  icon: Icon
  tag: string
  description: string
  time: string | null
  /** Published by the owner through Acme */
  verified: boolean
}
export type SearchResult = {
  title: string
  intro: string
  places: SearchPlace[]
  /** live: the model chose these tool calls. offline: no model available, so only the listing lookup ran */
  mode: 'live' | 'offline'
  calls: string[]
  /** offline only: the engine's ranking, with its reasons */
  ranked?: Ranked[]
}

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini'
// Basel city: west,north,east,south
const VIEWBOX = '7.55,47.60,7.65,47.53'
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
// OSM services want an identifiable client
const USER_AGENT = 'baselhack-2026-post-website-demo/1.0'

type Candidate = { id: string; name: string; lat: number; lon: number; verified: boolean; info: Record<string, string> }

// ─── Tools ───────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Real places from OpenStreetMap via Nominatim (free; 1 request/second per their usage policy) */
async function searchPlaces(phrases: string[]): Promise<Candidate[]> {
  const found: Candidate[] = []
  for (const [i, q] of phrases.slice(0, 3).entries()) {
    if (i) await sleep(1100)
    const params = new URLSearchParams({ q, format: 'jsonv2', viewbox: VIEWBOX, bounded: '1', limit: '30', extratags: '1' })
    const res = await fetch(`${NOMINATIM}?${params}`, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) throw new Error(`Nominatim ${res.status}`)
    const rows = (await res.json()) as {
      osm_type: string
      osm_id: number
      name: string
      lat: string
      lon: string
      category: string
      type: string
      extratags?: Record<string, string> | null
    }[]
    for (const r of rows) {
      if (!r.name) continue
      const extra = r.extratags ?? {}
      const info: Record<string, string> = { kind: `${r.category}/${r.type}` }
      for (const k of ['opening_hours', 'cuisine', 'website']) if (extra[k]) info[k] = extra[k]
      found.push({ id: `${r.osm_type}/${r.osm_id}`, name: r.name, lat: +r.lat, lon: +r.lon, verified: false, info })
    }
  }
  return found
}

/** Businesses that published themselves through Acme (see the vendor portal): owner-verified */
function acmeListings(): Candidate[] {
  const b = getBusiness()
  return [
    {
      id: b.id,
      name: b.name,
      lat: 47.5835,
      lon: 7.5925,
      verified: true,
      info: {
        kind: 'Rooftop club, techno & house',
        tagline: b.tagline,
        hours: b.hours,
        entry: b.entry,
        age: b.age,
        dress_code: b.dress,
        tonight: b.tonight,
        floors: b.floors.map((f) => `${f.name} (${f.music})`).join(', '),
        published_at: b.publishedAt,
      },
    },
  ]
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_places',
      description:
        'Find real, named places in Basel from OpenStreetMap. Pass 1–3 English category phrases in plural, e.g. "clothes shops", "shoe shops", "second hand shops", "night clubs", "bars", "pubs", "restaurants", "italian restaurants", "cafes", "bakeries", "museums", "cinemas", "parks" – or a business name.',
      parameters: {
        type: 'object',
        properties: { phrases: { type: 'array', items: { type: 'string' } } },
        required: ['phrases'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'acme_listings',
      description:
        'Businesses that publish their own verified data (hours, prices, tonight’s events) through Acme. Check this for nightlife, going out and events.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
]

// ─── Agent ───────────────────────────────────────────────────────────────────

type Message = { role: string; content?: string | null; tool_calls?: ToolCall[]; tool_call_id?: string }
type ToolCall = { id: string; function: { name: string; arguments: string } }

async function chat(body: Record<string, unknown>) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, ...body }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  return ((await res.json()) as { choices: { message: Message }[] }).choices[0].message
}

const ANSWER_SCHEMA = {
  name: 'recommendations',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'intro', 'places'],
    properties: {
      title: { type: 'string', description: 'Short heading, max 8 words' },
      intro: { type: 'string', description: 'One friendly sentence' },
      places: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'tag', 'description', 'time', 'icon'],
          properties: {
            id: { type: 'string', description: 'id of a candidate returned by a tool' },
            tag: { type: 'string', description: 'Max 3 words' },
            description: { type: 'string', description: 'Why it fits, max 12 words' },
            time: { type: ['string', 'null'], description: 'Short opening time or event time, e.g. "Open till 18:30" or "23:00"' },
            icon: { type: 'string', enum: ICONS },
          },
        },
      },
    },
  },
}

export async function search(query: string): Promise<SearchResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set')
  const candidates = new Map<string, Candidate>()
  const calls: string[] = []
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Zurich', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  const messages: Message[] = [
    {
      role: 'system',
      content: `You are a local guide inside a chat assistant. The user is in Basel, Switzerland. It is ${now} (Halloween).
Find places that genuinely match the request using the tools: search_places for real places, and acme_listings when it is about going out or tonight.
Then recommend 3 to 6 places, spread over the city when possible, and only ids you got from a tool.
Prefer places whose opening hours fit the request. Acme listings are verified by their owners; include them when they fit.
Answer in the language of the user's message.`,
    },
    { role: 'user', content: query },
  ]

  // Tool loop: the model decides what to look up
  for (let step = 0; step < 4; step++) {
    const reply = await chat({ messages, tools: TOOLS, tool_choice: step === 0 ? 'required' : 'auto' })
    messages.push(reply)
    if (!reply.tool_calls?.length) break
    for (const call of reply.tool_calls) {
      calls.push(call.function.name)
      let found: Candidate[] = []
      try {
        found =
          call.function.name === 'search_places'
            ? await searchPlaces(JSON.parse(call.function.arguments).phrases ?? [])
            : acmeListings()
      } catch (e) {
        messages.push({ role: 'tool', tool_call_id: call.id, content: `Error: ${(e as Error).message}` })
        continue
      }
      found.forEach((c) => candidates.set(c.id, c))
      const brief = found.slice(0, 40).map(({ id, name, info, verified }) => ({ id, name, verified, ...info }))
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(brief) })
    }
  }

  // Final answer as structured JSON
  messages.push({ role: 'user', content: 'Now give your recommendations.' })
  const final = await chat({ messages, response_format: { type: 'json_schema', json_schema: ANSWER_SCHEMA } })
  const answer = JSON.parse(final.content ?? '{}') as {
    title: string
    intro: string
    places: { id: string; tag: string; description: string; time: string | null; icon: Icon }[]
  }

  // Keep only real candidates; their name and coordinates come from the data source
  const places = answer.places.slice(0, 6).flatMap((p) => {
    const c = candidates.get(p.id)
    return c ? [{ ...p, name: c.name, lngLat: [c.lon, c.lat] as [number, number], verified: c.verified }] : []
  })
  return { title: answer.title, intro: answer.intro, places, mode: 'live', calls }
}

/** Runs the real agent when there's a key. Without one it says so, and the UI labels the picks as demo data. */
export async function discover(query: string): Promise<SearchResult> {
  if (process.env.OPENAI_API_KEY) return search(query)
  const b = getBusiness()
  const ranked = rank(getWorld(), query)
  const found = ranked.some((r) => r.id === b.id)
  return { title: '', intro: found ? `${b.name} published tonight's event through Acme: ${b.tonight}.` : '', places: [], mode: 'offline', calls: ['rank'], ranked }
}
