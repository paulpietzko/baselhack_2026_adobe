export type Place = {
  id: string
  name: string
  description: string
  meta: string
  lngLat: [number, number]
  /** Card placement relative to the marker, like bako: angle in degrees (0 = right, 90 = down), distance in px */
  cardAngle: number
  cardDistance: number
  /** Placeholder until we have real photos */
  image?: string
}

/** Screen space (px) kept free around the places when fitting the camera, so the cards fit around them */
export const BASEL_FIT_PADDING = { top: 300, bottom: 320, left: 340, right: 340 }

export const BASEL_PLACES: Place[] = [
  {
    id: 'muenster',
    name: 'Basler Münster',
    description: 'Red sandstone cathedral; the Pfalz terrace overlooks the Rhine.',
    meta: 'Landmark · 1h',
    lngLat: [7.5926, 47.5565],
    cardAngle: -30,
    cardDistance: 230,
  },
  {
    id: 'rathaus',
    name: 'Marktplatz & Rathaus',
    description: 'The bright red town hall on the market square.',
    meta: 'Old town · 30 min',
    lngLat: [7.5881, 47.5581],
    cardAngle: -120,
    cardDistance: 200,
  },
  {
    id: 'kunstmuseum',
    name: 'Kunstmuseum Basel',
    description: 'One of the oldest public art collections in the world.',
    meta: 'Museum · 2h',
    lngLat: [7.5941, 47.5541],
    cardAngle: 20,
    cardDistance: 230,
  },
  {
    id: 'spalentor',
    name: 'Spalentor',
    description: 'Medieval gate from the old city wall.',
    meta: 'Landmark · 20 min',
    lngLat: [7.5813, 47.5588],
    cardAngle: 180,
    cardDistance: 220,
  },
]
