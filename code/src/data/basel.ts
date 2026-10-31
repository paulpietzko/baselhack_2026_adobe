import { Building2, Ghost, Lock, Martini, Soup, type LucideIcon } from 'lucide-react'

export type Place = {
  id: string
  name: string
  /** e.g. "Tonight · 19:30" */
  time: string
  tag: string
  description: string
  lngLat: [number, number]
  /** Card header: background tint + icon (stand-in until we have photos) */
  icon: LucideIcon
  tint: string
  iconColor: string
  /** Card placement relative to the marker, like bako: angle in degrees (0 = right, 90 = down), distance in px */
  cardAngle: number
  cardDistance: number
  image?: string
}

export const BASEL_TITLE = 'Five places for your first day in Basel'

/** Where the camera ends up after flying in. Tweak center ([lng, lat]) to pan and zoom to zoom in/out. */
export const BASEL_CAMERA = { center: [7.5848, 47.5554] as [number, number], zoom: 14.25 }

// Halloween night out, in order of the evening
export const BASEL_PLACES: Place[] = [
  {
    id: 'escape-room',
    name: 'Escape Room “Die Gruft”',
    time: 'Tonight · 18:00',
    tag: 'Groups of 4–6',
    description: '60 minutes to break out of a medieval crypt.',
    lngLat: [7.5751474526515326, 47.55743717864846],
    icon: Lock,
    tint: '#2c2840',
    iconColor: '#a99ff0',
    cardAngle: 180,
    cardDistance: 260,
  },
  {
    id: 'night-market',
    name: 'Street-Food Night Market',
    time: 'Tonight · 19:30',
    tag: 'Free entry',
    description: 'Food trucks, pumpkin treats and fire pits.',
    lngLat: [7.5878, 47.5545],
    icon: Soup,
    tint: '#4a3222',
    iconColor: '#e8a571',
    cardAngle: -105,
    cardDistance: 200,
  },
  {
    id: 'hexenkessel',
    name: 'Hexenkessel Bar',
    time: 'Tonight · 21:00',
    tag: 'Costume = free shot',
    description: 'Witchy cocktails served in smoking glasses.',
    lngLat: [7.5926, 47.5565],
    icon: Martini,
    tint: '#3a2433',
    iconColor: '#e09ac4',
    cardAngle: -30,
    cardDistance: 230,
  },
  {
    id: 'club-rouge',
    name: 'Club Rouge',
    time: 'Tonight · 22:30',
    tag: '18+ · Costume party',
    description: 'Rooftop bar and club on the 31st floor.',
    lngLat: [7.59446528147669, 47.54905311106348],
    icon: Building2,
    tint: '#4a2226',
    iconColor: '#e8828a',
    cardAngle: 20,
    cardDistance: 230,
  },
  {
    id: 'neon-pumpkin',
    name: 'Neon Pumpkin Rave',
    time: 'Tonight · 00:30',
    tag: 'Glow dress code',
    description: 'UV lights and glow paint until sunrise.',
    lngLat: [7.586377081486984, 47.550733762418666],
    icon: Ghost, // Lucide has no pumpkin
    tint: '#2e2240',
    iconColor: '#f0a050',
    cardAngle: 205,
    cardDistance: 270,
  },
]
