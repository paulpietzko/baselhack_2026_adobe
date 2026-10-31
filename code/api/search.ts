// Vercel function: POST /api/search { query } → recommendations. The OpenAI key stays on the server.
import { discover } from '../server/agent'

export async function POST(request: Request) {
  try {
    const { query } = (await request.json()) as { query?: string }
    if (!query?.trim()) return Response.json({ error: 'Missing query' }, { status: 400 })
    return Response.json(await discover(query.trim()))
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
