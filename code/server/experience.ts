/**
 * Intent in, experience out, over the network. The browser runs the same engine locally for instant
 * response and only comes here for what its rules can't place; other agents can use it for everything.
 */
import { compose } from '../engine/compose.ts'
import { resolveIntent, type IntentModel } from '../engine/intent.ts'
import { START, reduce, type Journey } from '../engine/journey.ts'
import { getWorld } from './business.ts'

const INTENT_SCHEMA = {
  name: 'intent',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'id'],
    properties: {
      kind: { type: 'string', enum: ['basel', 'party', 'venue', 'music', 'outfit', 'shop', 'casino', 'plan', 'back', 'money', 'floor', 'tile', 'pick', 'color', 'pickShop', 'vibe', 'unknown'] },
      id: { type: ['string', 'null'], description: 'floor: main-hall|rooftop|entrance. tile: music|floors|dress|events. pick: vampire|skeleton|witch. color: crimson|midnight|emerald. pickShop: maskenkammer|fundus|atelier. vibe: Scary|Funny|Glam. Otherwise null.' },
    },
  },
}

/** Asks the model which intent a sentence means. Its answer is validated by the engine before it's used. */
const openAiIntent: IntentModel = async (text, context) => {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: `Map what the user says to one intent for a group planning a night out in Basel. Use "unknown" if none fits. Current state: ${context}` },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_schema', json_schema: INTENT_SCHEMA },
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}`)
  const data = (await res.json()) as { choices: { message: { content: string } }[] }
  return JSON.parse(data.choices[0].message.content)
}

export async function experience(text: string, session: Partial<Journey> = {}) {
  const journey: Journey = { ...START, ...session }
  const world = getWorld()
  const { intent, via } = await resolveIntent(text, JSON.stringify(compose(journey, world).constraints), process.env.OPENAI_API_KEY ? openAiIntent : undefined)
  if (!intent) return { intent: null, via, reply: null, session: journey, spec: compose(journey, world) }
  const { patch, reply } = reduce(journey, intent, world)
  const next = { ...journey, ...patch }
  return { intent, via, reply, session: next, spec: compose(next, world) }
}
