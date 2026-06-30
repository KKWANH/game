'use client'

// Tiny synthesized sound effects via the Web Audio API — no audio files.
// Muted state persists in localStorage; first user gesture unlocks the context.

let ctx: AudioContext | null = null
let muted = false

if (typeof window !== 'undefined') {
  muted = localStorage.getItem('bj_muted') === '1'
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function blip(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
  const c = getCtx()
  if (!c || muted) return
  const t = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(c.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

export const sound = {
  isMuted: () => muted,
  setMuted(m: boolean) {
    muted = m
    if (typeof window !== 'undefined') localStorage.setItem('bj_muted', m ? '1' : '0')
  },
  toggle() {
    this.setMuted(!muted)
    return muted
  },
  /** unlock the audio context on a user gesture */
  unlock() {
    getCtx()
  },
  chip() {
    blip(660, 0.08, 'triangle', 0.06)
    blip(880, 0.06, 'triangle', 0.05, 0.03)
  },
  deal() {
    blip(420, 0.07, 'square', 0.035)
  },
  /** a card lands on the felt (deal or hit) — softer, woodier than deal() */
  card() {
    blip(300, 0.05, 'triangle', 0.05)
    blip(180, 0.06, 'sine', 0.04, 0.02)
  },
  /** a hand goes over 21 — short descending "womp" */
  bust() {
    blip(300, 0.12, 'sawtooth', 0.05)
    blip(150, 0.28, 'sawtooth', 0.06, 0.09)
  },
  turn() {
    blip(560, 0.12, 'sine', 0.06)
    blip(760, 0.12, 'sine', 0.05, 0.1)
  },
  win() {
    ;[523, 659, 784, 1047].forEach((f, i) => blip(f, 0.16, 'triangle', 0.06, i * 0.09))
  },
  lose() {
    blip(300, 0.22, 'sine', 0.05)
    blip(220, 0.26, 'sine', 0.05, 0.12)
  },
}
