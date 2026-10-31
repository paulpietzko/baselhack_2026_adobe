/**
 * Explainable discovery. Matches what someone asked for against what businesses are, and can say why.
 * Deliberately has no input for what a business wants to promote: business intent can shape how it's
 * presented, but it never changes who ranks where.
 */
import type { World } from './world.ts'

export type Ranked = { id: string; name: string; score: number; verified: boolean; hasVenue: boolean; reasons: string[] }

// What people say → what places are
const VOCABULARY: [RegExp, string[]][] = [
  [/party|club|\bnight|going out|dance|dancing|rave|techno/, ['nightlife', 'dance']],
  [/halloween|spooky|costume/, ['halloween']],
  [/tonight/, ['tonight']],
  [/music|dj/, ['music']],
  [/drink|cocktail|\bbar\b/, ['drinks']],
  [/museum|\bart\b|culture/, ['museum', 'art', 'culture']],
  [/walk|outdoors|river|rhine/, ['outdoors', 'walk', 'river']],
  [/sight|history|old town/, ['sights', 'history']],
]
const BROAD = /what can|something to do|what to do|plan|ideas?/

/** Verified can break a tie, but it's worth less than one real match. Trust doesn't beat relevance. */
const VERIFIED_BONUS = 0.5

export function wantedTags(query: string): string[] {
  const q = query.toLowerCase()
  const tags = VOCABULARY.flatMap(([pattern, t]) => (pattern.test(q) ? t : []))
  return tags.length || !BROAD.test(q) ? [...new Set(tags)] : ['daytime']
}

export const clubTags = ['nightlife', 'dance', 'music', 'drinks', 'tonight', 'halloween']

export function rank(world: World, query: string, limit = 3): Ranked[] {
  const wanted = wantedTags(query)
  const candidates = [
    { id: world.club.id, name: world.club.name, tags: clubTags, verified: true, hasVenue: true },
    ...world.listings,
  ]
  return candidates
    .map((c) => {
      const hits = wanted.filter((t) => c.tags.includes(t))
      const reasons = [...hits, ...(c.verified && hits.length ? ['owner verified'] : []), ...(c.hasVenue && hits.length ? ['published venue'] : [])]
      return { id: c.id, name: c.name, verified: c.verified, hasVenue: c.hasVenue, score: hits.length ? hits.length + (c.verified ? VERIFIED_BONUS : 0) : 0, reasons }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
}
