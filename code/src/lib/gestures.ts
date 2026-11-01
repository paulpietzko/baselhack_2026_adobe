/**
 * Hand landmarks → what the hand is doing. No camera or DOM in here, so all of it can be tested.
 * The vocabulary is small on purpose: an audience can read six gestures, and a demo can survive them.
 */
export type Point = { x: number; y: number; z: number }
export type Pose = 'point' | 'palm' | 'fist' | 'open'
export type HandFrame = {
  /** Where the hand is, 0 to 1 across the screen, already mirrored */
  x: number
  y: number
  /** Apparent size of the palm: grows as the hand comes towards the camera */
  scale: number
  pose: Pose
  pinching: boolean
}
export type GestureEvent =
  | { type: 'talk' }
  | { type: 'cancel' }
  | { type: 'pinchStart' }
  /** `lost`: the hand left mid-pinch, so nothing should be chosen. `zoomed`: the pinch was spent on a zoom. */
  | { type: 'pinchEnd'; lost: boolean; zoomed: boolean }
  | { type: 'zoom'; dir: 'in' | 'out' }

const WRIST = 0
const THUMB_TIP = 4
const INDEX_MCP = 5
const INDEX_TIP = 8
const MIDDLE_MCP = 9
const PINKY_MCP = 17
// [tip, middle joint] of the index, middle, ring and little fingers
const FINGERS = [[8, 6], [12, 10], [16, 14], [20, 18]]

// Straight fingers put the tip well beyond the middle joint, seen from the wrist. Curled ones bring it back.
const EXTENDED = 1.15
// Thumb to index as the camera sees it, in palm lengths. Depth is too noisy to judge touching: real pinches measured
// 0.1 here but 0.55 in world space, the same as an open hand. Closes and opens at different gaps, or it would chatter.
const PINCH_CLOSE = 0.3
const PINCH_OPEN = 0.45
// Only a partly bent index is pinching: folded right back is a fist, straight is a thumb crossing behind it
const REACH_MIN = 0.85
const REACH_MAX = 1.15
const REACH_MAX_HELD = 1.25
// The middle of the camera image reaches the whole screen, so nobody has to stretch to the corners
const REACH = { x0: 0.18, x1: 0.82, y0: 0.15, y1: 0.75 }

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * One detection → one frame. `image` is normalised to the camera picture, for where the hand is.
 * `world` is in metres around the hand, for its shape, which doesn't change with distance.
 */
export function readHand(image: Point[], world: Point[], wasPinching: boolean, aspect = 4 / 3): HandFrame {
  const flat = (a: Point, b: Point) => Math.hypot((a.x - b.x) * aspect, a.y - b.y)
  const gap = flat(image[THUMB_TIP], image[INDEX_TIP]) / flat(image[WRIST], image[INDEX_MCP])
  const reach = dist(world[INDEX_TIP], world[WRIST]) / dist(world[6], world[WRIST])
  const pinching = gap < (wasPinching ? PINCH_OPEN : PINCH_CLOSE) && reach > REACH_MIN && reach < (wasPinching ? REACH_MAX_HELD : REACH_MAX)
  const extended = FINGERS.map(([tip, joint]) => dist(world[tip], world[WRIST]) > dist(world[joint], world[WRIST]) * EXTENDED)
  const count = extended.filter(Boolean).length
  const pose: Pose = count === 4 ? 'palm' : count === 0 ? 'fist' : extended[0] && count === 1 ? 'point' : 'open'

  // The knuckle, not the fingertip: it stays put while the finger closes a pinch, so the target doesn't slip away
  const at = image[INDEX_MCP]
  return {
    x: clamp01((1 - at.x - REACH.x0) / (REACH.x1 - REACH.x0)),
    y: clamp01((at.y - REACH.y0) / (REACH.y1 - REACH.y0)),
    scale: (flat(image[WRIST], image[INDEX_MCP]) + flat(image[WRIST], image[PINKY_MCP]) + flat(image[INDEX_MCP], image[PINKY_MCP])) / 3,
    pose,
    pinching,
  }
}

// Held this long before it counts, so a passing hand doesn't talk or cancel
const POSE_HOLD_MS = 450
// How far a raised palm may wander and still be a deliberate one
const POSE_DRIFT = 0.06
// Webcams drop a hand for a frame or two. Longer than this and it has really gone.
const LOST_MS = 300
// Readings in a row before a pinch opens or closes
const PINCH_FRAMES = 2
// Pull in further than pushing out: reaching towards the camera comes more naturally
const ZOOM_IN = 0.3
const ZOOM_OUT = -0.22

export type GestureReader = {
  read: (frame: HandFrame | null, now: number) => GestureEvent[]
  /** How far the current pinch has been pulled (+) or pushed (-), as a share of the way to zooming */
  pull: () => number
  pinching: () => boolean
}

export function createGestureReader(): GestureReader {
  let pinching = false
  let flips = 0
  let baseScale = 0
  let scale = 0
  let zoomed = false
  let lastSeen = -Infinity
  let pose: Pose | null = null
  let poseSince = 0
  let poseAt = { x: 0, y: 0 }
  let fired = false

  const reset = () => {
    flips = 0
    pose = null
    fired = false
  }

  return {
    pull: () => {
      if (!pinching || !baseScale) return 0
      const grown = scale / baseScale - 1
      return grown >= 0 ? grown / ZOOM_IN : -grown / ZOOM_OUT
    },
    pinching: () => pinching,
    read(frame, now) {
      const events: GestureEvent[] = []
      if (!frame) {
        if (now - lastSeen > LOST_MS) {
          if (pinching) events.push({ type: 'pinchEnd', lost: true, zoomed })
          pinching = false
          reset()
        }
        return events
      }
      lastSeen = now
      scale = scale ? scale * 0.6 + frame.scale * 0.4 : frame.scale

      flips = frame.pinching !== pinching ? flips + 1 : 0
      if (flips >= PINCH_FRAMES) {
        pinching = frame.pinching
        flips = 0
        pose = null
        if (pinching) {
          baseScale = scale
          zoomed = false
          events.push({ type: 'pinchStart' })
        } else {
          events.push({ type: 'pinchEnd', lost: false, zoomed })
        }
      }

      if (pinching) {
        const grown = scale / baseScale - 1
        if (!zoomed && (grown >= ZOOM_IN || grown <= ZOOM_OUT)) {
          zoomed = true
          events.push({ type: 'zoom', dir: grown > 0 ? 'in' : 'out' })
        }
        return events
      }

      if (frame.pose !== pose) {
        pose = frame.pose
        poseSince = now
        poseAt = { x: frame.x, y: frame.y }
        fired = false
      } else if (Math.hypot(frame.x - poseAt.x, frame.y - poseAt.y) > POSE_DRIFT && pose === 'palm' && !fired) {
        poseSince = now
        poseAt = { x: frame.x, y: frame.y }
      }
      if (!fired && now - poseSince >= POSE_HOLD_MS) {
        if (pose === 'palm') events.push({ type: 'talk' })
        if (pose === 'fist') events.push({ type: 'cancel' })
        fired = pose === 'palm' || pose === 'fist'
      }
      return events
    },
  }
}

/**
 * The One Euro filter: heavy smoothing while the hand is nearly still, which removes jitter,
 * and almost none while it moves fast, which removes lag.
 */
export function createSmoother(minCutoff = 1.2, beta = 8) {
  let last: number | null = null
  let lastSpeed = 0
  let lastTime = 0
  const blend = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt))
  return (value: number, now: number) => {
    if (last === null) {
      last = value
      lastTime = now
      return value
    }
    const dt = Math.max((now - lastTime) / 1000, 0.001)
    const k = blend(1, dt)
    lastSpeed = k * ((value - last) / dt) + (1 - k) * lastSpeed
    const a = blend(minCutoff + beta * Math.abs(lastSpeed), dt)
    last = a * value + (1 - a) * last
    lastTime = now
    return last
  }
}
