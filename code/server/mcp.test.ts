import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getBusiness, publish } from './business.ts'
import { handleMcp } from './mcp.ts'

delete process.env.OPENAI_API_KEY

const rpc = (method: string, params?: object) => handleMcp({ jsonrpc: '2.0', id: 1, method, params } as never) as Promise<{ result: { content: { text: string }[]; isError?: boolean; tools: { name: string }[] } }>
const call = async (name: string, args: object = {}) => {
  const { result } = await rpc('tools/call', { name, arguments: args })
  return { isError: !!result.isError, text: result.content[0].text }
}

test('lists the tools', async () => {
  const { result } = await rpc('tools/list')
  assert.deepEqual(result.tools.map((t) => t.name), ['find_experiences', 'get_business', 'check_availability', 'reserve_tickets', 'compose_experience'])
})

test('notifications get no reply', async () => {
  assert.equal(await handleMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }), null)
})

test('an agent finds the club, reads what was published, and reserves', async () => {
  const found = JSON.parse((await call('find_experiences', { query: 'party tonight' })).text)
  assert.equal(found[0].id, 'acme/hafenlicht')
  const before = JSON.parse((await call('get_business')).text).ticketsLeft
  assert.equal(JSON.parse((await call('check_availability', { people: 4 })).text).available, true)
  const res = JSON.parse((await call('reserve_tickets', { people: 4 })).text)
  assert.match(res.ref, /^HL-/)
  assert.equal(getBusiness().ticketsLeft, before - 4)
})

test('sold out reaches the agent as an answer, and takes nothing', async () => {
  const before = getBusiness().ticketsLeft
  const res = await call('reserve_tickets', { people: 9999 })
  assert.equal(res.isError, true)
  assert.match(res.text, /tickets left/)
  assert.equal(getBusiness().ticketsLeft, before)
})

test('an owner edit is what the next agent reads', async () => {
  const b = getBusiness()
  const profile = Object.entries({ name: b.name, tagline: b.tagline, entry: b.entry, dress: 'Capes mandatory' }).map(([key, value]) => ({ key, value }))
  publish(profile, b.floors)
  assert.equal(JSON.parse((await call('get_business')).text).dress, 'Capes mandatory')
})

test('composes an experience from a sentence, carrying the journey', async () => {
  const res = JSON.parse((await call('compose_experience', { text: 'Now find us a casino', session: { scene: 'outfit', outfit: 'vampire', floor: 'main-hall' } })).text)
  assert.equal(res.via, 'rules')
  assert.equal(res.spec.view, 'destination')
  assert.equal(res.spec.constraints.outfit, 'Vampire noir')
})

test('without a model it says it could not place a sentence', async () => {
  const res = JSON.parse((await call('compose_experience', { text: 'xyzzy' })).text)
  assert.equal(res.intent, null)
  assert.equal(res.via, 'none')
})
