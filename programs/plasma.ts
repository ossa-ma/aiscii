/**
 * Plasma — oldschool demoscene plasma effect.
 *
 * Layered sine waves produce a smoothly animated colour field.
 * Each cell's character is chosen by density, background colour by palette.
 *
 * A good reference program for:
 *  - centered() for aspect-corrected coordinates
 *  - DENSITY palettes
 *  - color.PALETTES for per-cell background colour
 *  - pure-math stateless main() (no boot/pre/post needed)
 */

import type { Program } from '../src/types'
import { centered, DENSITY, map } from '../src/modules/math'
import { PALETTES } from '../src/modules/color'

export const settings = {
  fps: 60,
  backgroundColor: '#000000',
  color: '#ffffff',
}

const density = DENSITY.complex

export const main: Program['main'] = (coord, context) => {
  const t = context.time * 0.0008
  const { x: cx, y: cy } = centered(coord, context)

  // Three overlapping sine waves produce the plasma field value in [-1, 1]
  const v1 = Math.sin(cx * 3 + t)
  const v2 = Math.cos(cy * 2 - t * 0.7)
  const v3 = Math.sin((cx + cy) * 2 + t * 0.5)
  const v  = (v1 + v2 + v3) / 3

  // Map field value to a density character
  const charIdx = Math.floor(map(v, -1, 1, 0, density.length - 1))
  const char = density[Math.max(0, Math.min(density.length - 1, charIdx))] ?? ' '

  // Map field value to a palette colour (0→1 range)
  const t_color = map(v, -1, 1, 0, 1)
  const backgroundColor = PALETTES.neon(t_color + t * 0.1)

  return { char, color: '#ffffff', backgroundColor }
}
