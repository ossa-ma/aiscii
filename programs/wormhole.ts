import { centered, clamp, fract, mod, DENSITY } from '../src/modules/math'
import { noise3 } from '../src/modules/noise'
import { PALETTES } from '../src/modules/color'
import { hsl } from '../src/modules/color'

export const settings = {
  fps: 60,
  backgroundColor: '#000',
  color: '#fff',
}

export function main(coord: any, context: any) {
  const p = centered(coord, context)
  const t = context.time * 0.001

  // Polar coords from center
  const dist = Math.sqrt(p.x * p.x + p.y * p.y)
  const angle = Math.atan2(p.y, p.x)

  // Avoid center singularity
  if (dist < 0.005) return { char: ' ', color: '#000', backgroundColor: '#000' }

  // --- Tunnel mapping ---
  // Inverse radius = depth into tunnel (closer to center = farther away)
  const depth = 0.4 / dist

  // Z-scroll: flying forward through the tunnel
  const speed = 1.8
  const z = depth + t * speed

  // Tunnel texture coordinates
  const tu = angle / (Math.PI * 2) // angular position [0,1)
  const tv = z                      // depth position (scrolling)

  // --- Tunnel wall pattern ---
  // Ring segments that rush toward you
  const rings = Math.sin(tv * 12) * 0.5 + 0.5
  // Angular panels
  const panels = Math.sin(tu * 24 * Math.PI) * 0.5 + 0.5
  // Grid pattern = rings * panels
  const grid = rings * 0.6 + panels * 0.4

  // Noise warp on the tunnel walls
  const warp = noise3(tu * 4, tv * 2, t * 0.3) * 0.3

  // Edge glow: brighter near tunnel walls (large dist from center)
  // and dimmer deep in the tunnel (small dist)
  const wallGlow = clamp(dist * 1.5, 0, 1)

  // Combine
  const value = clamp(grid + warp, 0, 1) * wallGlow

  // --- Neon energy streaks ---
  // Radial streaks that fly past
  const streakAngle = mod(angle + t * 0.4, Math.PI * 2 / 8)
  const streak = smoothEdge(streakAngle, 0.04) * clamp(1 - dist * 0.8, 0, 1)

  // Pulsing rings rushing outward from center
  const pulse = fract(z * 0.5)
  const pulseRing = smoothEdge(Math.abs(pulse - 0.5) * 2, 0.15) * 0.7

  const total = clamp(value + streak * 0.5 + pulseRing * wallGlow, 0, 1)

  // --- Character ---
  const ramp = DENSITY.complex
  const idx = Math.floor(total * (ramp.length - 1))
  const char = ramp[clamp(idx, 0, ramp.length - 1)] ?? ' '

  // --- Neon color ---
  // Cycle hue with angle + depth for rainbow spiral effect
  const hueBase = angle / (Math.PI * 2) + z * 0.1 + t * 0.15
  const neonColor = PALETTES.neon(fract(hueBase))

  // Hot white center glow vs neon walls
  const centerProximity = clamp(1 - dist * 2, 0, 1)

  if (total < 0.03) {
    return { char: ' ', color: '#000', backgroundColor: '#000' }
  }

  // Inner glow: white-hot near center vanishing point
  if (centerProximity > 0.5 && total > 0.1) {
    const glow = centerProximity * total
    const lit = 40 + glow * 55
    return {
      char,
      color: hsl(280 + Math.sin(t) * 30, 30, lit),
      backgroundColor: hsl(270, 50, glow * 8),
    }
  }

  // Background: subtle glow behind the tunnel walls
  const bgLit = clamp(total * wallGlow * 6, 0, 8)
  const bgHue = fract(hueBase + 0.5)

  return {
    char,
    color: neonColor,
    backgroundColor: hsl(280 + bgHue * 60, 60, bgLit),
  }
}

// Soft pulse shape: 1 at center, 0 at edge
function smoothEdge(d: number, width: number): number {
  return clamp(1 - d / width, 0, 1)
}
