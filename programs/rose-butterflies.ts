import { centered, map, clamp, DENSITY, smoothstep } from '../src/modules/math'
import { noise3 } from '../src/modules/noise'
import { hsl } from '../src/modules/color'

export const settings = {
  fps: 60,
  backgroundColor: '#06000a',
  color: '#fff',
}

const BG = '#06000a'
const THROB_PERIOD = 4.0
const THROB_DUR = 0.5

// --- Petal ring definitions ---
// Each ring: [radius, petalCount, rotationOffset, angularWidth, radialThickness]
// Outer rings = big flat petals, inner = tight curled spirals
const RINGS = [
  { r: 0.42, n: 5, rot: 0.0,  aw: 0.58, th: 0.16, curl: 0.15 },
  { r: 0.35, n: 5, rot: 0.62, aw: 0.52, th: 0.15, curl: 0.25 },
  { r: 0.28, n: 6, rot: 1.15, aw: 0.44, th: 0.13, curl: 0.40 },
  { r: 0.21, n: 7, rot: 1.85, aw: 0.38, th: 0.11, curl: 0.55 },
  { r: 0.15, n: 7, rot: 2.50, aw: 0.34, th: 0.09, curl: 0.70 },
  { r: 0.09, n: 8, rot: 3.30, aw: 0.30, th: 0.06, curl: 0.85 },
]

interface Butterfly {
  x: number; y: number; vx: number; vy: number
  age: number; phase: number; hue: number; size: number
}
interface State { butterflies: Butterfly[]; lastSpawn: number }

export function boot() {
  return { butterflies: [] as Butterfly[], lastSpawn: -10 }
}

function throb(t: number): number {
  const c = t % THROB_PERIOD
  return c < THROB_DUR ? Math.sin(c / THROB_DUR * Math.PI) * 0.07 : 0
}

// Evaluate if point is inside a petal of a given ring
function petalHit(
  angle: number, dist: number,
  ring: typeof RINGS[0], throbV: number, t: number
): { hit: boolean; depth: number; edge: number; radialT: number } | null {
  const r = ring.r + throbV
  const th = ring.th + throbV * 0.2
  const petalArc = (Math.PI * 2) / ring.n

  // Find nearest petal center
  let localA = angle - ring.rot
  localA = ((localA % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  const idx = Math.round(localA / petalArc)
  const centerA = idx * petalArc + ring.rot

  // Angular distance from petal center line
  let da = angle - centerA
  da = ((da + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI

  // Radial position: 0 = inner edge of petal, 1 = outer tip
  const radialT = clamp((dist - (r - th)) / (th * 2), 0, 1)

  // Petal widens toward outer tip, narrows at base
  const widthMod = 0.3 + 0.7 * Math.sin(radialT * Math.PI * 0.85)
  const effWidth = ring.aw * widthMod

  const angNorm = Math.abs(da) / effWidth
  const radNorm = Math.abs(dist - r) / th

  // Soft elliptical boundary
  const d = angNorm * angNorm + radNorm * radNorm
  if (d >= 1) return null

  const edge = 1 - Math.sqrt(d)

  // Curl shading: creates bright ridges and dark valleys
  const curlWave = Math.sin(radialT * Math.PI * 2.2 + ring.curl * 2) * ring.curl
  const foldShadow = Math.sin(da * 3 + radialT * 4) * 0.15

  const depth = clamp(edge * 0.5 + curlWave * 0.3 + foldShadow + 0.2, 0, 1)

  return { hit: true, depth, edge, radialT }
}

export function pre(context: any, _c: any, _b: any, state: State) {
  const t = context.time * 0.001
  const dt = 1 / 60

  // Spawn butterflies at throb peak
  const cycle = t % THROB_PERIOD
  const prev = (t - dt) % THROB_PERIOD
  const peak = THROB_DUR * 0.5
  if ((prev < peak && cycle >= peak) || prev > cycle) {
    if (t - state.lastSpawn > THROB_PERIOD * 0.6) {
      state.lastSpawn = t
      for (let i = 0, n = 2 + Math.floor(Math.random() * 3); i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const sr = 0.2 + Math.random() * 0.18
        const spd = 0.05 + Math.random() * 0.07
        state.butterflies.push({
          x: Math.cos(a) * sr,
          y: Math.sin(a) * sr,
          vx: Math.cos(a) * spd * 0.5 + (Math.random() - 0.5) * 0.03,
          vy: -spd - Math.random() * 0.03,
          age: 0,
          phase: Math.random() * Math.PI * 2,
          hue: 20 + Math.random() * 35,
          size: 0.07 + Math.random() * 0.04,
        })
      }
    }
  }

  for (const b of state.butterflies) {
    b.age += dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.vx += Math.sin(t * 1.1 + b.phase * 3) * 0.005
    b.vy += Math.cos(t * 1.6 + b.phase) * 0.003 - 0.0015
    b.vx *= 0.997
    b.vy *= 0.997
  }

  state.butterflies = state.butterflies.filter(
    b => b.age < 9 && Math.abs(b.x) < 2.5 && Math.abs(b.y) < 2.5
  )
  if (state.butterflies.length > 25) state.butterflies = state.butterflies.slice(-25)
}

export function main(coord: any, context: any, _c: any, _b: any, state: State) {
  const p = centered(coord, context)
  const t = context.time * 0.001
  const th = throb(t)

  // === Butterflies (always on top) ===
  let bVal = 0, bHue = 0, bBody = false
  for (const bf of state.butterflies) {
    const dx = p.x - bf.x, dy = p.y - bf.y
    const bd = Math.sqrt(dx * dx + dy * dy)
    if (bd > bf.size * 3) continue

    const flap = Math.sin(t * 8 + bf.phase) * 1.0
    const ba = Math.atan2(dy, dx)

    // Two big wing lobes
    const lw = Math.pow(Math.max(0, Math.cos(ba - 1.0 - flap)), 1.5)
    const rw = Math.pow(Math.max(0, Math.cos(ba + 1.0 + flap)), 1.5)
    // Smaller hindwing lobes
    const lh = Math.pow(Math.max(0, Math.cos(ba - 2.2 - flap * 0.7)), 2) * 0.6
    const rh = Math.pow(Math.max(0, Math.cos(ba + 2.2 + flap * 0.7)), 2) * 0.6
    const wing = Math.max(lw, rw, lh, rh)
    const wr = bf.size * (0.4 + 0.6 * wing)

    const fade = clamp(1 - bf.age / 9, 0, 1) * smoothstep(0, 0.5, bf.age)
    const isBody = Math.abs(dx) < 0.006 && Math.abs(dy) < bf.size * 0.7

    if (bd < wr) {
      const v = (1 - bd / wr) * fade
      if (v > bVal) { bVal = v; bHue = bf.hue + Math.sin(t * 0.3 + bf.phase) * 10; bBody = isBody }
    }
  }

  if (bVal > 0.08) {
    const ramp = DENSITY.complex
    const idx = Math.floor(bVal * 0.9 * (ramp.length - 1))
    return {
      char: bBody ? '|' : (ramp[clamp(idx, 0, ramp.length - 1)] ?? '*'),
      color: bBody ? hsl(bHue, 30, 20) : hsl(bHue, 80, 35 + bVal * 40),
      backgroundColor: BG,
    }
  }

  // === Rose ===
  // Noise warp for organic edges
  const wx = noise3(p.x * 4, p.y * 4, t * 0.15) * 0.018
  const wy = noise3(p.x * 4 + 50, p.y * 4 + 50, t * 0.15) * 0.018
  const rx = p.x + wx, ry = p.y + wy
  const angle = Math.atan2(ry, rx)
  const dist = Math.sqrt(rx * rx + ry * ry)

  // Evaluate rings outermost→innermost; inner wins (drawn on top)
  let hitDepth = -1, hitRingI = -1, hitEdge = 0, hitRadialT = 0

  for (let i = 0; i < RINGS.length; i++) {
    const result = petalHit(angle, dist, RINGS[i]!, th, t)
    if (result) {
      // Inner rings always override outer
      hitDepth = result.depth
      hitRingI = i
      hitEdge = result.edge
      hitRadialT = result.radialT
    }
  }

  if (hitRingI >= 0) {
    const ringNorm = hitRingI / (RINGS.length - 1) // 0=outer, 1=innermost
    const ramp = DENSITY.complex

    // Add vein-like detail from noise
    const vein = noise3(angle * 5 + hitRingI, dist * 20, t * 0.1) * 0.12

    const shade = clamp(hitDepth + vein, 0, 1)
    const idx = Math.floor(shade * (ramp.length - 1))

    // Deep shadows between layers, bright on petal surfaces
    // Inner petals: darker crimson. Outer petals: brighter red
    const hue = 352 + ringNorm * 8 + hitEdge * 4
    const sat = 65 + ringNorm * 25
    const baseLit = 12 + (1 - ringNorm) * 18  // outer petals brighter base
    const lit = baseLit + shade * 30 + hitEdge * 10 + th * 50

    // Crease darkening: where edge is low = between petals
    const creaseBoost = hitEdge < 0.2 ? -8 : 0

    return {
      char: ramp[clamp(idx, 0, ramp.length - 1)] ?? '#',
      color: hsl(clamp(hue, 340, 365) % 360, clamp(sat, 0, 100), clamp(lit + creaseBoost, 8, 58)),
      backgroundColor: BG,
    }
  }

  // Sepals behind outer petals
  const sepalSpan = Math.PI * 2 / 5
  const sa = ((angle + 0.3) % sepalSpan + sepalSpan) % sepalSpan
  const sepalEdge = 0.44 + th
  if (dist > 0.38 + th && dist < sepalEdge + 0.03 && Math.abs(sa - sepalSpan / 2) < sepalSpan * 0.35) {
    const sf = 1 - (dist - sepalEdge) / 0.03
    if (sf > 0) return { char: ',', color: hsl(120, 35, 18 + sf * 12), backgroundColor: BG }
  }

  // Stem
  const stemW = Math.sin(p.y * 3) * 0.01
  if (Math.abs(p.x - stemW) < 0.013 && p.y > 0.38 + th && p.y < 1.1) {
    return { char: '|', color: hsl(125, 38, 20), backgroundColor: BG }
  }

  // Leaf 1
  const l1x = p.x - 0.07, l1y = p.y - 0.58
  const l1a = Math.atan2(l1y, l1x) + 0.5
  const l1d = Math.sqrt(l1x * l1x + l1y * l1y)
  if (l1d < 0.05 * Math.max(0, Math.cos(l1a * 1.1))) {
    return { char: '~', color: hsl(128, 45, 24), backgroundColor: BG }
  }

  // Leaf 2
  const l2x = p.x + 0.06, l2y = p.y - 0.75
  const l2a = Math.atan2(l2y, l2x) - 0.5
  const l2d = Math.sqrt(l2x * l2x + l2y * l2y)
  if (l2d < 0.04 * Math.max(0, Math.cos(l2a * 1.1))) {
    return { char: '~', color: hsl(130, 42, 22), backgroundColor: BG }
  }

  return { char: ' ', color: BG, backgroundColor: BG }
}
