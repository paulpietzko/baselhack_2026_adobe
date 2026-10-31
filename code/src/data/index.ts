import data from './chats.json'

export const user = data.user
export const chats = data.chats
export const findChat = (id?: string) => chats.find((c) => c.id === id)
