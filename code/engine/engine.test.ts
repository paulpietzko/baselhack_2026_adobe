import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { availability, fromProfile, reserve, reserveStock, type Business } from './business.ts'
import { COLORS, OUTFITS, SHOPS, articlesFor } from './catalog.ts'
import { compose } from './compose.ts'
import { parseIntent, resolveIntent, validateModelIntent, type Intent } from './intent.ts'
import { START, reduce, unitPrice, type Journey } from './journey.ts'
import { rank, wantedTags } from './rank.ts'
import { buildWorld, dressCheck, pathBetween } from './world.ts'

const profile = [
  { key: 'name', value: 'Hafenlicht', source: '/' },
  { key: 'tagline', value: 'Techno above the Rhine harbour', source: '/' },
  { key: 'entry', value: 'CHF 20 presale, 25 at the door', source: '/tickets' },
  { key: 'age', value: '18+, ID required', source: '/house-rules' },
  { key: 'dress', value: 'No sportswear', source: '/house-rules' },
]
const floors = [
  { id: 'rooftop', name: 'Rooftop', music: 'House & disco', capacity: 250 },
  { id: 'main-hall', name: 'Main Hall', music: 'Techno', capacity: 450 },
  { id: 'entrance', name: 'Entrance', music: 'Doors & coats', capacity: 120 },
]
const club = (overrides: Partial<Business> = {}) => ({ ...fromProfile(profile, floors, 'Halloween: Masked, 23:00 till late'), ...overrides })
const world = (overrides: Partial<Business> = {}) => buildWorld(club(overrides))
const walk = (intents: Intent[], w = world()) => intents.reduce<Journey>((j, i) => ({ ...j, ...reduce(j, i, w).patch }), START)

describe('publishing', () => {
  test('derives the presale price from what the owner wrote', () => {
    assert.equal(club().presale, 20)
  })
  test('a re-publish keeps tickets already sold', () => {
    const { business } = reserve(club(), 4, 'HL-TEST')
    assert.equal(fromProfile(profile, floors, '', business).ticketsLeft, 36)
  })
})

describe('reservations', () => {
  test('checking availability takes nothing', () => {
    const b = club()
    assert.deepEqual(availability(b, 4), { available: true, ticketsLeft: 40, total: 80 })
    assert.equal(b.ticketsLeft, 40)
  })
  test('reserving takes tickets and confirms the real total', () => {
    const { business, reservation } = reserve(club(), 4, 'HL-TEST')
    assert.equal(business.ticketsLeft, 36)
    assert.deepEqual(reservation, { ref: 'HL-TEST', people: 4, total: 80, ticketsLeft: 36 })
  })
  test('refuses overbooking and nonsense', () => {
    assert.throws(() => reserve(club({ ticketsLeft: 3 }), 4, 'x'), /Only 3 tickets left/)
    assert.throws(() => reserve(club(), 0, 'x'))
    assert.throws(() => reserve(club(), 1.5, 'x'))
  })
})

describe('world graph', () => {
  test('every entity and edge says how we know it', () => {
    const w = world()
    for (const e of w.entities.values()) assert.ok(e.provenance.kind, e.id)
    for (const e of w.edges) assert.ok(['owner', 'curated', 'inferred'].includes(e.provenance.kind))
  })
  test("the club's own facts are owner-sourced, other businesses are not", () => {
    const w = world()
    assert.equal(w.entities.get(w.club.id)!.provenance.kind, 'owner')
    assert.equal(w.entities.get('maskenkammer')!.provenance.kind, 'curated')
  })
  test('connects a club to a shop through the dress code, across businesses', () => {
    const w = world()
    const path = pathBetween(w, w.club.id, 'maskenkammer')!
    assert.deepEqual(path.map((e) => e.relation), ['hosts', 'has_dress_code', 'satisfies', 'sold_by'])
    assert.equal(path[2].provenance.kind, 'inferred')
  })
  test('edges exist only for what is true: the bridge moves when the owner edits the dress code', () => {
    const satisfying = (dress: string) => world({ dress }).edges.filter((e) => e.relation === 'satisfies').map((e) => e.from).sort()
    assert.deepEqual(satisfying('No sportswear'), ['skeleton', 'vampire', 'witch'])
    assert.deepEqual(satisfying('Capes mandatory'), ['vampire'])
  })
})

describe('dress code reading', () => {
  const vampire = OUTFITS.find((o) => o.id === 'vampire')!
  const skeleton = OUTFITS.find((o) => o.id === 'skeleton')!
  test('requirements', () => {
    assert.equal(dressCheck(vampire, 'Capes mandatory').ok, true)
    assert.equal(dressCheck(skeleton, 'Capes mandatory').ok, false)
  })
  test('bans', () => {
    assert.equal(dressCheck({ tags: ['sportswear'] }, 'No sportswear').ok, false)
    assert.equal(dressCheck(vampire, 'No sportswear').ok, true)
  })
  test('anything it cannot read lets people through, rather than inventing a rule', () => {
    assert.equal(dressCheck(skeleton, 'Be nice').ok, true)
  })
})

describe('discovery ranking', () => {
  test('nightlife finds the club first, and explains why', () => {
    const [top] = rank(world(), 'party tonight, it is Halloween')
    assert.equal(top.name, 'Hafenlicht')
    assert.ok(top.reasons.includes('owner verified'))
    assert.ok(top.reasons.includes('tonight'))
  })
  test('a broad daytime question does not push the club', () => {
    assert.ok(rank(world(), 'What can I do in Basel?').every((r) => r.name !== 'Hafenlicht'))
    assert.equal(rank(world(), 'What can I do in Basel?').length, 3)
  })
  test('a museum question finds the museum', () => {
    assert.equal(rank(world(), 'any museum?')[0].name, 'Kunstmuseum Basel')
  })
  test('being verified never beats being relevant', () => {
    assert.ok(rank(world(), 'museum').every((r) => !r.verified))
    // The verified club matches two things here, the unverified museum three: the better match wins
    const [top, second] = rank(world(), 'music tonight, or a museum')
    assert.equal(top.name, 'Kunstmuseum Basel')
    assert.equal(second.name, 'Hafenlicht')
  })
  test('being verified does break a tie', () => {
    const names = rank(world(), 'a cocktail').map((r) => r.name)
    assert.deepEqual(names, ['Hafenlicht', 'Hexenkessel Bar'])
  })
  test('nothing relevant means no results, not a promoted one', () => {
    assert.deepEqual(wantedTags('quantum physics'), [])
    assert.deepEqual(rank(world(), 'quantum physics'), [])
  })
})

describe('intent', () => {
  test('reads the demo lines', () => {
    const cases: [string, Intent['kind']][] = [
      ['What can I do in Basel?', 'basel'],
      ['No, something more party. It’s Halloween!', 'party'],
      ['Take us to Hafenlicht', 'venue'],
      ['What’s the dress code?', 'tile'],
      ['We need costumes!', 'outfit'],
      ['CHF 180? We need money.', 'money'],
      ['Now find us a casino to end the night', 'casino'],
      ['Lock in the plan', 'plan'],
      ['under 50', 'budget'],
    ]
    for (const [text, kind] of cases) assert.equal(parseIntent(text)?.kind, kind, text)
  })
  test('rules answer without a model', async () => {
    let called = false
    const res = await resolveIntent('Take us to Hafenlicht', '', async () => ((called = true), {}))
    assert.equal(res.via, 'rules')
    assert.equal(called, false)
  })
  test('a model only gets what the rules miss', async () => {
    const res = await resolveIntent('somewhere with a great view of the city', '', async () => ({ kind: 'floor', id: 'rooftop' }))
    assert.deepEqual(res, { intent: { kind: 'floor', id: 'rooftop' }, via: 'model' })
  })
  test('a model cannot book, reserve or invent things', () => {
    for (const bad of [{ kind: 'book' }, { kind: 'reserve' }, { kind: 'reserved', ref: 'x', total: 0, booked: true }, { kind: 'floor', id: 'penthouse' }, { kind: 'pickShop', id: 'evil-shop' }, { kind: 'nope' }, 'book', null]) {
      assert.equal(validateModelIntent(bad), null, JSON.stringify(bad))
    }
  })
  test('a failed or unusable model costs one answer, not the journey', async () => {
    assert.deepEqual(await resolveIntent('xyzzy', '', async () => { throw new Error('down') }), { intent: null, via: 'none' })
    assert.deepEqual(await resolveIntent('xyzzy', '', async () => ({ kind: 'book' })), { intent: null, via: 'none' })
    assert.deepEqual(await resolveIntent('xyzzy', ''), { intent: null, via: 'none' })
  })
})

describe('continuous context', () => {
  test('decisions survive a jump to another business', () => {
    const j = walk([{ kind: 'venue' }, { kind: 'floor', id: 'rooftop' }, { kind: 'pick', id: 'vampire' }, { kind: 'budget', max: 100 }, { kind: 'casino' }])
    assert.equal(j.scene, 'casino')
    assert.equal(j.floor, 'rooftop')
    assert.equal(j.outfit, 'vampire')
    assert.equal(j.budget, 100)
  })
  test('constraints are handed on to the next spec', () => {
    const w = world()
    const { constraints } = compose(walk([{ kind: 'venue' }, { kind: 'pick', id: 'skeleton' }, { kind: 'casino' }], w), w)
    assert.equal(constraints.venue, 'Hafenlicht')
    assert.equal(constraints.outfit, 'UV skeleton')
    assert.equal(constraints.occasion, 'Halloween')
  })
  test('replies use the published record, so an owner edit reaches the guest', () => {
    const j = walk([{ kind: 'venue' }])
    assert.match(reduce(j, { kind: 'tile', id: 'dress' }, world({ dress: 'Capes mandatory' })).reply, /Capes mandatory/)
  })
  test('tiles open in any order', () => {
    const a = walk([{ kind: 'venue' }, { kind: 'tile', id: 'music' }, { kind: 'tile', id: 'dress' }])
    const b = walk([{ kind: 'venue' }, { kind: 'tile', id: 'dress' }])
    assert.equal(a.tile, 'dress')
    assert.equal(b.tile, 'dress')
  })
  test('asking for a shop without an outfit steers back instead of failing', () => {
    assert.equal(walk([{ kind: 'venue' }, { kind: 'shop' }]).scene, 'outfit')
  })
  test('a reserved ticket is only recorded from a real confirmation', () => {
    assert.equal(walk([{ kind: 'book' }]).ticketRef, null)
    assert.equal(walk([{ kind: 'book' }, { kind: 'reserved', ref: 'HL-1', total: 80, booked: true }]).ticketRef, 'HL-1')
  })
})

describe('stores', () => {
  const w = world()
  const shoppers: Intent[] = [{ kind: 'venue' }, { kind: 'pick', id: 'vampire' }, { kind: 'shop' }]
  test('asking where to buy opens the store selector, like the club selector', () => {
    const spec = compose(walk(shoppers, w), w)
    assert.equal(spec.view, 'store-selector')
    assert.equal(spec.places, 'stores')
    assert.equal(spec.openFloor, null)
  })
  test('picking a store zooms to it with three articles', () => {
    const j = walk([...shoppers, { kind: 'pickShop', id: 'fundus' }], w)
    const spec = compose(j, w)
    assert.equal(spec.view, 'store')
    assert.equal(spec.storeId, 'fundus')
    assert.equal(spec.primitive, 'store-articles')
    assert.equal(articlesFor(OUTFITS[0], SHOPS[1]).length, 3)
  })
  test('each store prices the costume its own way', () => {
    assert.equal(articlesFor(OUTFITS[0], SHOPS[1])[0].price, 41)
    assert.equal(articlesFor(OUTFITS[0], SHOPS[2])[0].price, 61)
  })
  test('stepping back goes store → selector → outfit', () => {
    const j = walk([...shoppers, { kind: 'pickShop', id: 'fundus' }, { kind: 'back' }], w)
    assert.equal(compose(j, w).view, 'store-selector')
    assert.equal(walk([...shoppers, { kind: 'pickShop', id: 'fundus' }, { kind: 'back' }, { kind: 'back' }], w).scene, 'outfit')
  })
  test('held articles keep you at that store and count towards the price', () => {
    const article = articlesFor(OUTFITS[0], SHOPS[0])[1]
    const j = walk([...shoppers, { kind: 'pickShop', id: 'maskenkammer' }, { kind: 'articleReserved', article, ref: 'MA-1' }, { kind: 'shop' }], w)
    assert.equal(j.shop, 'maskenkammer')
    assert.equal(unitPrice(j), 49 + 12)
  })
  test('a shelf can run out', () => {
    assert.equal(reserveStock(12, 4), 8)
    assert.throws(() => reserveStock(3, 4), /Only 3 left/)
  })
  test('a model cannot reserve articles', () => {
    assert.equal(validateModelIntent({ kind: 'reserveArticle', id: 'vampire-costume' }), null)
  })
})

describe('composer', () => {
  test('picks a view and primitive for each stage', () => {
    const w = world()
    const at = (intents: Intent[]) => compose(walk(intents, w), w)
    assert.equal(at([{ kind: 'basel' }]).view, 'city-day')
    assert.equal(at([{ kind: 'party' }]).view, 'city-night')
    assert.equal(at([{ kind: 'venue' }]).primitive, 'venue-hub')
    assert.equal(at([{ kind: 'floor', id: 'main-hall' }]).view, 'venue-interior')
    assert.equal(at([{ kind: 'outfit' }]).primitive, 'outfit-explorer')
    assert.equal(at([{ kind: 'casino' }]).route, 'to-casino')
    assert.equal(at([{ kind: 'plan' }]).places, 'itinerary')
  })
  test('can explain how the casino connects to the club', () => {
    const w = world()
    assert.deepEqual(compose(walk([{ kind: 'casino' }], w), w).why, [{ relation: 'near', source: 'curated' }])
  })
  test('survives any order: 3000 random intents never break the journey or the spec', () => {
    const w = world()
    const intents: Intent[] = [
      ...(['basel', 'party', 'venue', 'music', 'outfit', 'shop', 'casino', 'plan', 'back', 'money', 'book', 'reserve'] as const).map((kind) => ({ kind }) as Intent),
      ...w.club.floors.map((f) => ({ kind: 'floor', id: f.id }) as Intent),
      ...OUTFITS.map((o) => ({ kind: 'pick', id: o.id }) as Intent),
      ...COLORS.map((c) => ({ kind: 'color', id: c.id }) as Intent),
      ...SHOPS.map((s) => ({ kind: 'pickShop', id: s.id }) as Intent),
      ...(['music', 'floors', 'dress', 'events', null] as const).map((id) => ({ kind: 'tile', id }) as Intent),
      { kind: 'budget', max: 50 },
      { kind: 'vibe', id: 'Glam' },
    ]
    let seed = 42
    const next = () => (seed = (seed * 16807) % 2147483647) % intents.length
    let j = START
    for (let i = 0; i < 3000; i++) {
      const { patch, reply } = reduce(j, intents[next()], w)
      j = { ...j, ...patch }
      assert.ok(reply.length > 0)
      assert.doesNotMatch(reply, /undefined/)
      const spec = compose(j, w)
      assert.ok(spec.context.length >= 1)
      assert.ok(spec.view)
    }
  })
})
