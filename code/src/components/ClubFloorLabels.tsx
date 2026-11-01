import { useEffect, useRef } from 'react'
import type mapboxgl from 'mapbox-gl'

/** The club's real building on the map: its footprint and how tall it is (meters) */
export type ClubBuilding = { id: string | number; ring: [number, number][]; base: number; height: number }

export type FloorLabel = {
  /** Fill-extrusion layer of this floor, its hover lives in that layer's feature-state key */
  layerId: string
  /** Bottom and top of the floor as a fraction of the building's height */
  from: number
  to: number
  title: string
  subtitle: string
  /** Which side of the building the label hangs off */
  side: 'left' | 'right'
  onClick: () => void
}

const EARTH_M = 40075016.686
const GAP_PX = 14
// Floors can be only a few pixels apart on screen: labels stack with at least this much space between them
const STACK_GAP_PX = 6

/**
 * Glass labels hanging off the left side of the club's clay floors, so it's clear they can be clicked.
 * `floors` go top to bottom.
 * Mapbox can't project a point at an altitude, so each label sits at the leftmost corner of the footprint and is lifted by the
 * floor's height on screen (meters → pixels at this zoom, foreshortened by the pitch). Close enough for a building this size.
 */
export default function ClubFloorLabels({ map, building, floors }: { map: mapboxgl.Map; building: ClubBuilding; floors: FloorLabel[] }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const place = () => {
      const corners = building.ring.map((c) => map.project(c))
      const anchor = {
        left: corners.reduce((a, b) => (b.x < a.x ? b : a)),
        right: corners.reduce((a, b) => (b.x > a.x ? b : a)),
      }
      const lat = building.ring[0][1]
      const pxPerMeter = (512 * 2 ** map.getZoom()) / (EARTH_M * Math.cos((lat * Math.PI) / 180))
      const lift = pxPerMeter * Math.sin((map.getPitch() * Math.PI) / 180)
      // Top to bottom, as given; each label at the middle of its floor, but never overlapping the one above on the same side
      const below = { left: -Infinity, right: -Infinity }
      floors.forEach((f, i) => {
        const el = refs.current[i]
        if (!el) return
        const at = anchor[f.side]
        const meters = building.base + (building.height - building.base) * ((f.from + f.to) / 2)
        const half = el.offsetHeight / 2
        const y = Math.max(at.y - meters * lift, below[f.side] + STACK_GAP_PX + half)
        below[f.side] = y + half
        el.style.transform =
          f.side === 'left'
            ? `translate(${at.x - GAP_PX}px, ${y}px) translate(-100%, -50%)`
            : `translate(${at.x + GAP_PX}px, ${y}px) translate(0, -50%)`
      })
    }
    place()
    map.on('render', place)
    return () => {
      map.off('render', place)
    }
  }, [map, building, floors])

  // Hovering a label lights up its floor on the building, like hovering the floor itself
  const hover = (layerId: string, on: boolean) =>
    map.setFeatureState({ source: 'composite', sourceLayer: 'building', id: building.id }, { [layerId]: on })

  return (
    <>
      {floors.map((f, i) => (
        <button
          key={f.layerId}
          ref={(el) => {
            refs.current[i] = el
          }}
          onClick={f.onClick}
          onMouseEnter={() => hover(f.layerId, true)}
          onMouseLeave={() => hover(f.layerId, false)}
          className={`group spatial-glass absolute top-0 left-0 z-10 flex animate-fade-in items-center gap-3 overflow-hidden rounded-[20px] py-2.5 text-left text-ink outline outline-1 outline-transparent transition-[outline-color] duration-300 hover:outline-clay/70 [&.hand-focus]:outline-clay/70 ${
            f.side === 'left' ? 'pr-3.5 pl-4' : 'flex-row-reverse pr-4 pl-3.5'
          }`}
        >
          {/* Hover: a warm clay wash fades in behind the text, nothing moves */}
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-clay/25 to-clay/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-[.hand-focus]:opacity-100" />
          <span className="relative">
            <span className="block font-display text-base leading-tight whitespace-nowrap transition-colors duration-300 group-hover:text-clay group-[.hand-focus]:text-clay">{f.title}</span>
            <span className="block text-xs whitespace-nowrap text-muted">{f.subtitle}</span>
          </span>
          <span className="relative size-2.5 rounded-full bg-clay shadow-[0_0_10px_2px_rgb(217_119_87/0.6)] transition-shadow duration-300 group-hover:shadow-[0_0_18px_6px_rgb(217_119_87/0.95)]" />
        </button>
      ))}
    </>
  )
}
