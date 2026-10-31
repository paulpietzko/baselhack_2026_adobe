/**
 * What the business publishes for agents: an MCP endpoint (JSON-RPC over HTTP, stateless) with no
 * server for the owner to run. Any MCP client can discover the club, read its facts and reserve.
 */
import { rank } from '../engine/rank.ts'
import { checkAvailability, getBusiness, getWorld, reserveTickets } from './business.ts'
import { experience } from './experience.ts'

const PROTOCOL = '2025-03-26'

type Tool = { name: string; description: string; inputSchema: Record<string, unknown>; run: (args: Record<string, never>) => unknown | Promise<unknown> }

const people = { type: 'object', properties: { people: { type: 'integer', minimum: 1 } }, required: ['people'] }

const TOOLS: Tool[] = [
  {
    name: 'find_experiences',
    description: 'Find places in Basel that fit what someone wants, with the reasons each one was ranked.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    run: ({ query }) => rank(getWorld(), query, 5),
  },
  {
    name: 'get_business',
    description: 'The record a business published and approved itself: hours, entry, age, dress code, floors, tickets left.',
    inputSchema: { type: 'object', properties: {} },
    run: () => getBusiness(),
  },
  {
    name: 'check_availability',
    description: 'Check whether there are tickets for a group. Changes nothing.',
    inputSchema: people,
    run: ({ people: n }) => checkAvailability(n),
  },
  {
    name: 'reserve_tickets',
    description: 'Reserve tickets and get a confirmation reference. Only call this after the person has explicitly confirmed.',
    inputSchema: people,
    run: ({ people: n }) => reserveTickets(n),
  },
  {
    name: 'compose_experience',
    description: 'Turn what someone says, plus the journey so far, into the next experience spec: view, primitive, constraints and next steps.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' }, session: { type: 'object' } }, required: ['text'] },
    run: ({ text, session }) => experience(text, session),
  },
]

type Rpc = { jsonrpc: '2.0'; id?: string | number; method: string; params?: { name?: string; arguments?: Record<string, never> } }

/** Returns null for notifications, which get no reply */
export async function handleMcp(message: Rpc) {
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id: message.id, result })
  const fail = (code: number, text: string) => ({ jsonrpc: '2.0', id: message.id, error: { code, message: text } })
  if (message.id === undefined) return null
  switch (message.method) {
    case 'initialize':
      return reply({ protocolVersion: PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: 'acme-basel', version: '0.1.0' } })
    case 'ping':
      return reply({})
    case 'tools/list':
      return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) })
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === message.params?.name)
      if (!tool) return fail(-32602, `Unknown tool: ${message.params?.name}`)
      try {
        const result = await tool.run(message.params?.arguments ?? ({} as Record<string, never>))
        return reply({ content: [{ type: 'text', text: JSON.stringify(result) }] })
      } catch (e) {
        // A refusal is a result the agent should read, not a protocol failure
        return reply({ content: [{ type: 'text', text: (e as Error).message }], isError: true })
      }
    }
    default:
      return fail(-32601, `Unknown method: ${message.method}`)
  }
}
