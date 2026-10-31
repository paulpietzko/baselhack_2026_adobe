import { user } from '.'
import { vendor } from './vendor'

export type CrewId = 'you' | 'mia' | 'leo' | 'noa'
export type FloorId = 'main-hall' | 'rooftop' | 'entrance'
export type OutfitId = 'vampire' | 'skeleton' | 'witch'
export type ColorId = 'crimson' | 'midnight' | 'emerald'

export const CREW: { id: CrewId; name: string; initials: string; color: string }[] = [
  { id: 'you', name: 'You', initials: user.initials, color: '#d97757' },
  { id: 'mia', name: 'Mia', initials: 'MI', color: '#bf5af2' },
  { id: 'leo', name: 'Leo', initials: 'LE', color: '#0a84ff' },
  { id: 'noa', name: 'Noa', initials: 'NO', color: '#30d158' },
]

// Hafenlicht comes straight from what the club published in the vendor portal
const field = (key: string) => vendor.profile.find((f) => f.key === key)!.value
export const CLUB = {
  name: field('name'),
  tagline: field('tagline'),
  entry: field('entry'),
  dress: field('dress'),
  age: field('age'),
  tonight: vendor.facts.find((f) => f.label === 'Tonight')!.value,
  presale: 20,
}
export const floorById = (id: string | null) => vendor.floors.find((f) => f.id === id)

/** What each floor adds on top of the published floor plan */
export const FLOOR_EXTRAS: Record<FloorId, { dj: string; bpm: number; light: 'pink' | 'purple' | 'orange'; crowd: number[]; note: string }> = {
  'main-hall': { dj: 'Nachtmahr b2b Sora', bpm: 134, light: 'pink', crowd: [25, 55, 90, 100, 70], note: 'UV rig, lasers, heavy bass' },
  rooftop: { dj: 'Kürbis Disco Club', bpm: 118, light: 'purple', crowd: [40, 75, 85, 60, 30], note: 'Open air, 4°C, Sky Bar' },
  entrance: { dj: 'Doors & coats', bpm: 0, light: 'orange', crowd: [70, 50, 25, 15, 10], note: 'Coat check closes at 05:30' },
}
export const CROWD_HOURS = ['23', '00', '01', '02', '03']

export const FLOOR_VOTES: Partial<Record<CrewId, FloorId>> = { mia: 'rooftop', leo: 'main-hall', noa: 'main-hall' }
export const OUTFIT_VOTES: Partial<Record<CrewId, OutfitId>> = { mia: 'vampire', leo: 'skeleton', noa: 'vampire' }

export const COLORS: { id: ColorId; name: string; hex: string }[] = [
  { id: 'crimson', name: 'Crimson', hex: '#c0142f' },
  { id: 'midnight', name: 'Midnight blue', hex: '#2a4fe0' },
  { id: 'emerald', name: 'Emerald', hex: '#0f9a6a' },
]

export const OUTFITS: {
  id: OutfitId
  name: string
  price: number
  blurb: string
  /** How it plays on each floor: the outfit is always judged against the night it's for */
  onFloor: Record<FloorId, string>
  casino: { ok: boolean; note: string }
}[] = [
  {
    id: 'vampire',
    name: 'Vampire noir',
    price: 49,
    blurb: 'Tailored black, a lined cape and a half mask.',
    onFloor: {
      'main-hall': 'Cape stays clear of the crowd if you check it by 01:00',
      rooftop: 'The cape is the warmest thing up there',
      entrance: 'Makes the queue photo',
    },
    casino: { ok: true, note: 'Tailored black passes as smart dress. Mask comes off at the tables.' },
  },
  {
    id: 'skeleton',
    name: 'UV skeleton',
    price: 35,
    blurb: 'Blacked-out suit with bones that glow under UV.',
    onFloor: {
      'main-hall': 'Glows under the Main Hall UV rig',
      rooftop: 'No UV up there, so the bones stay quiet',
      entrance: 'Lobby is daylight-white, so save the reveal',
    },
    casino: { ok: false, note: 'Too casual for the door. Bring a blazer to layer over it.' },
  },
  {
    id: 'witch',
    name: 'Witch couture',
    price: 65,
    blurb: 'Long dress, wide-brim hat and a mask to match.',
    onFloor: {
      'main-hall': 'Hat goes to the coat check once it gets busy',
      rooftop: 'Wind warning: pin the hat',
      entrance: 'Big entrance, literally',
    },
    casino: { ok: true, note: 'Formal enough for the door. The hat stays at the coat check.' },
  },
]
export const outfitById = (id: string | null) => OUTFITS.find((o) => o.id === id)

export const BUDGET_DISCOUNT = 10

export const SHOPS: { id: string; name: string; kind: string; extra: number; stock: string; detail: string; lngLat?: [number, number] }[] = [
  { id: 'maskenkammer', name: 'Maskenkammer', kind: 'Rental · Spalenberg', extra: 0, stock: 'All 4 sizes held until 19:30', detail: 'Pick up on the way to Hafenlicht', lngLat: [7.5838, 47.5575] },
  { id: 'fundus', name: 'Fundus Klybeck', kind: 'Second-hand · 4 min from the club', extra: -8, stock: '3 of 4 sizes, Leo’s is missing', detail: 'Cheapest, but one of you improvises', lngLat: [7.59, 47.579] },
  { id: 'nachtkurier', name: 'Nachtkurier', kind: 'Courier · to your door', extra: 12, stock: 'All 4 sizes, delivered by 20:30', detail: 'Get ready together at home' },
]
export const shopById = (id: string | null) => SHOPS.find((s) => s.id === id)

export const CASINO = {
  name: 'Casino Nocturne',
  entry: 10,
  hours: 'Open till 05:00',
  ride: '8 min by taxi from Hafenlicht, CHF 6 each',
  tables: ['Roulette from CHF 2', 'Poker room, 03:00 seat for 4', 'Halloween slots lounge'],
}
