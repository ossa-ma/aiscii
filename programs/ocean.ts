import { map, clamp, smoothstep, DENSITY } from '../src/modules/math'
import { noise3, fbm } from '../src/modules/noise'
import { hsl } from '../src/modules/color'

export const settings = {
  fps: 60,
  backgroundColor: '#020a18',
  color: '#fff',
}

// Ocean water chars - wavy feel
const WATER = ' .~-=~.  '
const FOAM_CHARS = ".:;!|*%#@"

export function main(coord: any, context: any) {
  const t = context.time * 0.001
  const aspect = context.metrics.aspect

  // Use u/v for full-screen ocean (no centered — we want edge-to-edge water)
  const x = (coord.u - 0.5) * 2 * (context.cols / context.rows) * aspect
  const y = (coord.v - 0.5) * 2

  // Slow drift direction
  const driftX = t * 0.06
  const driftY = t * 0.03

  // --- Deep water layer ---
  // Large slow waves
  const wave1 = noise3((x + driftX) * 1.2, (y + driftY) * 1.2, t * 0.15)
  // Medium swells
  const wave2 = noise3((x + driftX * 0.7) * 2.5, (y + driftY * 1.3) * 2.5, t * 0.25) * 0.5
  // Small ripples
  const wave3 = noise3((x - driftX * 0.3) * 6, (y - driftY * 0.5) * 6, t * 0.4) * 0.2

  const water = wave1 + wave2 + wave3

  // --- Foam patches ---
  // Large foam blobs that drift slowly
  const foamBase = fbm(
    (x + driftX * 1.2) * 1.8,
    (y + driftY * 0.8) * 1.8,
    t * 0.08,
    4
  )
  // Secondary foam detail
  const foamDetail = noise3(
    (x + driftX * 0.9) * 5,
    (y + driftY * 0.6) * 5,
    t * 0.18
  ) * 0.3

  // Foam threshold — only the peaks become foam
  const foamRaw = foamBase + foamDetail
  const foamThreshold = 0.35
  const foam = smoothstep(foamThreshold, foamThreshold + 0.3, foamRaw)

  // Thin streaky foam lines from wave crests
  const crestNoise = noise3(
    (x + driftX * 1.5) * 3,
    (y + driftY) * 8,
    t * 0.12
  )
  const crests = smoothstep(0.55, 0.7, crestNoise) * 0.6

  // Combined foam
  const totalFoam = clamp(foam + crests, 0, 1)

  // --- Render ---
  if (totalFoam > 0.1) {
    // Foam: white to light blue, brighter = thicker foam
    const fi = Math.floor(totalFoam * (FOAM_CHARS.length - 1))
    const char = FOAM_CHARS[clamp(fi, 0, FOAM_CHARS.length - 1)] ?? '.'

    // Foam color: bright white core, bluish-white edges
    const foamLit = 65 + totalFoam * 30
    const foamSat = 30 - totalFoam * 25
    return {
      char,
      color: hsl(195, foamSat, foamLit),
      backgroundColor: hsl(210, 60, 8 + totalFoam * 6),
    }
  }

  // Deep water
  const waterNorm = clamp(map(water, -1.2, 1.2, 0, 1), 0, 1)
  const wi = Math.floor(waterNorm * (WATER.length - 1))
  const char = WATER[clamp(wi, 0, WATER.length - 1)] ?? ' '

  // Water color: dark navy in troughs, slightly lighter blue-green on wave peaks
  const hue = 210 + water * 12
  const sat = 55 + water * 15
  const lit = 8 + waterNorm * 16

  // Background shifts subtly with waves
  const bgLit = 4 + waterNorm * 8

  return {
    char,
    color: hsl(hue, sat, lit),
    backgroundColor: hsl(215, 65, bgLit),
  }
}
