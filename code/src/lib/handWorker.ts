/**
 * The hand model, in its own thread. Building it locks up whatever thread it's on for seconds, and every detection
 * takes a slice of a frame, so it stays away from the page: nothing the model does can make the demo stutter.
 */
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

type In = { type: 'init'; base: string } | { type: 'frame'; bitmap: ImageBitmap; t: number }

let model: HandLandmarker | null = null
let lastStamp = 0
// The model wants its clock to only ever go forward
const stamp = (t: number) => (lastStamp = Math.max(t, lastStamp + 1))

async function init(base: string) {
  const files = await FilesetResolver.forVisionTasks(base, true)
  const create = (delegate: 'GPU' | 'CPU') =>
    HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: `${base}/hand_landmarker.task`, delegate }, runningMode: 'VIDEO', numHands: 1, minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6 })
  model = await create('GPU').catch(() => create('CPU'))
  // Once on a blank picture: the first detection is the slow one
  const blank = new OffscreenCanvas(640, 480)
  blank.getContext('2d')!.fillRect(0, 0, 640, 480)
  model.detectForVideo(blank, stamp(performance.now()))
}

self.onmessage = ({ data }: MessageEvent<In>) => {
  if (data.type === 'init') {
    init(data.base).then(
      () => self.postMessage({ type: 'ready' }),
      (e) => self.postMessage({ type: 'failed', message: String(e) }),
    )
    return
  }
  const { landmarks, worldLandmarks } = model!.detectForVideo(data.bitmap, stamp(data.t))
  data.bitmap.close()
  self.postMessage({ type: 'result', t: data.t, landmarks, worldLandmarks })
}
