/**
 * The personal journey: what this group has decided so far, and how each intent changes it.
 * The world graph is shared and stable; this is temporary and belongs to one night out.
 */
import { CASINO, COLORS, FLOOR_EXTRAS, OUTFITS, PEOPLE, SHOPS, type Article, type ColorId, type FloorId, type OutfitId, type Vibe } from './catalog.ts'
import type { Intent, TileId } from './intent.ts'
import type { World } from './world.ts'

export type SceneId = 'basel' | 'party' | 'venue' | 'outfit' | 'shop' | 'casino' | 'plan'

/** Everything decided so far. It travels from scene to scene, no page ever forgets it. */
export type Journey = {
  scene: SceneId
  floor: FloorId | null
  /** Looking into the floor, as opposed to the whole building */
  inside: boolean
  /** Which of the club's four tiles is open */
  tile: TileId | null
  outfit: OutfitId | null
  color: ColorId
  budget: number | null
  vibe: Vibe | null
  /** The real confirmation from the club's system */
  ticketRef: string | null
  shop: string | null
  /** What's actually on hold at the store, per person, with the store's confirmation */
  reserved: (Article & { ref: string })[]
  casino: boolean
  booked: boolean
}

export const START: Journey = {
  scene: 'basel',
  floor: null,
  inside: false,
  tile: null,
  outfit: null,
  color: 'crimson',
  budget: null,
  vibe: null,
  ticketRef: null,
  shop: null,
  reserved: [],
  casino: false,
  booked: false,
}

export const BASEL_TITLE = 'A few places for your day in Basel'

const BACK: Record<SceneId, SceneId> = { basel: 'basel', party: 'basel', venue: 'party', outfit: 'venue', shop: 'outfit', casino: 'venue', plan: 'casino' }

const outfitOf = (id: string | null) => OUTFITS.find((o) => o.id === id)
const shopOf = (id: string | null) => SHOPS.find((s) => s.id === id)

export const unitPrice = (j: Journey) => {
  const base = outfitOf(j.outfit)?.price ?? 0
  const extras = j.reserved.filter((a) => !a.id.endsWith('-costume')).reduce((sum, a) => sum + a.price, 0)
  return base ? base + (shopOf(j.shop)?.extra ?? 0) + extras : 0
}

/** Per person: costume, club entry, casino entry and the taxi between them */
export const perPerson = (j: Journey, world: World) => unitPrice(j) + world.club.presale + (j.casino ? CASINO.entry + CASINO.taxi : 0)

/** The state change and the one line that goes with it. Every reply leans on what's already been decided. */
export function reduce(j: Journey, intent: Intent, world: World): { patch: Partial<Journey>; reply: string } {
  const club = world.club
  const floorOf = (id: string | null) => club.floors.find((f) => f.id === id)
  switch (intent.kind) {
    case 'basel':
      return { patch: { scene: 'basel' }, reply: BASEL_TITLE }
    case 'party':
      return { patch: { scene: 'party' }, reply: `Looking for what's on tonight…` }
    case 'peek':
      return {
        patch: {},
        reply: j.scene === 'basel' ? `${intent.name} is a lovely way to spend the day.` : `${intent.name} hasn't published its venue yet. ${club.name} has.`,
      }
    case 'venue':
      return { patch: { scene: 'venue', inside: false }, reply: `${club.name}: ${club.tagline}. Where do you want to look first?` }
    case 'floor':
      return { patch: { scene: 'venue', floor: intent.id, inside: true }, reply: `You're on the ${floorOf(intent.id)?.name}. ${FLOOR_EXTRAS[intent.id].note}.` }
    case 'music': {
      const id = j.floor ?? 'main-hall'
      return { patch: { scene: 'venue', floor: id, inside: true, tile: 'music' }, reply: `${FLOOR_EXTRAS[id].dj} on the ${floorOf(id)?.name} tonight.` }
    }
    case 'outfit': {
      const id = j.floor ?? 'main-hall'
      return {
        patch: { scene: 'outfit', floor: id, inside: true },
        reply: `So we need costumes. Same night, same crew: here's how each look works on the ${floorOf(id)?.name}.`,
      }
    }
    case 'pick': {
      const id = j.floor ?? 'main-hall'
      const outfit = outfitOf(intent.id)!
      return { patch: { scene: 'outfit', floor: id, inside: true, outfit: intent.id }, reply: `${outfit.name}. ${outfit.onFloor[id]}.` }
    }
    case 'color': {
      const name = COLORS.find((c) => c.id === intent.id)!.name
      return { patch: { scene: 'outfit', color: intent.id, floor: j.floor ?? 'main-hall', inside: true }, reply: `${name}, under the lights you'll actually be in.` }
    }
    case 'shop':
      if (!j.outfit) return { patch: { scene: 'outfit', floor: j.floor ?? 'main-hall', inside: true }, reply: 'Pick a look first, then I can check who has all four sizes.' }
      if (j.reserved.length && j.shop) return { patch: { scene: 'shop', inside: false }, reply: `You've got things on hold at ${shopOf(j.shop)?.name}.` }
      return { patch: { scene: 'shop', shop: null, inside: false }, reply: `Three stores have ${outfitOf(j.outfit)!.name} tonight. Same night, same plan.` }
    case 'pickShop': {
      const shop = shopOf(intent.id)!
      return {
        patch: { scene: 'shop', shop: intent.id, inside: false, floor: j.floor ?? 'main-hall', outfit: j.outfit ?? 'vampire' },
        reply: `${shop.name}. ${shop.stock}. Here's what they have for your look.`,
      }
    }
    case 'casino': {
      const outfit = outfitOf(j.outfit)
      return {
        patch: { scene: 'casino', casino: true, inside: false },
        reply: `${CASINO.name}, ${CASINO.ride}. ${outfit ? `${outfit.name}: ${outfit.casino.note}` : 'The door wants smart dress.'}`,
      }
    }
    case 'plan': {
      const missing = [!j.floor && 'a floor', !j.outfit && 'outfits', !j.casino && 'the last stop'].filter(Boolean)
      return { patch: { scene: 'plan', inside: false }, reply: missing.length ? `Your night so far. Still open: ${missing.join(', ')}.` : 'Your whole night: one route, one price.' }
    }
    case 'tile': {
      const open = intent.id && j.tile !== intent.id ? intent.id : null
      const replies = {
        music: `${FLOOR_EXTRAS[j.floor ?? 'main-hall'].dj} tonight.`,
        floors: `Three floors, each with its own night.`,
        dress: `The owner says: ${club.dress}. Tonight is masked.`,
        events: `${club.tonight}. ${club.ticketsLeft} tickets left.`,
      }
      return { patch: { scene: 'venue', tile: open }, reply: open ? replies[open] : 'Back to the whole club.' }
    }
    case 'budget':
      return { patch: { scene: 'outfit', floor: j.floor ?? 'main-hall', inside: true, budget: intent.max }, reply: intent.max ? `Under CHF ${intent.max} each. Same night, fewer options.` : 'Any budget, then.' }
    case 'vibe':
      return { patch: { scene: 'outfit', floor: j.floor ?? 'main-hall', inside: true, vibe: intent.id }, reply: intent.id ? `${intent.id} it is.` : 'Any vibe, then.' }
    case 'money':
      return {
        patch: { scene: 'casino', casino: true, inside: false },
        reply: `There's a casino ${CASINO.ride}. It is not a financial strategy, but here it is.`,
      }
    case 'reserved':
      return {
        patch: { ticketRef: intent.ref, ...(intent.booked ? { booked: true, scene: 'plan' as const, inside: false } : {}) },
        reply: `Confirmed by ${club.name}: ${PEOPLE} tickets, CHF ${intent.total}, reference ${intent.ref}.`,
      }
    case 'soldOut':
      return { patch: {}, reply: `${club.name} says no: ${intent.message}.` }
    case 'reserveArticle':
      return { patch: {}, reply: `Asking ${shopOf(j.shop)?.name}…` }
    case 'articleReserved':
      return {
        patch: { reserved: [...j.reserved, { ...intent.article, ref: intent.ref }] },
        reply: `${shopOf(j.shop)?.name} is holding ${PEOPLE} × ${intent.article.name} for you, reference ${intent.ref}.`,
      }
    case 'reserve':
      return { patch: {}, reply: `Asking ${club.name} for ${PEOPLE} tickets…` }
    case 'book':
      return { patch: { scene: 'plan', inside: false }, reply: `Asking ${club.name} for ${PEOPLE} tickets…` }
    case 'back':
      if (j.scene === 'venue' && j.inside) return { patch: { inside: false }, reply: `Back to the whole of ${club.name}.` }
      if (j.scene === 'shop' && j.shop && !j.reserved.length) return { patch: { shop: null }, reply: 'Back to the stores.' }
      return { patch: { scene: BACK[j.scene], inside: BACK[j.scene] === 'outfit' }, reply: 'Stepping back.' }
  }
}
