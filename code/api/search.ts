// Vercel function: POST /api/search { query } → newline-delimited JSON events, so the chat can show what's being
// searched while it happens: {"step":"night clubs, bars"} … {"result":{…}}, later {"photos":{id: url}} (street photos
// for places without their own), or {"error":"…"}. The OpenAI key stays on the server.
import { nearbyFor, search } from '../server/agent'

export async function POST(request: Request) {
  const { query } = (await request.json()) as { query?: string }
  if (!query?.trim()) return Response.json({ error: 'Missing query' }, { status: 400 })

  const encoder = new TextEncoder()
  const body = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      try {
        const result = await search(query.trim(), (step) => send({ step }))
        send({ result })
        const photos = await nearbyFor(result.places)
        if (Object.keys(photos).length) send({ photos })
      } catch (e) {
        send({ error: (e as Error).message })
      }
      controller.close()
    },
  })
  return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } })
}
