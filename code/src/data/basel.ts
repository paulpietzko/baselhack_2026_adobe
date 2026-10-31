import { Building2, Dices, Ghost, Landmark, Martini, PawPrint, Shirt, Waves, type LucideIcon } from 'lucide-react'

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

export const BASEL_TITLE = 'A few places for your day in Basel'

/** Where the camera ends up after flying in. Tweak center ([lng, lat]) to pan and zoom to zoom in/out. */
export const BASEL_CAMERA = { center: [7.5848, 47.5554] as [number, number], zoom: 14.25 }

export type Camera = { center: [number, number]; zoom: number; pitch: number; bearing: number; duration: number; offset?: [number, number] }

/** Map camera per stage of the evening. offset keeps the pin low on screen, so the 3D model can stand on it. */
export const CAMERAS: Record<'day' | 'party' | 'venue' | 'casino' | 'plan', Camera> = {
  day: { ...BASEL_CAMERA, pitch: 0, bearing: 0, duration: 2500 },
  party: { center: [7.588, 47.569], zoom: 13.05, pitch: 45, bearing: -12, duration: 2200 },
  venue: { center: [7.5925, 47.5835], zoom: 17.6, pitch: 62, bearing: 24, duration: 2600, offset: [0, 130] },
  casino: { center: [7.5615, 47.577], zoom: 17.2, pitch: 60, bearing: -32, duration: 3400, offset: [0, 130] },
  plan: { center: [7.578, 47.571], zoom: 13.1, pitch: 40, bearing: -8, duration: 2600, offset: [-90, -50] },
}

// First answer to "what can I do in Basel?": a nice day, wrong mood
export const BASEL_DAY_PLACES: Place[] = [
  {
    id: 'kunstmuseum',
    name: 'Kunstmuseum Basel',
    time: 'Today · until 18:00',
    tag: 'Art',
    description: 'One of the oldest public art collections in the world.',
    lngLat: [7.5942, 47.5541],
    icon: Landmark,
    tint: '#2c2840',
    iconColor: '#a99ff0',
    cardAngle: 25,
    cardDistance: 230,
  },
  {
    id: 'rhine',
    name: 'Rhine Promenade',
    time: 'Today · sunset 17:20',
    tag: 'Outdoors',
    description: 'Walk the river and cross by the little ferry.',
    lngLat: [7.5912, 47.5602],
    icon: Waves,
    tint: '#1f3540',
    iconColor: '#7cc4e8',
    cardAngle: -40,
    cardDistance: 220,
  },
  {
    id: 'spalentor',
    name: 'Spalentor',
    time: 'Today · always open',
    tag: 'Old town',
    description: 'The medieval city gate, a short walk from the market.',
    lngLat: [7.5817, 47.5583],
    icon: Building2,
    tint: '#4a3222',
    iconColor: '#e8a571',
    cardAngle: 190,
    cardDistance: 150,
  },
  {
    id: 'zoo',
    name: 'Zoo Basel',
    time: 'Today · until 17:30',
    tag: 'Family',
    description: 'The Zolli, Switzerland’s oldest zoo.',
    lngLat: [7.5786, 47.5477],
    icon: PawPrint,
    tint: '#23402c',
    iconColor: '#86d29a',
    cardAngle: 180,
    cardDistance: 120,
  },
]

// The club from the vendor portal: it published its building, so it's the one the crew can walk into
export const HAFENLICHT_PLACE: Place = {
  id: 'hafenlicht',
  name: 'Hafenlicht',
  time: 'Tonight · 23:00',
  tag: 'Masked · Rooftop club',
  description: 'Techno above the Rhine harbour. Walk in before you commit.',
  lngLat: [7.5925, 47.5835],
  icon: Building2,
  tint: '#4a2226',
  iconColor: '#e8828a',
  cardAngle: 8,
  cardDistance: 180,
}

export const CASINO_PLACE: Place = {
  id: 'casino',
  name: 'Casino Nocturne',
  time: 'Tonight · 02:30',
  tag: '18+ · ID required',
  description: 'Roulette and poker to round out the night.',
  lngLat: [7.5615, 47.577],
  icon: Dices,
  tint: '#403218',
  iconColor: '#f0c050',
  cardAngle: -100,
  cardDistance: 150,
}

export const pickupPlace = (name: string, lngLat: [number, number]): Place => ({
  id: 'pickup',
  name,
  time: 'Tonight · 19:30',
  tag: 'Costumes for 4',
  description: 'On the way, before the first drink.',
  lngLat,
  icon: Shirt,
  tint: '#3a2433',
  iconColor: '#e09ac4',
  cardAngle: 175,
  cardDistance: 170,
})

// Hafenlicht to the casino, over the Dreirosen bridge
export const ROUTE_TO_CASINO: [number, number][] = [
  [7.5925, 47.5835],
  [7.5905, 47.575],
  [7.5868, 47.5722],
  [7.5815, 47.57],
  [7.576, 47.5735],
  [7.5615, 47.577],
]

// Old town up to Hafenlicht, along the Klybeck side of the Rhine
export const ROUTE_TO_CLUB: [number, number][] = [
  [7.5895, 47.5595],
  [7.5912, 47.565],
  [7.5905, 47.575],
  [7.5925, 47.5835],
]

// Halloween night out, in order of the evening
export const BASEL_PLACES: Place[] = [
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
    cardAngle: 20,
    cardDistance: 170,
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
    cardAngle: 180,
    cardDistance: 170,
  },
  HAFENLICHT_PLACE,
]
