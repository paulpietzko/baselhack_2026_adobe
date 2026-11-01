/** After the mall, the crew heads out to the casino by the airport road. Hand-written demo data. */
export const CASINO = {
  name: 'Grand Casino Basel',
  kind: 'Casino',
  address: 'Flughafenstrasse 225, Basel',
  lngLat: [7.563202824066165, 47.57420712878559] as [number, number],
  image: '/casino.jpg',
  open: 'until 04:00',
  entry: 'Free · 18+ with ID',
  /** Gold, for the building and the beacon */
  color: '#d4af37',
}

/** Tonight's promo, for the ad banner */
export const JACKPOT = {
  title: 'Halloween Mystery Jackpot',
  start: 66_666.66,
  drop: 'Must drop before 03:00 · on any slot',
  offer: 'Come in costume: CHF 20 free play each',
  fineprint: '18+ with ID. Play responsibly.',
}

/** Tables tonight, with the minimum bet */
export const TABLES = [
  { game: 'American Roulette', min: 5, open: 'from 19:00' },
  { game: 'Black Jack', min: 10, open: 'from 19:00' },
  { game: 'Texas Hold’em Poker', min: 20, open: 'Tournament 21:00' },
  { game: 'Slots', min: 1, open: 'all night' },
]
