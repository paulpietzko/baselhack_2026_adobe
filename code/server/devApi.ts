import type { Plugin, ViteDevServer } from 'vite'
import type { Connect } from 'vite'
import type { ServerResponse } from 'node:http'

async function readJson(req: Connect.IncomingMessage) {
  let body = ''
  for await (const chunk of req) body += chunk
  return body ? JSON.parse(body) : {}
}

function send(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

/** The search agent and the business's published presence, served by the Vite dev server */
export function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server: ViteDevServer) {
      const business = () => server.ssrLoadModule('/server/business.ts')
      const route = (path: string, handler: (body: Record<string, never>, method: string) => Promise<unknown>) =>
        server.middlewares.use(path, async (req, res) => {
          try {
            send(res, 200, await handler(await readJson(req), req.method ?? 'GET'))
          } catch (e) {
            send(res, 400, { error: (e as Error).message })
          }
        })

      route('/api/experience', async ({ text, session }) => (await server.ssrLoadModule('/server/experience.ts')).experience(text, session))
      // What other agents connect to. Stateless, so there's no event stream to offer on GET.
      server.middlewares.use('/mcp', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end()
        }
        const reply = await (await server.ssrLoadModule('/server/mcp.ts')).handleMcp(await readJson(req))
        if (!reply) {
          res.statusCode = 202
          return res.end()
        }
        send(res, 200, reply)
      })
      route('/api/search', async ({ query }) => (await server.ssrLoadModule('/server/agent.ts')).discover(query))
      route('/api/business', async ({ profile, floors }, method) => {
        const b = await business()
        return method === 'POST' ? b.publish(profile, floors) : b.getBusiness()
      })
      route('/api/availability', async ({ people }) => (await business()).checkAvailability(people))
      route('/api/reserve-article', async ({ shop, outfit, article, people }) => (await business()).reserveArticle(shop, outfit, article, people))
      route('/api/reserve', async ({ people }) => (await business()).reserveTickets(people))
    },
  }
}
