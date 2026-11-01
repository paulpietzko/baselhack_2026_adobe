/**
 * Local-search agent: an OpenAI model with tool calling looks up real places in any city (Basel by default)
 * (OpenStreetMap via the free Nominatim API) plus the businesses published through Acme,
 * then recommends a handful. Coordinates always come from the tools, never from the model.
 *
 * Runs server-side only (Vite dev middleware locally, a Vercel function in production),
 * so OPENAI_API_KEY never reaches the browser.
 */
import vendor from '../src/data/vendor.json'

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
  /** Real photo: from OSM/Wikimedia or the place's own website */
  image: string | null
  /** The photo was taken near the place (street or building), not of the place itself */
  imageNearby: boolean
  /** Where "Details" goes: the place's website, else its OpenStreetMap page */
  url: string | null
}
/** area: where it searched, e.g. "Zürich, Switzerland" */
export type SearchResult = { title: string; intro: string; area: string; places: SearchPlace[] }

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini'
type Area = { label: string; viewbox: string } // viewbox: west,north,east,south
const BASEL: Area = { label: 'Basel, Switzerland', viewbox: '7.55,47.60,7.65,47.53' }
const areas = new Map<string, Area>([['basel', BASEL]])
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
// OSM services want an identifiable client
const USER_AGENT = 'baselhack-2026-post-website-demo/1.0 (https://github.com/paulpietzko/baselhack_2026_adobe)'

type Candidate = {
  id: string
  name: string
  lat: number
  lon: number
  verified: boolean
  /** Shown to the model */
  info: Record<string, string>
  /** Raw OSM tags we use for photos and links */
  tags?: Record<string, string>
}

// ─── Tools ───────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Real places from OpenStreetMap via Nominatim (free; 1 request/second per their usage policy) */
/** Bounding box of a city or neighbourhood, looked up once via Nominatim */
async function areaOf(name: string | undefined): Promise<Area> {
  const key = (name ?? '').trim().toLowerCase()
  if (!key) return BASEL
  const known = areas.get(key)
  if (known) return known
  const params = new URLSearchParams({ q: name!, format: 'jsonv2', limit: '1', addressdetails: '1', 'accept-language': 'en' })
  const res = await fetch(`${NOMINATIM}?${params}`, { headers: { 'User-Agent': USER_AGENT } })
  const [hit] = res.ok ? ((await res.json()) as { name: string; boundingbox: string[]; address?: { country?: string } }[]) : []
  if (!hit) throw new Error(`Unknown place: ${name}`)
  const [south, north, west, east] = hit.boundingbox
  const area = { label: [hit.name, hit.address?.country].filter(Boolean).join(', '), viewbox: `${west},${north},${east},${south}` }
  areas.set(key, area)
  await sleep(1100) // Nominatim: one request per second
  return area
}

async function searchPlaces(phrases: string[], area: Area): Promise<Candidate[]> {
  const found: Candidate[] = []
  for (const [i, q] of phrases.slice(0, 3).entries()) {
    if (i) await sleep(1100)
    const params = new URLSearchParams({ q, format: 'jsonv2', viewbox: area.viewbox, bounded: '1', limit: '30', extratags: '1' })
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
      found.push({ id: `${r.osm_type}/${r.osm_id}`, name: r.name, lat: +r.lat, lon: +r.lon, verified: false, info, tags: extra })
    }
  }
  return found
}

/** Businesses that published themselves through Acme (see the vendor portal): owner-verified */
function acmeListings(): Candidate[] {
  const field = (key: string) => vendor.profile.find((f) => f.key === key)?.value ?? ''
  return [
    {
      id: 'acme/hafenlicht',
      name: field('name'),
      lat: 47.5745,
      lon: 7.5915,
      verified: true,
      info: {
        kind: 'Rooftop club, techno & house',
        tagline: field('tagline'),
        hours: field('hours'),
        entry: field('entry'),
        age: field('age'),
        tonight: vendor.facts.find((f) => f.label === 'Tonight')?.value ?? '',
        floors: vendor.floors.map((f) => `${f.name} (${f.music})`).join(', '),
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
        'Find real, named places from OpenStreetMap. Pass 1–3 English category phrases in plural, e.g. "clothes shops", "shoe shops", "second hand shops", "night clubs", "bars", "pubs", "restaurants", "italian restaurants", "cafes", "bakeries", "museums", "cinemas", "parks" – or a business name. Pass the city (or neighbourhood) to search in as `area`, e.g. "Zürich"; leave it empty for Basel.',
      parameters: {
        type: 'object',
        properties: { phrases: { type: 'array', items: { type: 'string' } }, area: { type: 'string' } },
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
        'Businesses in Basel that publish their own verified data (hours, prices, tonight’s events) through Acme. Check this for nightlife, going out and events in Basel.',
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

/** `onStep` hears what the agent is looking up right now, e.g. "night clubs, bars" */
export async function search(query: string, onStep?: (label: string) => void): Promise<SearchResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set')
  const candidates = new Map<string, Candidate>()
  let area = BASEL // where the last place search ran
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Zurich', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  const messages: Message[] = [
    {
      role: 'system',
      content: `You are a local guide inside a chat assistant. The user is in Basel, Switzerland, unless they ask about another place. It is ${now} (Halloween).
Find places that genuinely match the request using the tools: search_places for real places (with the asked city as \`area\`), and acme_listings when it is about going out in Basel.
Then recommend 3 to 6 places, spread over the area when possible, and only ids you got from a tool. Never recommend places outside the place the user asked about.
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
      let found: Candidate[] = []
      try {
        const args = call.function.name === 'search_places' ? (JSON.parse(call.function.arguments) as { phrases?: string[]; area?: string }) : {}
        const phrases = args.phrases ?? []
        if (phrases.length) {
          area = await areaOf(args.area)
          onStep?.(`${phrases.join(', ')} in ${area.label.split(',')[0]}`)
          found = await searchPlaces(phrases, area)
        } else {
          onStep?.('verified Acme listings')
          found = acmeListings()
        }
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

  // Keep only real candidates; their name and coordinates come from the data source. Photos and links in parallel.
  const picks = answer.places.slice(0, 6).flatMap((p) => {
    const c = candidates.get(p.id)
    return c ? [{ p, c }] : []
  })
  const places = await Promise.all(
    picks.map(async ({ p, c }) => ({
      ...p,
      name: c.name,
      lngLat: [c.lon, c.lat] as [number, number],
      verified: c.verified,
      ...(await photoAndLink(c)),
      imageNearby: false,
    })),
  )
  return { title: answer.title, intro: answer.intro, area: area.label, places }
}

// ─── Photos & links ──────────────────────────────────────────────────────────

const commonsFile = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/^File:/, ''))}?width=480`

function websiteOf(c: Candidate): string | null {
  const site = c.tags?.website ?? c.tags?.['contact:website'] ?? c.tags?.url
  if (!site) return null
  return /^https?:\/\//.test(site) ? site : `https://${site}`
}

async function fetchWithin<T>(url: string, ms: number, read: (r: Response) => Promise<T>): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(ms), redirect: 'follow' })
    return res.ok ? await read(res) : null
  } catch {
    return null
  }
}

type Claims = Record<string, { mainsnak: { datavalue?: { value: unknown } } }[]>

/** Image (P18) and official website (P856) of a Wikidata item, e.g. a landmark or a shop's brand */
async function wikidata(id: string | undefined) {
  if (!/^Q\d+$/.test(id ?? '')) return null
  return fetchWithin(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`, 2500, async (r) => {
    const claims = ((await r.json()) as { entities: Record<string, { claims?: Claims }> }).entities[id!]?.claims ?? {}
    const first = (p: string) => claims[p]?.[0]?.mainsnak.datavalue?.value as string | undefined
    return { image: first('P18'), website: first('P856') }
  })
}

/**
 * Link and first own photo we can find: OSM image tag → Wikimedia Commons → Wikidata of the place → website preview.
 * A brand's Wikidata only gives the link: its photo is usually the headquarters, not this shop.
 */
async function photoAndLink(c: Candidate): Promise<{ image: string | null; url: string | null }> {
  const t = c.tags ?? {}
  const place = await wikidata(t.wikidata)
  const brand = place ? null : await wikidata(t['brand:wikidata'])
  const website = websiteOf(c) ?? place?.website ?? brand?.website ?? null
  const url = website ?? (c.id.startsWith('acme/') ? null : `https://www.openstreetmap.org/${c.id}`)
  const image =
    (/^https?:\/\//.test(t.image ?? '') ? t.image : null) ??
    (t.wikimedia_commons?.startsWith('File:') ? commonsFile(t.wikimedia_commons) : null) ??
    (place?.image ? commonsFile(place.image) : null) ??
    (website ? await previewImage(website) : null)
  return { image, url }
}

const COMMONS = 'https://commons.wikimedia.org/w/api.php'

/**
 * Street photos for places that found no photo of their own: id → free Commons photo taken within 150 m.
 * Slow (Commons search takes seconds and is sometimes busy), so the API sends these after the result.
 */
export async function nearbyFor(places: SearchPlace[]): Promise<Record<string, string>> {
  const missing = places.filter((p) => !p.image && !p.verified)
  const photos = await nearbyPhotos(missing.map((p) => p.lngLat))
  return Object.fromEntries(missing.flatMap((p, i) => (photos[i] ? [[p.id, photos[i]]] : [])))
}

/**
 * For each point, a free Commons photo taken within 150 m, different ones where possible.
 * Commons rate-limits bursts, so: light geosearches two at a time, then one request for the chosen thumbnails.
 */
async function nearbyPhotos(points: [number, number][]): Promise<(string | null)[]> {
  const nearest = async ([lon, lat]: [number, number]) => {
    const params = new URLSearchParams({ action: 'query', list: 'geosearch', gscoord: `${lat}|${lon}`, gsradius: '150', gsnamespace: '6', gslimit: '6', format: 'json' })
    const once = () =>
      fetchWithin(`${COMMONS}?${params}`, 4000, async (r) =>
        ((await r.json()) as { query?: { geosearch: { title: string }[] } }).query?.geosearch.map((g) => g.title).filter((t) => /\.(jpe?g|png|webp)$/i.test(t)),
      )
    // null means throttled or failed: one more try after a short pause
    return (await once()) ?? (await sleep(800).then(once)) ?? []
  }
  const candidates: string[][] = []
  for (let i = 0; i < points.length; i += 2) candidates.push(...(await Promise.all(points.slice(i, i + 2).map(nearest))))

  // Prefer a different photo for each place
  const used = new Set<string>()
  const titles = candidates.map((list) => {
    const pick = list.find((t) => !used.has(t)) ?? list[0] ?? null
    if (pick) used.add(pick)
    return pick
  })
  const wanted = [...new Set(titles.filter(Boolean))] as string[]
  if (!wanted.length) return titles.map(() => null)
  const params = new URLSearchParams({ action: 'query', titles: wanted.join('|'), prop: 'imageinfo', iiprop: 'url', iiurlwidth: '480', format: 'json' })
  const thumbs =
    (await fetchWithin(`${COMMONS}?${params}`, 5000, async (r) => {
      const pages = Object.values(((await r.json()) as { query?: { pages: Record<string, { title: string; imageinfo?: { thumburl: string }[] }> } }).query?.pages ?? {})
      return new Map(pages.map((p) => [p.title, p.imageinfo?.[0]?.thumburl ?? null]))
    })) ?? new Map()
  return titles.map((t) => (t ? (thumbs.get(t) ?? null) : null))
}

/** The share image a site declares for itself (og:image / twitter:image) */
function previewImage(website: string) {
  return fetchWithin(website, 3500, async (r) => {
    const html = (await r.text()).slice(0, 300_000)
    const meta =
      html.match(/<meta[^>]+(?:property|name|itemprop)=["'](?:og:image(?::secure_url)?|twitter:image|image)["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["'](?:og:image|twitter:image|image)["']/i)?.[1] ??
      html.match(/<link[^>]+rel=["']image_src["'][^>]*href=["']([^"']+)["']/i)?.[1]
    // Some sites ship broken tags like content="undefined"
    if (!meta || !/^(https?:)?\/|^[\w-]+\.(jpe?g|png|webp)/i.test(meta.trim())) return null
    return new URL(meta.replace(/&amp;/g, '&'), r.url).href
  })
}
