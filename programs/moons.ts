import { centered, clamp, smoothstep, DENSITY } from '../src/modules/math'
import * as sdf from '../src/modules/sdf'
import { noise3 } from '../src/modules/noise'
import { hsl } from '../src/modules/color'

export const settings = {
  fps: 60,
  backgroundColor: '#000005',
  color: '#fff',
}

const BG = '#000005'
const PLANET_R = 0.38
const RAMP = DENSITY.complex

// Moon orbit definitions: [orbitRadius, speed, phase, moonRadius, hue]
const MOONS = [
  { orbit: 0.72, speed: 0.35, phase: 0,            r: 0.08, hue: 40  }, // amber
  { orbit: 0.58, speed: 0.55, phase: Math.PI * 0.7, r: 0.065, hue: 200 }, // ice blue
  { orbit: 0.85, speed: 0.22, phase: Math.PI * 1.4, r: 0.095, hue: 15  }, // rust
]

// Light source direction (top-right, slightly behind)
const LIGHT_X = 0.6
const LIGHT_Y = -0.5

function moonPos(moon: typeof MOONS[0], t: number) {
  const a = t * moon.speed + moon.phase
  return { x: Math.cos(a) * moon.orbit, y: Math.sin(a) * moon.orbit * 0.35 }
}

// Soft shadow: how much a moon's shadow darkens a point on the planet
// Shadow is cast opposite to light direction, blurred by distance
function shadowAt(px: number, py: number, moon: typeof MOONS[0], t: number): number {
  const mp = moonPos(moon, t)

  // Shadow center on planet surface = moon pos offset toward light source
  // (moon blocks light coming from LIGHT direction)
  const shadowX = mp.x - LIGHT_X * 0.15
  const shadowY = mp.y - LIGHT_Y * 0.15

  // Distance from this planet point to shadow center
  const dx = px - shadowX
  const dy = py - shadowY

  // Shadow size scales with moon radius, softness increases with distance from planet
  const shadowR = moon.r * 2.2
  const d = Math.sqrt(dx * dx + dy * dy)

  // Soft falloff
  return smoothstep(shadowR, shadowR * 0.1, d) * 0.45
}

export function main(coord: any, context: any) {
  const p = centered(coord, context)
  const t = context.time * 0.001

  const dist = Math.sqrt(p.x * p.x + p.y * p.y)

  // --- Stars background ---
  const starNoise = noise3(p.x * 40, p.y * 40, 0.5)
  const starTwinkle = noise3(p.x * 40, p.y * 40, t * 0.8)
  const isStar = starNoise > 0.82 && starTwinkle > 0.1

  // --- Planet ---
  const planetD = sdf.circle(p.x, p.y, PLANET_R)
  const onPlanet = planetD < 0

  if (onPlanet) {
    // Planet surface: base illumination from light direction
    // Normalize position on planet for shading
    const nx = p.x / PLANET_R
    const ny = p.y / PLANET_R
    // Fake sphere normal dot light
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
    const lightDot = clamp(nx * LIGHT_X + ny * LIGHT_Y + nz * 0.5, 0, 1)

    // Surface texture from noise
    const tex1 = noise3(p.x * 8, p.y * 8, 1) * 0.15
    const tex2 = noise3(p.x * 16 + 50, p.y * 16 + 50, 2) * 0.08

    // Atmospheric bands (jupiter-like)
    const bands = Math.sin(ny * 18 + noise3(nx * 3, ny * 5, t * 0.05) * 2) * 0.12

    let illumination = lightDot + tex1 + tex2 + bands

    // --- Moon shadows on planet ---
    let totalShadow = 0
    for (const moon of MOONS) {
      totalShadow += shadowAt(p.x, p.y, moon, t)
    }
    // Shadows darken illumination, overlapping shadows stack (but cap)
    illumination *= (1 - clamp(totalShadow, 0, 0.75))

    illumination = clamp(illumination, 0.02, 1)

    // Terminator: very dark side opposite to light
    const terminator = smoothstep(-0.1, 0.2, lightDot)
    illumination *= terminator * 0.85 + 0.15

    // Character from illumination
    const idx = Math.floor(illumination * (RAMP.length - 1))
    const char = RAMP[clamp(idx, 0, RAMP.length - 1)] ?? ' '

    // Color: teal-blue planet with warm tones in lit areas
    const hue = 195 + lightDot * 20 - totalShadow * 30
    const sat = 35 + illumination * 20
    const lit = 8 + illumination * 38

    // Shadow tint: shadows take on a cool purple
    const shadowTint = clamp(totalShadow * 2, 0, 1)
    const finalHue = hue * (1 - shadowTint) + 260 * shadowTint

    return {
      char,
      color: hsl(finalHue, sat, lit),
      backgroundColor: hsl(240, 30, clamp(illumination * 3, 0, 4)),
    }
  }

  // --- Moons (rendered on top of background) ---
  // Sort by Y position for pseudo-depth (moons lower on screen = "in front")
  const moonOrder = MOONS.map((m, i) => ({ ...m, i, pos: moonPos(m, t) }))
    .sort((a, b) => a.pos.y - b.pos.y)

  for (const moon of moonOrder) {
    const mp = moon.pos
    const moonD = sdf.circle(p.x - mp.x, p.y - mp.y, moon.r)
    if (moonD < 0) {
      // Moon surface shading
      const mnx = (p.x - mp.x) / moon.r
      const mny = (p.y - mp.y) / moon.r
      const mnz = Math.sqrt(Math.max(0, 1 - mnx * mnx - mny * mny))
      const mLight = clamp(mnx * LIGHT_X + mny * LIGHT_Y + mnz * 0.6, 0, 1)

      // Crater texture
      const crater = noise3((p.x - mp.x) * 30, (p.y - mp.y) * 30, moon.i + 10) * 0.15

      const mIllum = clamp(mLight + crater, 0.05, 1)
      const mTerm = smoothstep(-0.05, 0.25, mLight)
      const finalIllum = mIllum * (mTerm * 0.8 + 0.2)

      const idx = Math.floor(finalIllum * (RAMP.length - 1))
      const char = RAMP[clamp(idx, 0, RAMP.length - 1)] ?? ' '

      return {
        char,
        color: hsl(moon.hue, 25 + finalIllum * 20, 10 + finalIllum * 50),
        backgroundColor: hsl(moon.hue, 20, clamp(finalIllum * 3, 0, 5)),
      }
    }

    // Moon atmosphere glow
    if (moonD < 0.025) {
      const glow = 1 - moonD / 0.025
      const glowLit = glow * 15
      return {
        char: '.',
        color: hsl(moon.hue, 40, 15 + glowLit),
        backgroundColor: BG,
      }
    }
  }

  // --- Atmosphere ring around planet ---
  const atmoD = Math.abs(dist - PLANET_R)
  if (atmoD < 0.04 && dist > PLANET_R) {
    const atmoGlow = 1 - atmoD / 0.04
    const atmoLit = atmoGlow * atmoGlow * 18
    return {
      char: '.',
      color: hsl(200, 50, 12 + atmoLit),
      backgroundColor: BG,
    }
  }

  // --- Stars ---
  if (isStar) {
    const brightness = (starNoise - 0.82) * 5
    return {
      char: brightness > 0.5 ? '+' : '.',
      color: hsl(220 + starTwinkle * 40, 20, 40 + brightness * 40),
      backgroundColor: BG,
    }
  }

  return { char: ' ', color: BG, backgroundColor: BG }
}
