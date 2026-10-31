import type { Business, Reservation } from '../../engine/business.ts'
import type { Article } from '../../engine/catalog.ts'
import type { Intent } from '../../engine/intent.ts'
import type { Journey } from '../../engine/journey.ts'

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body ? { method: 'POST', body: JSON.stringify(body) } : undefined)
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok || data.error) throw new Error(data.error ?? `${path} failed (${res.status})`)
  return data
}

/** The business's published presence: the same record the agent's tools read */
export const fetchBusiness = () => call<Business>('/api/business')
export const checkAvailability = (people: number) => call<{ available: boolean; ticketsLeft: number; total: number }>('/api/availability', { people })
/** For what the local rules can't place: the server may have a model to ask */
export const askEngine = (text: string, session: Journey) => call<{ intent: Intent | null; via: string }>('/api/experience', { text, session })
export const reserveArticle = (shop: string, outfit: string, article: string, people: number) =>
  call<{ ref: string; article: Article; left: number }>('/api/reserve-article', { shop, outfit, article, people })
export const reserve = (people: number) => call<Reservation>('/api/reserve', { people })
