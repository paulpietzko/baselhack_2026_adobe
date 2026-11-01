import type { FloorId } from './floors'

/** Costumes for tonight (from the story branch's engine/catalog.ts). Hand-written demo data. */
export type OutfitId = 'vampire' | 'skeleton' | 'witch'
export type ColorId = 'crimson' | 'midnight' | 'emerald'
export type Vibe = 'Scary' | 'Funny' | 'Glam'

export const VIBES: Vibe[] = ['Scary', 'Funny', 'Glam']
export const BUDGETS = [50, 100, null]
/** Curated for the demo, not a live forecast */
export const WEATHER = '4°C and dry tonight'

/** Three people are going out; each figure has its own colour until they settle on a look */
export const CREW_TONES = ['#a9bdd8', '#bf5af2', '#0a84ff']

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
}

export const OUTFITS: Outfit[] = [
  {
    id: 'vampire',
    name: 'Vampire noir',
    price: 49,
    vibe: 'Scary',
    tags: ['cape', 'mask', 'tailored', 'black'],
    onFloor: { 'main-hall': 'Check the cape once it gets busy', rooftop: 'The cape is the warmest thing up there' },
  },
  {
    id: 'skeleton',
    name: 'UV skeleton',
    price: 35,
    vibe: 'Funny',
    tags: ['mask', 'bodysuit', 'uv'],
    onFloor: { 'main-hall': 'Glows under the UV rig', rooftop: 'No UV up there, so the bones stay quiet' },
  },
  {
    id: 'witch',
    name: 'Witch couture',
    price: 180,
    vibe: 'Glam',
    tags: ['mask', 'hat', 'dress', 'formal'],
    onFloor: { 'main-hall': 'The hat goes to the coat check', rooftop: 'Pin the hat, it’s windy' },
  },
]

export const outfitById = (id: OutfitId | null) => OUTFITS.find((o) => o.id === id)

/** Reads a plain-language dress code: "No sportswear", "Capes mandatory", "Masks required" */
export function dressCheck(outfit: Pick<Outfit, 'tags'>, dress: string): { ok: boolean; reason: string } {
  const text = dress.toLowerCase()
  const singular = (word: string) => word.replace(/s$/, '')
  const banned = text.match(/\bno\s+([a-zäöü-]+)/)
  if (banned && outfit.tags.includes(singular(banned[1]))) return { ok: false, reason: `The door says: ${dress}` }
  const required = text.match(/\b([a-zäöü-]+)\s+(?:mandatory|required|only)\b/)
  if (required && !outfit.tags.includes(singular(required[1]))) return { ok: false, reason: `The door says: ${dress}` }
  return { ok: true, reason: `Meets the door: ${dress}` }
}
