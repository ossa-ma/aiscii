import { map, centered, DENSITY, lerp } from '../src/modules/math'
import { noise3, fbm } from '../src/modules/noise'
import { hsl } from '../src/modules/color'

export const settings = {
  fps: 60,
  backgroundColor: '#03111f',
  color: '#7dd3fc',
}

const D = DENSITY.complex

export function main(coord, context) {
  const t = context.time * 0.001
  const { x, y } = centered(coord, context)

  // Three wave trains sweeping right-ward, each at a slight diagonal angle
  // (real ocean swells are never perfectly horizontal)
  const w1 = Math.sin(x * 2.6 - t * 2.1 + y * 0.8)
  const w2 = Math.sin(x * 1.7 - t * 1.4 + y * 1.3) * 0.6
  const w3 = Math.sin(x * 4.8 - t * 3.2 + y * 0.3) * 0.3

  // Normalize to [-1, 1]
  const waves = (w1 + w2 + w3) / 1.9

  // Organic turbulence layered on top
  const turb = fbm(x * 2.0, y * 1.8, t * 0.2, 3) * 0.28
  const fine = noise3(x * 7, y * 6, t * 0.35) * 0.10

  // Combined field: crests near +1, troughs near -1
  const field = waves * 0.62 + turb + fine

  // Character: sparse/light at crests, dense/dark in troughs
  const charN = map(field, -1.0, 1.1, 0, D.length - 1)
  const char = D[Math.max(0, Math.min(D.length - 1, Math.floor(charN)))] ?? '~'

  // Color: deep navy in troughs → bright cyan-white at crests
  const tc = map(field, -1.0, 1.1, 0, 1)
  const hue = lerp(225, 190, tc)
  const lit = lerp(10, 82, tc * tc)   // quadratic brightens only the very top of crests
  const color = hsl(hue, 82, lit)

  return { char, color }
}
