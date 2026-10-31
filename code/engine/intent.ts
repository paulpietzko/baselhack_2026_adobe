/**
 * Text → intent. Rules answer instantly, which is what keeps the experience fluid.
 * A model only gets a turn for what the rules can't place, and its answer is checked
 * against this file before anything happens.
 */
import { COLORS, OUTFITS, SHOPS, VIBES, type Article, type ColorId, type FloorId, type OutfitId, type Vibe } from './catalog.ts'

export type TileId = 'music' | 'floors' | 'dress' | 'events'

export type Intent =
  | { kind: 'basel' | 'party' | 'venue' | 'music' | 'outfit' | 'shop' | 'casino' | 'plan' | 'book' | 'reserve' | 'back' }
  | { kind: 'money' }
  | { kind: 'tile'; id: TileId | null }
  | { kind: 'budget'; max: number | null }
  | { kind: 'vibe'; id: Vibe | null }
  | { kind: 'reserved'; ref: string; total: number; booked: boolean }
  | { kind: 'soldOut'; message: string }
  | { kind: 'floor'; id: FloorId }
  | { kind: 'pick'; id: OutfitId }
  | { kind: 'color'; id: ColorId }
  | { kind: 'pickShop'; id: string }
  | { kind: 'reserveArticle'; id: string }
  | { kind: 'articleReserved'; article: Article; ref: string }
  | { kind: 'peek'; name: string }

// First match wins, so the specific phrases sit above the general ones
const RULES: [RegExp, Intent][] = [
  [/\b(go back|back|undo|never mind)\b/, { kind: 'back' }],
  [/\b(book|confirm|pay|do it)\b/, { kind: 'book' }],
  [/\b(lock|plan|summary|wrap|finish)\b/, { kind: 'plan' }],
  [/need money|no money|broke|\b180\b|too expensive/, { kind: 'money' }],
  [/casino|gambl|poker|roulette|blackjack/, { kind: 'casino' }],
  [/vampire|dracula|\bcape\b|noir/, { kind: 'pick', id: 'vampire' }],
  [/skelet|skull|\buv\b|glow|scar(y|ier)/, { kind: 'pick', id: 'skeleton' }],
  [/witch|couture/, { kind: 'pick', id: 'witch' }],
  [/crimson|\bred\b/, { kind: 'color', id: 'crimson' }],
  [/midnight|\bblue\b/, { kind: 'color', id: 'midnight' }],
  [/emerald|\bgreen\b/, { kind: 'color', id: 'emerald' }],
  [/maskenkammer|spalenberg/, { kind: 'pickShop', id: 'maskenkammer' }],
  [/fundus|second.?hand/, { kind: 'pickShop', id: 'fundus' }],
  [/atelier|rosental|fitted/, { kind: 'pickShop', id: 'atelier' }],
  [/where.*(get|buy|find|rent)|\b(shops?|stores?|rent|pick up)\b/, { kind: 'shop' }],
  [/dress ?code|what are the rules/, { kind: 'tile', id: 'dress' }],
  [/can we get in|ticket|guest.?list|availab|\bevents?\b/, { kind: 'tile', id: 'events' }],
  [/outfit|costume|wear|\bmask/, { kind: 'outfit' }],
  [/\bglam/, { kind: 'vibe', id: 'Glam' }],
  [/\bfunny\b/, { kind: 'vibe', id: 'Funny' }],
  [/main hall|techno/, { kind: 'floor', id: 'main-hall' }],
  [/rooftop|terrace|sky bar|disco|\bhouse\b/, { kind: 'floor', id: 'rooftop' }],
  [/entrance|lobby|coat/, { kind: 'floor', id: 'entrance' }],
  [/music|\bdj\b|line.?up|playing/, { kind: 'music' }],
  [/hafenlicht|that one|this one|inside|step in|walk in|\bbar\b|\bclub\b|\bgo (there|in)\b/, { kind: 'venue' }],
  [/party|halloween|spooky|tonight|\bfun\b|dance|\bdrinks?\b/, { kind: 'party' }],
  [/basel|what can|something to do|museum|sights?/, { kind: 'basel' }],
  [/^(no|nope|nah)\W*$/, { kind: 'back' }],
]

export function parseIntent(text: string): Intent | null {
  const under = text.match(/(?:under|below|max)\s*(?:chf\s*)?(\d+)/i)
  if (under) return { kind: 'budget', max: Number(under[1]) }
  return RULES.find(([pattern]) => pattern.test(text.toLowerCase()))?.[1] ?? null
}

const PLAIN_KINDS = ['basel', 'party', 'venue', 'music', 'outfit', 'shop', 'casino', 'plan', 'back', 'money']
const FLOORS: FloorId[] = ['main-hall', 'rooftop', 'entrance']
const TILES: TileId[] = ['music', 'floors', 'dress', 'events']

/**
 * What a model is allowed to ask for. Anything with consequences (book, reserve) is missing on purpose:
 * those only ever come from a person pressing a button. Unknown kinds and made-up ids return null.
 */
export function validateModelIntent(raw: unknown): Intent | null {
  if (!raw || typeof raw !== 'object') return null
  const { kind, id } = raw as { kind?: unknown; id?: unknown }
  if (typeof kind !== 'string') return null
  if (PLAIN_KINDS.includes(kind)) return { kind } as Intent
  if (kind === 'floor' && FLOORS.includes(id as FloorId)) return { kind, id: id as FloorId }
  if (kind === 'tile' && TILES.includes(id as TileId)) return { kind, id: id as TileId }
  if (kind === 'pick' && OUTFITS.some((o) => o.id === id)) return { kind, id: id as OutfitId }
  if (kind === 'color' && COLORS.some((c) => c.id === id)) return { kind, id: id as ColorId }
  if (kind === 'pickShop' && SHOPS.some((s) => s.id === id)) return { kind, id: id as string }
  if (kind === 'vibe' && VIBES.includes(id as Vibe)) return { kind, id: id as Vibe }
  return null
}

/** The model is injected, so this logic can be tested without a key or a network */
export type IntentModel = (text: string, context: string) => Promise<unknown>
export type Resolution = { intent: Intent | null; via: 'rules' | 'model' | 'none' }

export async function resolveIntent(text: string, context: string, model?: IntentModel): Promise<Resolution> {
  const ruled = parseIntent(text)
  if (ruled) return { intent: ruled, via: 'rules' }
  if (!model) return { intent: null, via: 'none' }
  try {
    const intent = validateModelIntent(await model(text, context))
    return intent ? { intent, via: 'model' } : { intent: null, via: 'none' }
  } catch {
    // A model outage costs one answer, not the journey
    return { intent: null, via: 'none' }
  }
}
