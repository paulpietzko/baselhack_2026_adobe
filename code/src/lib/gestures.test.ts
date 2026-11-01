import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createGestureReader, createSmoother, readHand, type HandFrame, type Point } from './gestures.ts'

const p = (x: number, y: number, z = 0): Point => ({ x, y, z })

/** A hand upright in metres. Each finger is straight or curled; the thumb rests away from the index unless pinching, which bends it. */
function hand({ index = true, middle = true, ring = true, little = true, pinch = false } = {}) {
  const finger = (x: number, straight: boolean) => (straight ? [p(x, 0.09), p(x, 0.12), p(x, 0.145), p(x, 0.17)] : [p(x, 0.09), p(x, 0.11), p(x, 0.085), p(x, 0.07)])
  const indexPoints = pinch ? [p(-0.03, 0.09), p(-0.03, 0.12), p(-0.03, 0.13), p(-0.03, 0.125)] : finger(-0.03, index)
  const thumbTip = pinch ? p(indexPoints[3].x + 0.01, indexPoints[3].y) : p(-0.09, 0.05)
  return [p(0, 0), p(-0.03, 0.02), p(-0.06, 0.04), p(-0.08, 0.05), thumbTip, ...indexPoints, ...finger(-0.01, middle), ...finger(0.01, ring), ...finger(0.03, little)]
}

const read = (world: Point[], wasPinching = false) => readHand(world.map((q) => p(0.5 + q.x, 0.5 - q.y)), world, wasPinching, 1)
const frame = (over: Partial<HandFrame> = {}): HandFrame => ({ x: 0.5, y: 0.5, scale: 0.1, pose: 'point', pinching: false, ...over })

describe('readHand', () => {
  it('tells the poses apart', () => {
    assert.equal(read(hand()).pose, 'palm')
    assert.equal(read(hand({ middle: false, ring: false, little: false })).pose, 'point')
    assert.equal(read(hand({ index: false, middle: false, ring: false, little: false })).pose, 'fist')
    assert.equal(read(hand({ index: true, middle: true, ring: false, little: false })).pose, 'open')
  })

  it('sees a pinch, and holds it through the gap between closing and opening', () => {
    assert.equal(read(hand({ pinch: true })).pinching, true)
    assert.equal(read(hand()).pinching, false)
    const inBetween = hand({ pinch: true })
    inBetween[4] = p(inBetween[8].x + 0.035, inBetween[8].y)
    assert.equal(read(inBetween, false).pinching, false)
    assert.equal(read(inBetween, true).pinching, true)
  })

  it('does not take a fist for a pinch, even with the thumb against the index', () => {
    const fist = hand({ index: false, middle: false, ring: false, little: false })
    fist[4] = p(fist[8].x + 0.01, fist[8].y)
    assert.equal(read(fist).pinching, false)
    assert.equal(read(fist).pose, 'fist')
  })

  it('does not take a straight finger with the thumb crossing behind it for a pinch', () => {
    const crossed = hand()
    crossed[4] = p(crossed[8].x + 0.01, crossed[8].y)
    assert.equal(read(crossed).pinching, false)
  })

  it('mirrors, so moving your hand to the right moves the cursor to the right', () => {
    const left = readHand(hand().map((q) => p(0.3 + q.x, 0.5 - q.y)), hand(), false)
    const right = readHand(hand().map((q) => p(0.6 + q.x, 0.5 - q.y)), hand(), false)
    assert.ok(left.x > right.x)
  })
})

describe('gesture reader', () => {
  const run = (frames: [HandFrame | null, number][]) => {
    const reader = createGestureReader()
    return frames.flatMap(([f, t]) => reader.read(f, t))
  }

  it('talks only after a palm has been held, and only once', () => {
    assert.deepEqual(run([[frame({ pose: 'palm' }), 0], [frame({ pose: 'palm' }), 200]]), [])
    const events = run([0, 200, 500, 800, 1500].map((t) => [frame({ pose: 'palm' }), t]))
    assert.deepEqual(events, [{ type: 'talk' }])
  })

  it('does not talk for a palm passing through', () => {
    assert.deepEqual(run([0, 100, 200, 300, 400, 500, 600].map((t, i) => [frame({ pose: 'palm', x: i * 0.1 }), t])), [])
  })

  it('cancels on a held fist', () => {
    assert.deepEqual(run([[frame({ pose: 'fist' }), 0], [frame({ pose: 'fist' }), 500]]), [{ type: 'cancel' }])
  })

  it('ignores a pinch that lasts a single reading', () => {
    assert.deepEqual(run([[frame({ pinching: true }), 0], [frame(), 50], [frame({ pinching: true }), 100], [frame(), 150]]), [])
  })

  it('reports a pinch opening and closing', () => {
    const events = run([[frame({ pinching: true }), 0], [frame({ pinching: true }), 50], [frame(), 100], [frame(), 150]])
    assert.deepEqual(events, [{ type: 'pinchStart' }, { type: 'pinchEnd', lost: false, zoomed: false }])
  })

  it('zooms once when a pinch is pulled in, and spends the pinch on it', () => {
    const scales = [0.1, 0.1, 0.1, 0.16, 0.2, 0.2, 0.2]
    const events = run([...scales.map((scale, i) => [frame({ pinching: true, scale }), i * 50] as [HandFrame, number]), [frame({ scale: 0.2 }), 350], [frame({ scale: 0.2 }), 400]])
    assert.deepEqual(events, [{ type: 'pinchStart' }, { type: 'zoom', dir: 'in' }, { type: 'pinchEnd', lost: false, zoomed: true }])
  })

  it('zooms out when a pinch is pushed away', () => {
    const events = run([0.1, 0.1, 0.1, 0.07, 0.05, 0.05].map((scale, i) => [frame({ pinching: true, scale }), i * 50]))
    assert.deepEqual(events, [{ type: 'pinchStart' }, { type: 'zoom', dir: 'out' }])
  })

  it('survives a dropped reading mid-pinch, but not a hand that left', () => {
    const on = frame({ pinching: true })
    assert.deepEqual(run([[on, 0], [on, 50], [null, 100], [on, 150]]), [{ type: 'pinchStart' }])
    assert.deepEqual(run([[on, 0], [on, 50], [null, 100], [null, 500]]), [{ type: 'pinchStart' }, { type: 'pinchEnd', lost: true, zoomed: false }])
  })
})

describe('smoother', () => {
  it('calms jitter on a still hand and keeps up with a moving one', () => {
    const smooth = createSmoother()
    let out = 0
    for (let i = 0; i < 40; i++) out = smooth(0.5 + (i % 2 ? 0.01 : -0.01), i * 50)
    assert.ok(Math.abs(out - 0.5) < 0.006)
    for (let i = 40; i < 50; i++) out = smooth(0.5 + (i - 39) * 0.04, i * 50)
    assert.ok(Math.abs(out - 0.9) < 0.05)
  })
})
