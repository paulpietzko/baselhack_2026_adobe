import { fromProfile, type Business } from '../../engine/business.ts'
import { OUTFITS, SHOPS } from '../../engine/catalog.ts'
import { buildWorld } from '../../engine/world.ts'
import { vendor } from './vendor'

export * from '../../engine/catalog.ts'

/** Four people are going out; each figure has its own colour until they settle on a look */
export const CREW_TONES = ['#d97757', '#bf5af2', '#0a84ff', '#30d158']

const tonight = vendor.facts.find((f) => f.label === 'Tonight')!.value
let club = fromProfile(vendor.profile, vendor.floors, tonight)
let world = buildWorld(club)

/** The world as last published. Starts from the seed and is replaced by the live record from the store. */
export const currentWorld = () => world

/** The club as last published */
export const CLUB = club as Business

export const floorById = (id: string | null) => vendor.floors.find((f) => f.id === id)

/** Takes in the store's record: everything on screen reads from here, so an owner's edit shows up */
export function applyPublished(b: Business) {
  club = b
  world = buildWorld(b)
  Object.assign(CLUB, b)
  for (const f of b.floors) Object.assign(floorById(f.id) ?? {}, { music: f.music, capacity: f.capacity })
}

export const outfitById = (id: string | null) => OUTFITS.find((o) => o.id === id)
export const shopById = (id: string | null) => SHOPS.find((s) => s.id === id)
