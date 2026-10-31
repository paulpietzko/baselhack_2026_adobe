import type { Light } from '../components/acme/Venue'
import { vendor } from './vendor'

/** The club's floors you can step into from the map (the entrance stays out) */
export type FloorId = 'main-hall' | 'rooftop'

/** What's on each floor tonight (from the story branch's engine/catalog.ts) */
export const FLOOR_EXTRAS: Record<FloorId, { dj: string; bpm: number; light: Light; note: string }> = {
  'main-hall': { dj: 'Nachtmahr b2b Sora', bpm: 134, light: 'pink', note: 'UV rig, lasers, heavy bass' },
  rooftop: { dj: 'Kürbis Disco Club', bpm: 118, light: 'purple', note: 'Open air, with the Sky Bar' },
}

/** Top to bottom, as on the building */
export const FLOORS = vendor.floors.filter((f): f is (typeof vendor.floors)[number] & { id: FloorId } => f.id in FLOOR_EXTRAS)

const profile = (key: string) => vendor.profile.find((p) => p.key === key)?.value ?? ''
const fact = (label: string) => vendor.facts.find((f) => f.label === label)?.value ?? ''

export const HAFENLICHT = {
  name: profile('name'),
  tagline: profile('tagline'),
  dress: profile('dress'),
  age: profile('age'),
  tonight: fact('Tonight').replace('Halloween: ', 'Halloween, '),
}
