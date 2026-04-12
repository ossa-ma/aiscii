/**
 * Plasma — layered sine waves with colour palette.
 * Replace this with your own program or generate one with /aiscii.
 */

import type { Program } from 'aiscii'
import { centered, DENSITY, map } from 'aiscii/modules/math'
import { PALETTES } from 'aiscii/modules/color'

export const settings = {
  fps: 60,
  backgroundColor: '#000000',
  color: '#ffffff',
}

const density = DENSITY.complex

export const main: Program['main'] = (coord, context) => {
  const t = context.time * 0.0008
  const { x: cx, y: cy } = centered(coord, context)

  const v1 = Math.sin(cx * 3 + t)
  const v2 = Math.cos(cy * 2 - t * 0.7)
  const v3 = Math.sin((cx + cy) * 2 + t * 0.5)
  const v  = (v1 + v2 + v3) / 3

  const charIdx = Math.floor(map(v, -1, 1, 0, density.length - 1))
  const char = density[Math.max(0, Math.min(density.length - 1, charIdx))] ?? ' '

  const backgroundColor = PALETTES.neon(map(v, -1, 1, 0, 1) + t * 0.1)

  return { char, color: '#ffffff', backgroundColor }
}
