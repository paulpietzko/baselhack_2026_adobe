import data from './chats.json'

export type Embed = { title: string; src: string; height: number }
export type Message = { role: 'user' | 'assistant'; content: string; embed?: Embed }
export type Chat = { id: string; title: string; messages?: Message[] }

export const user = data.user
export const chats = data.chats as Chat[]
export const findChat = (id?: string) => chats.find((c) => c.id === id)
