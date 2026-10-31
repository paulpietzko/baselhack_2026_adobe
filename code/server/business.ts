/**
 * Where a business's published record lives: the one source of truth the owner edits, the agent's
 * tools read, and the guest's world is drawn from. In memory for the demo, so it starts over from
 * the seed when the dev server restarts. The rules are in engine/business.ts.
 */
import vendor from '../src/data/vendor.json' with { type: 'json' }
import { availability, fromProfile, reserve, reserveStock, type Business, type BusinessFloor, type Field, type Reservation } from '../engine/business.ts'
import { DEFAULT_ARTICLE_STOCK, OUTFITS, SHOPS, articlesFor } from '../engine/catalog.ts'
import { buildWorld } from '../engine/world.ts'

export type { Business, Reservation }

const tonight = () => vendor.facts.find((f) => f.label === 'Tonight')?.value ?? ''

// Survives the dev server reloading this module
const memory = globalThis as unknown as { acmeBusiness?: Business; acmeReservations?: Reservation[]; shopStock?: Record<string, number> }
memory.acmeBusiness ??= fromProfile(vendor.profile, vendor.floors, tonight())
memory.acmeReservations ??= []
memory.shopStock ??= {}

export const getBusiness = () => memory.acmeBusiness!
export const getWorld = () => buildWorld(getBusiness())

export function publish(profile: Field[], floors: BusinessFloor[]) {
  memory.acmeBusiness = fromProfile(profile, floors, tonight(), memory.acmeBusiness)
  return memory.acmeBusiness
}

export const checkAvailability = (people: number) => availability(getBusiness(), people)

/** A real state change: tickets go down, and sold-out is a real answer */
export function reserveTickets(people: number): Reservation {
  const ref = `HL-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
  const { business, reservation } = reserve(getBusiness(), people, ref)
  memory.acmeBusiness = business
  memory.acmeReservations!.push(reservation)
  return reservation
}

/** Holds an article at a store. The shop and article are looked up here, so a caller can't name its own price. */
export function reserveArticle(shopId: string, outfitId: string, articleId: string, people: number) {
  const shop = SHOPS.find((s) => s.id === shopId)
  const outfit = OUTFITS.find((o) => o.id === outfitId)
  const article = shop && outfit && articlesFor(outfit, shop).find((a) => a.id === articleId)
  if (!shop || !article) throw new Error('That store does not have this article')
  const key = `${shop.id}/${article.id}`
  const inStock = memory.shopStock![key] ?? (article.id.endsWith('-costume') ? shop.costumesInStock : DEFAULT_ARTICLE_STOCK)
  memory.shopStock![key] = reserveStock(inStock, people)
  return { ref: `${shop.id.slice(0, 2).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, article, left: memory.shopStock![key] }
}
