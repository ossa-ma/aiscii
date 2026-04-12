import type { Program } from '../src/types'
import { centered, map, osc, DENSITY } from '../src/modules/math'
import * as sdf from '../src/modules/sdf'
import { noise3 } from '../src/modules/noise'
import { PALETTES } from '../src/modules/color'

export const settings = {
  fps: 60,
  backgroundColor: '#1a0a00',
  color: '#fff',
}

export function main(coord: any, context: any) {
  const p = centered(coord, context)
  const t = context.time * 0.001

  // Breathing scale
  const breath = 0.4 + 0.2 * Math.sin(t * 0.8)

  // Blob distortion via noise
  const angle = Math.atan2(p.y, p.x)
  const dist = Math.sqrt(p.x * p.x + p.y * p.y)
  const warp = noise3(
    Math.cos(angle) * 1.5,
    Math.sin(angle) * 1.5,
    t * 0.4
  ) * 0.15

  // Warped distance from center
  const d = dist + warp

  // Concentric rings — use fract-like pattern on warped distance
  const ringFreq = 8
  const rings = Math.sin(d * ringFreq * Math.PI / breath)

  // Soft falloff from center
  const falloff = Math.max(0, 1 - d / (breath * 2.5))

  // Combine rings with falloff
  const value = rings * falloff

  // Density character
  const ramp = DENSITY.complex
  const idx = Math.floor(map(value, -1, 1, 0, ramp.length - 1))
  const char = ramp[Math.max(0, Math.min(ramp.length - 1, idx))] ?? ' '

  // Warm palette color based on distance and time
  const colorT = (d / breath * 0.5 + t * 0.1) % 1
  const color = PALETTES.warm(colorT)

  // Fade out edges
  if (falloff < 0.05) return { char: ' ', color: '#1a0a00', backgroundColor: '#1a0a00' }

  return {
    char,
    color,
    backgroundColor: '#1a0a00',
  }
}
