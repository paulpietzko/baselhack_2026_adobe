/**
 * The shared world graph: who and what exists, how it connects, and how we know.
 * Pages don't exist here. A club hosts an event, the event has a dress code, an outfit satisfies it,
 * a shop sells the outfit. That chain is what lets a journey cross businesses without restarting.
 */
import type { Business } from './business.ts'
import { CASINO, FLOOR_EXTRAS, LISTINGS, OUTFITS, SHOPS, type FloorId, type Listing, type Outfit } from './catalog.ts'

/**
 * owner: published and approved by the business itself. curated: hand-written demo data.
 * inferred: computed here from the other two. Facts shown to a guest keep this label.
 */
export type Provenance = { kind: 'owner' | 'curated' | 'inferred'; by: string; at?: string }

export type EntityType = 'business' | 'floor' | 'event' | 'dress-code' | 'outfit' | 'shop' | 'place'
export type Entity = { id: string; type: EntityType; name: string; facts: Record<string, string | number>; provenance: Provenance }
export type Relation = 'has_floor' | 'hosts' | 'has_dress_code' | 'plays' | 'satisfies' | 'sold_by' | 'near'
export type Edge = { from: string; to: string; relation: Relation; provenance: Provenance; note?: string }

export type World = {
  club: Business
  entities: Map<string, Entity>
  edges: Edge[]
  listings: Listing[]
}

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

export function buildWorld(club: Business): World {
  const owner: Provenance = { kind: 'owner', by: club.name, at: club.publishedAt }
  const curated: Provenance = { kind: 'curated', by: 'demo catalog' }
  const inferred: Provenance = { kind: 'inferred', by: 'engine' }
  const entities = new Map<string, Entity>()
  const edges: Edge[] = []
  const add = (e: Entity) => entities.set(e.id, e)
  const eventId = `${club.id}/tonight`
  const dressId = `${club.id}/dress-code`

  add({ id: club.id, type: 'business', name: club.name, facts: { tagline: club.tagline, address: club.address, hours: club.hours, entry: club.entry, age: club.age }, provenance: owner })
  add({ id: eventId, type: 'event', name: club.tonight, facts: { presale: club.presale, ticketsLeft: club.ticketsLeft }, provenance: owner })
  add({ id: dressId, type: 'dress-code', name: club.dress, facts: {}, provenance: owner })
  edges.push({ from: club.id, to: eventId, relation: 'hosts', provenance: owner }, { from: eventId, to: dressId, relation: 'has_dress_code', provenance: owner })

  for (const f of club.floors) {
    const id = `${club.id}/floor/${f.id}`
    const extra = FLOOR_EXTRAS[f.id as FloorId]
    add({ id, type: 'floor', name: f.name, facts: { music: f.music, capacity: f.capacity, ...(extra ? { dj: extra.dj } : {}) }, provenance: owner })
    edges.push({ from: club.id, to: id, relation: 'has_floor', provenance: owner })
  }

  for (const outfit of OUTFITS) {
    add({ id: outfit.id, type: 'outfit', name: outfit.name, facts: { price: outfit.price, vibe: outfit.vibe }, provenance: curated })
    const check = dressCheck(outfit, club.dress)
    // The bridge between businesses is computed from the owner's own words, so it moves when they edit them
    if (check.ok) edges.push({ from: outfit.id, to: dressId, relation: 'satisfies', provenance: inferred, note: check.reason })
    for (const shop of SHOPS) edges.push({ from: outfit.id, to: shop.id, relation: 'sold_by', provenance: curated })
  }
  for (const shop of SHOPS) add({ id: shop.id, type: 'shop', name: shop.name, facts: { kind: shop.kind, stock: shop.stock }, provenance: curated })

  add({ id: CASINO.id, type: 'place', name: CASINO.name, facts: { hours: CASINO.hours, ride: CASINO.ride }, provenance: curated })
  edges.push({ from: club.id, to: CASINO.id, relation: 'near', provenance: curated })
  for (const l of LISTINGS) add({ id: l.id, type: 'place', name: l.name, facts: { tags: l.tags.join(', ') }, provenance: curated })

  return { club, entities, edges, listings: LISTINGS }
}

export const neighbors = (world: World, id: string) => world.edges.filter((e) => e.from === id || e.to === id)

/** How one thing connects to another, for "why am I seeing this?". Null when nothing connects them. */
export function pathBetween(world: World, from: string, to: string): Edge[] | null {
  const queue: { id: string; path: Edge[] }[] = [{ id: from, path: [] }]
  const seen = new Set([from])
  while (queue.length) {
    const { id, path } = queue.shift()!
    if (id === to) return path
    for (const edge of neighbors(world, id)) {
      const next = edge.from === id ? edge.to : edge.from
      if (seen.has(next)) continue
      seen.add(next)
      queue.push({ id: next, path: [...path, edge] })
    }
  }
  return null
}
