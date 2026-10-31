/**
 * The experience composer: journey + world → what should be on screen right now.
 * It picks from a bounded set of views and primitives instead of generating interface code, so the
 * result is always something the renderer can draw and always built from sourced facts.
 * Any renderer can take this spec; the React one lives in src/components/tonight.
 */
import { CASINO, OUTFITS, SHOPS, type FloorId } from './catalog.ts'
import type { Intent } from './intent.ts'
import type { Journey } from './journey.ts'
import { dressCheck, pathBetween, type Provenance, type World } from './world.ts'

export type View = 'city-day' | 'city-night' | 'venue-exterior' | 'venue-interior' | 'try-on' | 'store-selector' | 'store' | 'destination' | 'itinerary'
export type CameraId = 'day' | 'party' | 'venue' | 'shops' | 'store' | 'casino' | 'plan'
export type Primitive = 'venue-hub' | 'outfit-explorer' | 'store-articles' | 'destination-door' | 'itinerary'

export type ExperienceSpec = {
  view: View
  camera: CameraId
  daylight: boolean
  /** The floor the building opens up to, if any */
  openFloor: FloorId | null
  /** The store the camera has zoomed to, if any */
  storeId: string | null
  primitive: Primitive | null
  /** Which places to pin: discovery results, the planned stops, or none */
  places: 'discovery' | 'stores' | 'itinerary' | null
  route: 'to-casino' | 'itinerary' | null
  /** What's been decided, and the way back to each decision. This is what carries across businesses. */
  context: { label: string; go: Intent }[]
  /** One or two natural next steps. The first is also what the mock microphone "hears". */
  next: string[]
  /** Constraints in force, so any business along the way can respect them */
  constraints: Record<string, string | number>
  /** Why the current focus is connected to where the journey started, edge by edge */
  why: { relation: string; source: Provenance['kind']; note?: string }[]
}

function viewOf(j: Journey): View {
  switch (j.scene) {
    case 'basel':
      return 'city-day'
    case 'party':
      return 'city-night'
    case 'venue':
      return j.inside ? 'venue-interior' : 'venue-exterior'
    case 'outfit':
      return 'try-on'
    case 'shop':
      return j.shop ? 'store' : 'store-selector'
    case 'casino':
      return 'destination'
    case 'plan':
      return 'itinerary'
  }
}

const CAMERA: Record<View, CameraId> = {
  'city-day': 'day',
  'city-night': 'party',
  'venue-exterior': 'venue',
  'venue-interior': 'venue',
  'try-on': 'venue',
  'store-selector': 'shops',
  store: 'store',
  destination: 'casino',
  itinerary: 'plan',
}

function nextSteps(j: Journey): string[] {
  switch (j.scene) {
    case 'basel':
      return ['No, something more party. It’s Halloween!']
    case 'party':
      return ['Take us to Hafenlicht']
    case 'venue':
      return j.tile === 'dress' ? ['We need costumes!', 'What’s the music?'] : ['What’s the dress code?', 'What’s the music?', 'Can we get in?']
    case 'outfit':
      return j.outfit === 'witch' ? ['CHF 180? We need money.', 'Let’s go vampire'] : j.outfit ? ['Where can we get it tonight?', 'Witch couture'] : ['Witch couture', 'Let’s go vampire']
    case 'shop':
      return j.shop ? ['Now find us a casino to end the night', ...(j.reserved.length ? [] : ['Show me the other shops'])] : ['Maskenkammer works', 'Atelier Rosental']
    case 'casino':
      return ['Lock in the plan', 'Back to Hafenlicht']
    case 'plan':
      return j.booked ? [] : ['Book it']
  }
}

/** The occasion and everything chosen since: handed on instead of asked for again */
export function constraintsOf(j: Journey, world: World) {
  const outfit = OUTFITS.find((o) => o.id === j.outfit)
  const floor = world.club.floors.find((f) => f.id === j.floor)
  return {
    occasion: 'Halloween',
    city: 'Basel',
    group: 4,
    ...(j.scene !== 'basel' ? { venue: world.club.name, dress_code: world.club.dress } : {}),
    ...(floor ? { floor: floor.name } : {}),
    ...(outfit ? { outfit: outfit.name, outfit_meets_door: String(dressCheck(outfit, world.club.dress).ok) } : {}),
    ...(j.budget ? { budget_chf: j.budget } : {}),
    ...(j.vibe ? { vibe: j.vibe } : {}),
    ...(j.ticketRef ? { tickets: j.ticketRef } : {}),
  }
}

export function compose(j: Journey, world: World): ExperienceSpec {
  const view = viewOf(j)
  const floor = world.club.floors.find((f) => f.id === j.floor)
  const outfit = OUTFITS.find((o) => o.id === j.outfit)
  const shop = SHOPS.find((s) => s.id === j.shop)
  const past = j.scene !== 'basel'
  const primitive: Record<View, Primitive | null> = {
    'city-day': null,
    'city-night': null,
    'venue-exterior': 'venue-hub',
    'venue-interior': 'venue-hub',
    'try-on': 'outfit-explorer',
    'store-selector': null,
    store: 'store-articles',
    destination: 'destination-door',
    itinerary: 'itinerary',
  }
  const focus = j.scene === 'casino' ? CASINO.id : j.scene === 'shop' && j.shop ? j.shop : j.outfit && view === 'try-on' ? j.outfit : null
  const path = focus ? pathBetween(world, world.club.id, focus) : null

  return {
    view,
    camera: CAMERA[view],
    daylight: view === 'city-day',
    openFloor: view === 'venue-interior' || view === 'try-on' ? j.floor : null,
    storeId: view === 'store' ? j.shop : null,
    primitive: primitive[view],
    places: view === 'city-day' || view === 'city-night' ? 'discovery' : view === 'store-selector' ? 'stores' : view === 'itinerary' ? 'itinerary' : null,
    route: view === 'destination' ? 'to-casino' : view === 'itinerary' ? 'itinerary' : null,
    context: [
      { label: 'Basel', go: { kind: 'basel' } as Intent, on: true },
      { label: 'Halloween', go: { kind: 'party' } as Intent, on: past },
      { label: world.club.name, go: { kind: 'venue' } as Intent, on: past && j.scene !== 'party' },
      { label: floor?.name ?? '', go: (floor ? { kind: 'floor', id: floor.id } : { kind: 'venue' }) as Intent, on: !!floor },
      { label: outfit?.name ?? '', go: { kind: 'outfit' } as Intent, on: !!outfit },
      { label: shop?.name ?? '', go: (shop ? { kind: 'pickShop', id: shop.id } : { kind: 'shop' }) as Intent, on: !!shop },
      { label: CASINO.name, go: { kind: 'casino' } as Intent, on: j.casino },
    ]
      .filter((c) => c.on)
      .map(({ label, go }) => ({ label, go })),
    next: nextSteps(j),
    constraints: constraintsOf(j, world),
    why: (path ?? []).map((e) => ({ relation: e.relation, source: e.provenance.kind, ...(e.note ? { note: e.note } : {}) })),
  }
}
