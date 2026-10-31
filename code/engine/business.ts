/**
 * The published business record and the rules for changing it. Pure functions: the store
 * (server/business.ts) decides where the record lives, this decides what's allowed to happen to it.
 */
export type BusinessFloor = { id: string; name: string; music: string; capacity: number }
export type Field = { key: string; value: string; source?: string }

export type Business = {
  id: string
  name: string
  tagline: string
  address: string
  hours: string
  entry: string
  presale: number
  age: string
  dress: string
  tonight: string
  /** Where each fact came from, as the vendor portal found it */
  sources: Record<string, string>
  floors: BusinessFloor[]
  ticketsLeft: number
  publishedAt: string
}

export type Reservation = { ref: string; people: number; total: number; ticketsLeft: number }

const TICKETS = 40

/** Business truth from the owner's approved profile. Tickets and tonight's event survive a re-publish. */
export function fromProfile(profile: Field[], floors: BusinessFloor[], tonight: string, previous?: Business, now = new Date()): Business {
  const field = (key: string) => profile.find((f) => f.key === key)?.value ?? ''
  const entry = field('entry')
  return {
    id: 'acme/hafenlicht',
    name: field('name'),
    tagline: field('tagline'),
    address: field('address'),
    hours: field('hours'),
    entry,
    presale: Number(entry.match(/\d+/)?.[0] ?? 0),
    age: field('age'),
    dress: field('dress'),
    tonight: previous?.tonight ?? tonight,
    sources: Object.fromEntries(profile.map((f) => [f.key, f.source ?? ''])),
    floors: floors.map(({ id, name, music, capacity }) => ({ id, name, music, capacity })),
    ticketsLeft: previous?.ticketsLeft ?? TICKETS,
    publishedAt: now.toISOString(),
  }
}

export function availability(business: Business, people: number) {
  return { available: people > 0 && people <= business.ticketsLeft, ticketsLeft: business.ticketsLeft, total: business.presale * people }
}

/** Returns the new record and the confirmation, or throws: an agent can't talk its way past sold out */
export function reserve(business: Business, people: number, ref: string): { business: Business; reservation: Reservation } {
  if (!Number.isInteger(people) || people <= 0) throw new Error('A reservation needs at least one person')
  if (people > business.ticketsLeft) throw new Error(`Only ${business.ticketsLeft} tickets left`)
  const ticketsLeft = business.ticketsLeft - people
  return { business: { ...business, ticketsLeft }, reservation: { ref, people, total: business.presale * people, ticketsLeft } }
}

/** Same rule for a shop's shelf: it's there or it isn't */
export function reserveStock(inStock: number, people: number) {
  if (!Number.isInteger(people) || people <= 0) throw new Error('A reservation needs at least one person')
  if (people > inStock) throw new Error(`Only ${inStock} left`)
  return inStock - people
}
