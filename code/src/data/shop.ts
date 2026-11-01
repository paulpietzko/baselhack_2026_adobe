import type { ColorId, OutfitId } from './costumes'

/** Where the costumes are tonight: a shopping mall in the old town. Hand-written demo data. */
export const SHOP = {
  name: 'Freie Galerie',
  kind: 'Shopping mall',
  address: 'Freie Strasse, Basel',
  lngLat: [7.588748454362368, 47.55693114412515] as [number, number],
  open: 'Halloween late opening · until 22:00',
  closesAt: '22:00',
  popUp: 'Halloween pop-up, Level 2',
}

/** Store levels, bottom to top, for the route through the mall */
export const SHOP_LEVELS = ['Ground floor', 'Level 1', 'Level 2'] as const
export type ShopLevel = (typeof SHOP_LEVELS)[number]

export type Piece = {
  name: string
  price: number
  level: ShopLevel
  /** Shelf inside the level */
  spot: string
  /** Comes in the colour you picked (the rest is black) */
  colored?: boolean
}

/** What each look is made of. Prices add up to the outfit's price in costumes.ts */
export const PIECES: Record<OutfitId, Piece[]> = {
  vampire: [
    { name: 'Velvet cape', price: 22, level: 'Level 2', spot: 'Pop-up, rail 3', colored: true },
    { name: 'Tailored waistcoat', price: 14, level: 'Level 1', spot: 'Menswear, aisle B' },
    { name: 'Lace half mask', price: 9, level: 'Ground floor', spot: 'Accessories' },
    { name: 'Fangs', price: 4, level: 'Ground floor', spot: 'Till 2' },
  ],
  skeleton: [
    { name: 'UV bones bodysuit', price: 24, level: 'Level 2', spot: 'Pop-up, rail 1' },
    { name: 'Skull mask', price: 8, level: 'Level 2', spot: 'Pop-up, masks wall' },
    { name: 'Glow gloves', price: 3, level: 'Ground floor', spot: 'Till 2', colored: true },
  ],
  witch: [
    { name: 'Corset gown', price: 110, level: 'Level 1', spot: 'Eveningwear', colored: true },
    { name: 'Couture hat', price: 45, level: 'Level 2', spot: 'Pop-up, millinery' },
    { name: 'Lace mask', price: 18, level: 'Ground floor', spot: 'Accessories' },
    { name: 'Broom clutch', price: 7, level: 'Ground floor', spot: 'Bags' },
  ],
}

/** Left on the rails tonight, per colour. The crew is three, so anything under 3 needs a plan B */
export const STOCK: Record<OutfitId, Record<ColorId, number>> = {
  vampire: { crimson: 9, midnight: 6, emerald: 4 },
  skeleton: { crimson: 12, midnight: 12, emerald: 7 },
  witch: { crimson: 5, midnight: 2, emerald: 4 },
}

export const SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const
