import data from './vendor.json'
import type { ClubConfig } from '../components/acme/Venue'

export type Field = (typeof data.profile)[number]
export type Space = Omit<(typeof data.spaces)[number], 'config'> & { config: ClubConfig }

export const vendor = { ...data, spaces: data.spaces as Space[] }
