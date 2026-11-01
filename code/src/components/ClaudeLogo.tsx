import { useEffect, useRef } from 'react'

// Dug's logo: the walking duck from public/dug.mp4 (1920×1080, green background), cut out live
const CROP = { x: 528, y: 130, size: 740 } // square around the duck in the video
const isBackground = (r: number, g: number, b: number) => g > r * 1.12 && g > b * 1.12 // the green screen and its shadow

// One looping video for every logo on the page
let video: HTMLVideoElement | undefined
function sharedVideo() {
  if (!video) {
    video = document.createElement('video')
    video.src = `${import.meta.env.BASE_URL}dug.mp4`
    Object.assign(video, { muted: true, loop: true, playsInline: true, autoplay: true })
  }
  video.play().catch(() => {}) // may be refused until the page is visible; retried on every mount
  return video
}

export default function ClaudeLogo({ size = 32 }: { size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const v = sharedVideo()
    const c = canvas.current!
    const px = Math.round(size * Math.min(window.devicePixelRatio || 1, 2))
    c.width = c.height = px
    const g = c.getContext('2d', { willReadFrequently: true })!
    let raf = 0
    let last = -1
    const draw = () => {
      if (v.readyState >= 2 && v.currentTime !== last) {
        last = v.currentTime
        g.clearRect(0, 0, px, px)
        g.drawImage(v, CROP.x, CROP.y, CROP.size, CROP.size, 0, 0, px, px)
        const img = g.getImageData(0, 0, px, px)
        const d = img.data
        for (let i = 0; i < d.length; i += 4) if (isBackground(d[i], d[i + 1], d[i + 2])) d[i + 3] = 0
        g.putImageData(img, 0, 0)
      }
      if (v.paused) v.play().catch(() => {})
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [size])

  return <canvas ref={canvas} aria-hidden className="shrink-0" style={{ width: size, height: size }} />
}
