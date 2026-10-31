/**
 * Seed data for everyone who isn't the club: shops, a casino, other places in town.
 * All fictional or hand-written for the demo, which is why the world graph marks it `curated`,
 * never `owner`. A real deployment would fill this from those businesses' own published records.
 */
export type FloorId = 'main-hall' | 'rooftop' | 'entrance'
export type OutfitId = 'vampire' | 'skeleton' | 'witch'
export type ColorId = 'crimson' | 'midnight' | 'emerald'
export type Vibe = 'Scary' | 'Funny' | 'Glam'

export const VIBES: Vibe[] = ['Scary', 'Funny', 'Glam']
export const BUDGETS = [50, 100, null]
/** Curated for the demo, not a live forecast */
export const WEATHER = '4°C and dry tonight'
export const PEOPLE = 4

/** What each floor adds on top of the published floor plan */
export const FLOOR_EXTRAS: Record<FloorId, { dj: string; bpm: number; light: 'pink' | 'purple' | 'orange'; note: string }> = {
  'main-hall': { dj: 'Nachtmahr b2b Sora', bpm: 134, light: 'pink', note: 'UV rig, lasers, heavy bass' },
  rooftop: { dj: 'Kürbis Disco Club', bpm: 118, light: 'purple', note: 'Open air, with the Sky Bar' },
  entrance: { dj: 'Doors & coats', bpm: 0, light: 'orange', note: 'Coat check until 05:30' },
}

export const COLORS: { id: ColorId; name: string; hex: string }[] = [
  { id: 'crimson', name: 'Crimson', hex: '#c0142f' },
  { id: 'midnight', name: 'Midnight blue', hex: '#2a4fe0' },
  { id: 'emerald', name: 'Emerald', hex: '#0f9a6a' },
]

export type Outfit = {
  id: OutfitId
  name: string
  price: number
  vibe: Vibe
  /** What it's made of, so it can be checked against a dress code */
  tags: string[]
  /** How it plays on each floor: the outfit is always judged against the night it's for */
  onFloor: Record<FloorId, string>
  casino: { ok: boolean; note: string }
}

export const OUTFITS: Outfit[] = [
  {
    id: 'vampire',
    name: 'Vampire noir',
    price: 49,
    vibe: 'Scary',
    tags: ['cape', 'mask', 'tailored', 'black'],
    onFloor: {
      'main-hall': 'Check the cape once it gets busy',
      rooftop: 'The cape is the warmest thing up there',
      entrance: 'Makes the queue photo',
    },
    casino: { ok: true, note: 'Passes as smart dress. Masks come off at the tables.' },
  },
  {
    id: 'skeleton',
    name: 'UV skeleton',
    price: 35,
    vibe: 'Funny',
    tags: ['mask', 'bodysuit', 'uv'],
    onFloor: {
      'main-hall': 'Glows under the UV rig',
      rooftop: 'No UV up there, so the bones stay quiet',
      entrance: 'Save the reveal for upstairs',
    },
    casino: { ok: false, note: 'Too casual for the door. Bring a blazer.' },
  },
  {
    id: 'witch',
    name: 'Witch couture',
    price: 180,
    vibe: 'Glam',
    tags: ['mask', 'hat', 'dress', 'formal'],
    onFloor: {
      'main-hall': 'The hat goes to the coat check',
      rooftop: 'Pin the hat, it’s windy',
      entrance: 'Big entrance, literally',
    },
    casino: { ok: true, note: 'Formal enough. The hat stays at the coat check.' },
  },
]

export type Shop = { id: string; name: string; kind: string; extra: number; stock: string; lngLat: [number, number]; costumesInStock: number }

export const SHOPS: Shop[] = [
  { id: 'maskenkammer', name: 'Maskenkammer', kind: 'Rental, on your way to the club', extra: 0, stock: 'All 4 sizes until 19:30', lngLat: [7.5838, 47.5575], costumesInStock: 12 },
  { id: 'fundus', name: 'Fundus Klybeck', kind: 'Second-hand, 4 min from the club', extra: -8, stock: 'Only 3 costumes left', lngLat: [7.59, 47.579], costumesInStock: 3 },
  { id: 'atelier', name: 'Atelier Rosental', kind: 'Fitted while you wait, by the Messe', extra: 12, stock: 'All 4 sizes until 20:00', lngLat: [7.601, 47.566], costumesInStock: 8 },
]

export type Article = { id: string; name: string; note: string; price: number }

const ACCESSORIES: Record<OutfitId, [Omit<Article, 'id'>, Omit<Article, 'id'>]> = {
  vampire: [
    { name: 'Half mask', note: 'Tonight is masked', price: 12 },
    { name: 'Fangs', note: 'For the full effect', price: 8 },
  ],
  skeleton: [
    { name: 'Skull mask', note: 'Tonight is masked', price: 14 },
    { name: 'Glow paint', note: 'For the UV rig', price: 9 },
  ],
  witch: [
    { name: 'Lace mask', note: 'Tonight is masked', price: 15 },
    { name: 'Hat pins', note: 'For the rooftop wind', price: 6 },
  ],
}

/** The three things a store offers for this look. The price is decided here, never by the caller. */
export function articlesFor(outfit: Outfit, shop: Shop): Article[] {
  const [first, second] = ACCESSORIES[outfit.id]
  return [
    { id: `${outfit.id}-costume`, name: outfit.name, note: 'Full costume', price: outfit.price + shop.extra },
    { id: `${outfit.id}-1`, ...first },
    { id: `${outfit.id}-2`, ...second },
  ]
}

export const DEFAULT_ARTICLE_STOCK = 12

export const CASINO = {
  id: 'casino',
  name: 'Casino Nocturne',
  entry: 10,
  taxi: 6,
  hours: 'Open till 05:00',
  ride: '8 min by taxi from Hafenlicht',
}

/** Other places discovery can consider. `verified` stays false: nobody published these. */
export type Listing = { id: string; name: string; tags: string[]; verified: boolean; hasVenue: boolean }

export const LISTINGS: Listing[] = [
  { id: 'kunstmuseum', name: 'Kunstmuseum Basel', tags: ['daytime', 'art', 'museum', 'culture', 'indoors'], verified: false, hasVenue: false },
  { id: 'rhine', name: 'Rhine Promenade', tags: ['daytime', 'outdoors', 'walk', 'river'], verified: false, hasVenue: false },
  { id: 'spalentor', name: 'Spalentor', tags: ['daytime', 'sights', 'history', 'walk'], verified: false, hasVenue: false },
  { id: 'hexenkessel', name: 'Hexenkessel Bar', tags: ['nightlife', 'tonight', 'halloween', 'drinks'], verified: false, hasVenue: false },
  { id: 'neon-pumpkin', name: 'Neon Pumpkin Rave', tags: ['nightlife', 'tonight', 'halloween', 'dance', 'music'], verified: false, hasVenue: false },
]
