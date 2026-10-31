// A small generated club track (no audio files): muffled from the street, opens up as you walk in.
const LOOKAHEAD_S = 0.14
const TICK_MS = 30
const BASS = [55, 55, 65.41, 55, 49, 55, 73.42, 65.41]
const CHORD = [220, 261.63, 329.63]

export type Mix = { gain: number; cutoff: number; bpm: number; house: boolean }

class NightSound {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private filter!: BiquadFilterNode
  private noise!: AudioBuffer
  private timer = 0
  private next = 0
  private step = 0
  private mix: Mix = { gain: 0, cutoff: 400, bpm: 134, house: false }

  /** Needs a user gesture first, so it's called from whatever the user just did */
  start() {
    if (!this.ctx) {
      const ctx = new AudioContext()
      this.ctx = ctx
      this.master = ctx.createGain()
      this.master.gain.value = 0
      this.filter = ctx.createBiquadFilter()
      this.filter.type = 'lowpass'
      this.filter.frequency.value = this.mix.cutoff
      this.filter.connect(this.master).connect(ctx.destination)
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate)
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      this.next = ctx.currentTime + 0.05
      this.timer = window.setInterval(() => this.schedule(), TICK_MS)
      this.set(this.mix)
    }
    void this.ctx.resume()
  }

  set(mix: Mix) {
    this.mix = mix
    if (!this.ctx) return
    const now = this.ctx.currentTime
    this.master.gain.setTargetAtTime(mix.gain, now, 0.6)
    this.filter.frequency.setTargetAtTime(mix.cutoff, now, 0.5)
  }

  stop() {
    clearInterval(this.timer)
    void this.ctx?.close()
    this.ctx = null
  }

  /** Beats since the start: the lights and the crowd move to the same clock as the music */
  beats() {
    const seconds = this.ctx ? this.ctx.currentTime : performance.now() / 1000
    return (seconds * this.mix.bpm) / 60
  }

  private schedule() {
    const ctx = this.ctx!
    if (ctx.state !== 'running') return
    const sixteenth = 60 / this.mix.bpm / 4
    while (this.next < ctx.currentTime + LOOKAHEAD_S) {
      this.play(this.step, this.next)
      this.next += sixteenth
      this.step = (this.step + 1) % 64
    }
  }

  private play(step: number, t: number) {
    const s = step % 16
    if (s % 4 === 0) this.kick(t)
    if (s % 4 === 2) this.hat(t, 0.16, 0.09)
    else if (!this.mix.house && s % 2 === 1) this.hat(t, 0.05, 0.03)
    const note = BASS[Math.floor(step / 8) % BASS.length]
    if (this.mix.house) {
      if (s === 3 || s === 6 || s === 11 || s === 14) this.chord(t)
      if (s % 4 === 2) this.bass(t, note * 2, 0.16)
    } else if (s % 4 !== 0) {
      this.bass(t, note, 0.09)
    }
  }

  private envelope(t: number, peak: number, decay: number) {
    const gain = this.ctx!.createGain()
    gain.gain.setValueAtTime(peak, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay)
    gain.connect(this.filter)
    return gain
  }

  private kick(t: number) {
    const osc = this.ctx!.createOscillator()
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.09)
    osc.connect(this.envelope(t, 0.95, 0.28))
    osc.start(t)
    osc.stop(t + 0.3)
  }

  private hat(t: number, peak: number, decay: number) {
    const src = this.ctx!.createBufferSource()
    src.buffer = this.noise
    const high = this.ctx!.createBiquadFilter()
    high.type = 'highpass'
    high.frequency.value = 7500
    src.connect(high).connect(this.envelope(t, peak, decay))
    src.start(t)
    src.stop(t + decay + 0.02)
  }

  private bass(t: number, freq: number, decay: number) {
    const osc = this.ctx!.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    const low = this.ctx!.createBiquadFilter()
    low.frequency.value = 520
    osc.connect(low).connect(this.envelope(t, 0.32, decay))
    osc.start(t)
    osc.stop(t + decay + 0.02)
  }

  private chord(t: number) {
    for (const freq of CHORD) {
      const osc = this.ctx!.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = freq
      osc.connect(this.envelope(t, 0.09, 0.22))
      osc.start(t)
      osc.stop(t + 0.24)
    }
  }
}

export const nightSound = new NightSound()
