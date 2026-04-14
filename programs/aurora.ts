import { noise3 } from '../src/modules/noise'
import { map, DENSITY } from '../src/modules/math'
import { hsl } from '../src/modules/color'

export const settings = {
  fps: 60,
  backgroundColor: '#000',
}

export function main(coord, context) {
  const { u, v } = coord
  const t = context.time * 0.001

  // Horizontal drift speed
  const drift = t * 0.18

  // Ripple: each row shifts horizontally by a slow sine wave
  const ripple = Math.sin(v * Math.PI * 3 + t * 1.2) * 0.06
    + Math.sin(v * Math.PI * 7 - t * 0.7) * 0.025

  // Curtain bands: high x-frequency (vertical streaks), low y-frequency
  const bx = (u + drift + ripple) * 5.5
  const by = v * 2.2

  // Primary curtain layer — slow shimmer
  const n1 = noise3(bx, by, t * 0.4)
  // Fine shimmer overlay
  const n2 = noise3(bx * 2.1 + 4.3, by * 1.8 - 2.7, t * 0.9)
  // Global pulse
  const pulse = noise3(u * 1.2, v * 1.2, t * 0.25) * 0.35

  const n = n1 * 0.55 + n2 * 0.25 + pulse

  // Density: always populated — map so bottom 20% of chars never appears
  const d = DENSITY.complex
  const minIdx = Math.floor(d.length * 0.18)
  const idx = Math.floor(map(n, -1, 1, minIdx, d.length - 1))
  const char = d[Math.max(minIdx, Math.min(d.length - 1, idx))]

  // Hue by height: green at bottom (v=1) → teal at mid → purple at top (v=0)
  const hue = map(v, 0, 1, 272, 128)
  // Slight hue shimmer from noise
  const hueShift = n1 * 18

  // Brightness: pulse with noise, never goes dark
  const lightness = map(n, -1, 1, 28, 72)
  const saturation = map(n1, -1, 1, 65, 100)

  return {
    char,
    color: hsl(hue + hueShift, saturation, lightness),
    backgroundColor: '#000',
  }
}
