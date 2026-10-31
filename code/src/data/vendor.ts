import data from './vendor.json'

export type Field = (typeof data.profile)[number]
export type Floor = (typeof data.floors)[number]
export type Room = Floor['rooms'][number]

export const vendor = data
