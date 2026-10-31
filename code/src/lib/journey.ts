import { BASEL_TITLE } from '../data/basel'
import {
  BUDGET_DISCOUNT,
  CASINO,
  CLUB,
  COLORS,
  FLOOR_EXTRAS,
  FLOOR_VOTES,
  OUTFIT_VOTES,
  floorById,
  outfitById,
  shopById,
  type ColorId,
  type CrewId,
  type FloorId,
  type OutfitId,
} from '../data/tonight'

export type SceneId = 'basel' | 'party' | 'venue' | 'outfit' | 'shop' | 'casino' | 'plan'

/** Everything the crew has decided so far. It travels with them from scene to scene, no page ever forgets it. */
export type Journey = {
  scene: SceneId
  floor: FloorId | null
  /** Looking into the floor, as opposed to the whole building */
  inside: boolean
  room: number | null
  outfit: OutfitId | null
  color: ColorId
  budget: boolean
  shop: string | null
  guestlist: boolean
  casino: boolean
  spinning: boolean
  winner: CrewId | null
  booked: boolean
}

export const START: Journey = {
  scene: 'basel',
  floor: null,
  inside: false,
  room: null,
  outfit: null,
  color: 'crimson',
  budget: false,
  shop: null,
  guestlist: false,
  casino: false,
  spinning: false,
  winner: null,
  booked: false,
}

export type Intent =
  | { kind: 'basel' | 'party' | 'venue' | 'music' | 'crowd' | 'guestlist' | 'outfit' | 'budget' | 'shop' | 'casino' | 'spin' | 'plan' | 'book' | 'back' }
  | { kind: 'floor'; id: FloorId }
  | { kind: 'room'; index: number }
  | { kind: 'pick'; id: OutfitId }
  | { kind: 'color'; id: ColorId }
  | { kind: 'pickShop'; id: string }
  | { kind: 'peek'; name: string }

// First match wins, so the specific phrases sit above the general ones
const RULES: [RegExp, Intent][] = [
  [/\b(go back|back|undo|never mind)\b/, { kind: 'back' }],
  [/who.*(buy|pay|round)|\bspin\b|first round/, { kind: 'spin' }],
  [/\b(book|confirm|pay|do it)\b/, { kind: 'book' }],
  [/\b(lock|plan|summary|wrap|finish)\b/, { kind: 'plan' }],
  [/casino|gambl|poker|roulette|blackjack/, { kind: 'casino' }],
  [/vampire|dracula|\bcape\b|noir/, { kind: 'pick', id: 'vampire' }],
  [/skelet|skull|\buv\b|glow|scar(y|ier)/, { kind: 'pick', id: 'skeleton' }],
  [/witch|couture/, { kind: 'pick', id: 'witch' }],
  [/crimson|\bred\b/, { kind: 'color', id: 'crimson' }],
  [/midnight|\bblue\b/, { kind: 'color', id: 'midnight' }],
  [/emerald|\bgreen\b/, { kind: 'color', id: 'emerald' }],
  [/cheap|budget|less money|too expensive/, { kind: 'budget' }],
  [/maskenkammer|spalenberg/, { kind: 'pickShop', id: 'maskenkammer' }],
  [/fundus|second.?hand/, { kind: 'pickShop', id: 'fundus' }],
  [/nachtkurier|courier|deliver/, { kind: 'pickShop', id: 'nachtkurier' }],
  [/where.*(get|buy|find|rent)|\b(shop|store|rent|pick up)\b/, { kind: 'shop' }],
  [/dress|outfit|costume|wear|\bmask/, { kind: 'outfit' }],
  [/main hall|techno/, { kind: 'floor', id: 'main-hall' }],
  [/rooftop|terrace|sky bar|disco|\bhouse\b/, { kind: 'floor', id: 'rooftop' }],
  [/entrance|lobby|coat/, { kind: 'floor', id: 'entrance' }],
  [/music|\bdj\b|line.?up|playing/, { kind: 'music' }],
  [/busy|crowd|full|when should/, { kind: 'crowd' }],
  [/guest.?list|ticket|\bentry\b|the door/, { kind: 'guestlist' }],
  [/hafenlicht|that one|this one|inside|step in|walk in|\bbar\b|\bclub\b|\bgo (there|in)\b/, { kind: 'venue' }],
  [/party|halloween|spooky|tonight|\bfun\b|dance|\bdrinks?\b/, { kind: 'party' }],
  [/basel|what can|something to do|museum|sights?/, { kind: 'basel' }],
  [/^(no|nope|nah)\W*$/, { kind: 'back' }],
]

export const parseIntent = (text: string): Intent | null =>
  RULES.find(([pattern]) => pattern.test(text.toLowerCase()))?.[1] ?? null

const BACK: Record<SceneId, SceneId> = { basel: 'basel', party: 'basel', venue: 'party', outfit: 'venue', shop: 'outfit', casino: 'venue', plan: 'casino' }

const votesFor = <T,>(votes: Partial<Record<CrewId, T>>, mine: T | null, id: T) =>
  Object.values(votes).filter((v) => v === id).length + (mine === id ? 1 : 0)

export const unitPrice = (j: Journey) => {
  const base = outfitById(j.outfit)?.price ?? 0
  return base ? base + (shopById(j.shop)?.extra ?? 0) - (j.budget ? BUDGET_DISCOUNT : 0) : 0
}

/** Per person: costume, club entry, casino entry and the taxi between them */
export const perPerson = (j: Journey) => unitPrice(j) + CLUB.presale + (j.casino ? CASINO.entry + 6 : 0)

const casinoLine = (j: Journey) => {
  const outfit = outfitById(j.outfit)
  return outfit ? `${outfit.name}: ${outfit.casino.note}` : 'No outfits picked yet, and the door wants smart dress, so keep that in mind.'
}

/** The state change and Claude's answer for an intent. Every reply leans on what the crew already decided. */
export function reduce(j: Journey, intent: Intent): { patch: Partial<Journey>; reply: string } {
  const floor = floorById(j.floor)
  switch (intent.kind) {
    case 'basel':
      return { patch: { scene: 'basel' }, reply: BASEL_TITLE }
    case 'party':
      return {
        patch: { scene: 'party' },
        reply: `Halloween it is. Three places are on tonight, but only ${CLUB.name} has published its whole building, so you can walk in before you commit.`,
      }
    case 'peek':
      return {
        patch: {},
        reply: j.scene === 'basel'
          ? `${intent.name} is a lovely way to spend the day. Say the word if the crew wants something else.`
          : `${intent.name} hasn't published its venue yet, so this card is all I can show you. ${CLUB.name} lets you step inside.`,
      }
    case 'venue':
      return {
        patch: { scene: 'venue', inside: false, room: null },
        reply: `${CLUB.name}: ${CLUB.tagline}. Tonight is ${CLUB.tonight.replace('Halloween: ', '').toLowerCase()}. Pick a floor, or ask me anything about the night.`,
      }
    case 'floor': {
      const next = floorById(intent.id)!
      const count = votesFor(FLOOR_VOTES, intent.id, intent.id)
      return {
        patch: { scene: 'venue', floor: intent.id, inside: true, room: null },
        reply: `${next.name}: ${next.music.toLowerCase()}, room for ${next.capacity}. ${FLOOR_EXTRAS[intent.id].note}. That's ${count} of 4 in the crew.`,
      }
    }
    case 'room': {
      const room = floor?.rooms[intent.index]
      return { patch: { room: intent.index }, reply: room ? `This is the ${room.name} on the ${floor!.name}.` : 'Here you go.' }
    }
    case 'music': {
      const id = j.floor ?? 'main-hall'
      const extra = FLOOR_EXTRAS[id]
      return {
        patch: { scene: 'venue', floor: id, inside: true, room: null },
        reply: `${floorById(id)!.name} tonight: ${extra.dj}${extra.bpm ? `, around ${extra.bpm} BPM` : ''}.`,
      }
    }
    case 'crowd': {
      const id = j.floor ?? 'main-hall'
      return { patch: { scene: 'venue' }, reply: `${floorById(id)!.name} peaks around ${id === 'rooftop' ? '01:00' : '02:00'}. Arrive by midnight and you'll skip most of the queue.` }
    }
    case 'guestlist':
      return { patch: { guestlist: true }, reply: `All four of you are held on the ${CLUB.name} list at CHF ${CLUB.presale} presale. Nothing's charged until you book the plan.` }
    case 'outfit': {
      const id = j.floor ?? 'main-hall'
      const assumed = j.floor ? '' : ` I'm dressing you for the Main Hall, since it leads the vote.`
      return {
        patch: { scene: 'outfit', floor: id, inside: true, room: null },
        reply: `Tonight is masked and ${CLUB.dress.toLowerCase()}.${assumed} Here's the crew on the ${floorById(id)!.name}, under its actual lights.`,
      }
    }
    case 'pick': {
      const id = j.floor ?? 'main-hall'
      const outfit = outfitById(intent.id)!
      return {
        patch: { scene: 'outfit', floor: id, inside: true, room: null, outfit: intent.id },
        reply: `${outfit.name}, ${votesFor(OUTFIT_VOTES, intent.id, intent.id)} of 4 in. ${outfit.onFloor[id]}. Want to change the colour, or find where to get it?`,
      }
    }
    case 'color': {
      const name = COLORS.find((c) => c.id === intent.id)!.name
      return { patch: { scene: 'outfit', color: intent.id, floor: j.floor ?? 'main-hall', inside: true }, reply: `${name} it is. Look at it under the lights before you decide.` }
    }
    case 'budget':
      return { patch: { budget: true }, reply: `Switched to rental cuts, which takes CHF ${BUDGET_DISCOUNT} off each costume.` }
    case 'shop': {
      if (!j.outfit) {
        return {
          patch: { scene: 'outfit', floor: j.floor ?? 'main-hall', inside: true },
          reply: 'Pick an outfit first and I can check who has all four sizes tonight.',
        }
      }
      return { patch: { scene: 'shop', inside: true }, reply: `Three places have ${outfitById(j.outfit)!.name} tonight. I've ranked them by how well they fit your route to ${CLUB.name}.` }
    }
    case 'pickShop': {
      const shop = shopById(intent.id)!
      return {
        patch: { scene: 'shop', shop: intent.id, inside: true, floor: j.floor ?? 'main-hall', outfit: j.outfit ?? 'vampire' },
        reply: `Done, ${shop.name} goes on the plan. ${shop.detail}. How do you want to end the night?`,
      }
    }
    case 'casino':
      return {
        patch: { scene: 'casino', casino: true, inside: false, room: null },
        reply: `${CASINO.name} is ${CASINO.ride.split(',')[0]}, so it works as your 02:30 move. ${casinoLine(j)}`,
      }
    case 'spin':
      return { patch: { scene: 'casino', casino: true, spinning: true, winner: null, inside: false }, reply: 'Let the wheel decide who buys the first round.' }
    case 'plan': {
      const missing = [!j.floor && 'a floor', !j.outfit && 'outfits', !j.casino && 'the last stop'].filter(Boolean)
      return {
        patch: { scene: 'plan', inside: false },
        reply: missing.length ? `Here's the night so far. Still open: ${missing.join(', ')}.` : `That's the whole night, one route and one price. I've sent it to the crew.`,
      }
    }
    case 'book':
      return {
        patch: { scene: 'plan', inside: false, booked: true, guestlist: true },
        reply: `Booked, CHF ${perPerson(j)} each. Tickets, costumes and the casino table are all in your wallets. Have a scary one.`,
      }
    case 'back':
      if (j.scene === 'venue' && j.inside) return { patch: { inside: false, room: null }, reply: `Back to the whole of ${CLUB.name}.` }
      return { patch: { scene: BACK[j.scene], inside: BACK[j.scene] === 'outfit' || BACK[j.scene] === 'shop', room: null }, reply: 'Stepping back.' }
  }
}

export type CrewLine = [ms: number, from: CrewId, text: string]

/** How the group reacts: they vote, object and steer, the same way a real group chat would */
export function reactions(intent: Intent, j: Journey): CrewLine[] {
  switch (intent.kind) {
    case 'basel':
      return [
        [1400, 'mia', 'A museum? On Halloween?'],
        [3000, 'leo', 'Can we do something that involves a dance floor'],
      ]
    case 'party':
      return [
        [2600, 'noa', 'Hafenlicht has a rooftop!'],
        [4200, 'mia', 'Masked party, I’m in'],
      ]
    case 'venue':
      return [
        [3400, 'leo', 'Main Hall. Techno or nothing.'],
        [4800, 'mia', 'Rooftop for me, it’s got the Sky Bar'],
        [6200, 'noa', 'Main Hall, but what do we even wear?'],
      ]
    case 'floor':
      return intent.id === 'rooftop'
        ? [[1400, 'mia', 'YES. Told you.'], [2800, 'leo', 'Fine, but we’re going downstairs later']]
        : intent.id === 'main-hall'
          ? [[1400, 'leo', 'Correct answer'], [2800, 'mia', 'I’ll allow it if the rooftop is at 2']]
          : [[1400, 'noa', 'That’s the coat check, I think we can do better']]
    case 'outfit':
      return [
        [1600, 'mia', 'Vampire, obviously'],
        [3000, 'leo', 'Skeleton glows under the UV, just saying'],
        [4400, 'noa', 'Vampire. I already own fangs.'],
      ]
    case 'pick':
      return intent.id === 'vampire'
        ? [[1400, 'mia', 'Now we’re talking'], [2800, 'leo', 'Ok but I get the red lining']]
        : intent.id === 'skeleton'
          ? [[1400, 'leo', 'Finally, someone with taste'], [2800, 'noa', 'Does it pass at a nicer place though?']]
          : [[1400, 'mia', 'That hat is a lot. I love it.']]
    case 'color':
      return [[1400, 'noa', 'Oh that’s the one']]
    case 'budget':
      return [[1200, 'noa', 'Thank you, I’m saving for the casino']]
    case 'shop':
      return j.outfit ? [[1800, 'noa', 'Maskenkammer is on my way, I can grab all four']] : []
    case 'pickShop':
      return [[1400, 'leo', 'Sorted. So where do we go after Hafenlicht?'], [3000, 'mia', 'Casino? I feel lucky in a cape']]
    case 'casino':
      return [
        [4200, 'leo', 'Loser buys the first round'],
        ...(j.outfit === 'skeleton' ? ([[5600, 'noa', 'I’ll bring blazers']] as CrewLine[]) : []),
      ]
    case 'plan':
      return [
        [1200, 'mia', 'In'],
        [2200, 'leo', 'In'],
        [3200, 'noa', 'In. No app to install either?'],
      ]
    case 'book':
      return [[1400, 'mia', 'See you in the dark'], [2600, 'leo', 'Wait, we never opened a single website']]
    default:
      return []
  }
}

/** Timing of the "In" messages above, so the plan's approvals tick in step with the chat */
export const APPROVAL_MS = [1200, 2200, 3200]

/** What the crew might say next. The first one is also what the mock microphone "hears". */
export function suggestions(j: Journey): string[] {
  switch (j.scene) {
    case 'basel':
      return ['No, something more party. It’s Halloween!']
    case 'party':
      return ['Take us to Hafenlicht', 'Find us a casino instead']
    case 'venue':
      return j.floor
        ? ['What should we wear?', 'Who’s playing?', 'Put us on the guest list', 'Now find a casino']
        : ['Main Hall, techno please', 'Rooftop for us', 'What’s the dress code?']
    case 'outfit':
      return j.outfit
        ? ['Where can we get it tonight?', j.color === 'midnight' ? 'Make it emerald' : 'Make it midnight blue', ...(j.budget ? [] : ['Anything cheaper?'])]
        : ['Let’s go vampire', 'UV skeleton', 'Witch couture']
    case 'shop':
      return j.shop ? ['Now find us a casino to end the night', 'Change the outfit'] : ['Maskenkammer works', 'Have it delivered', 'Go back']
    case 'casino':
      return ['Lock in the plan', 'Who buys the first round?', 'Back to Hafenlicht']
    case 'plan':
      return j.booked ? [] : ['Book it', 'Back to the casino']
  }
}
