/**
 * Donuts — 17 spinning 3D tori, each at its own speed and hue.
 * Based on a1k0n's classic donut algorithm, tiled across the screen.
 */

import type { Program, Cell } from '../src/types'
import { DENSITY } from '../src/modules/math'
import { hsl } from '../src/modules/color'

export const settings = {
  fps: 60,
  backgroundColor: '#060008',
  color: '#fff',
}

const CHARS = DENSITY.complex
const TAU = Math.PI * 2
const ROWS_DEF = [4, 5, 4, 4]  // 4+5+4+4 = 17

// 17 donut configs: fractional screen position, phase offsets, hue, speed
const DONUTS = ROWS_DEF.flatMap((count, r) =>
  Array.from({ length: count }, (_, c) => {
    const idx = ROWS_DEF.slice(0, r).reduce((a, b) => a + b, 0) + c
    return {
      cxf: (c + 0.5) / count,
      cyf: (r + 0.5) / ROWS_DEF.length,
      pA: idx * TAU / 17,
      pB: idx * TAU / 17 * 1.3,
      hue: idx * (360 / 17),
      speed: 1 + idx * 0.06,
    }
  })
)

export const pre: Program['pre'] = (context, _cursor, buffer) => {
  const { cols, rows, time, metrics } = context
  const sx = cols * 0.12
  const sy = sx * metrics.aspect
  const zBuf = new Float32Array(cols * rows)
  const bg: Cell = { char: ' ', backgroundColor: settings.backgroundColor }
  for (let i = 0; i < buffer.length; i++) buffer[i] = { ...bg }

  for (const d of DONUTS) {
    const cx = d.cxf * cols
    const cy = d.cyf * rows
    const A = time * 0.0015 * d.speed + d.pA
    const B = time * 0.0017 * d.speed + d.pB
    const cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B)

    for (let j = 0; j < TAU; j += 0.1) {
      const ct = Math.cos(j), st = Math.sin(j)
      for (let i = 0; i < TAU; i += 0.05) {
        const sp = Math.sin(i), cp = Math.cos(i)
        const h = ct + 2
        const D = 1 / (sp * h * sA + st * cA + 5)
        const t = sp * h * cA - st * sA

        const x = (cx + sx * D * (cp * h * cB - t * sB)) | 0
        const y = (cy + sy * D * (cp * h * sB + t * cB)) | 0

        if (y < 0 || y >= rows || x < 0 || x >= cols) continue
        const o = x + y * cols
        if (D <= zBuf[o]!) continue
        zBuf[o] = D

        const N = (st * sA - sp * ct * cA) * cB - sp * ct * sA - st * cA - cp * ct * sB
        const lum = Math.max(0, N / 1.5)
        const ci = Math.min(CHARS.length - 1, Math.floor(lum * CHARS.length))
        buffer[o] = {
          char: CHARS[ci] ?? '.',
          color: hsl(d.hue, 90, 20 + lum * 65),
          backgroundColor: settings.backgroundColor,
        }
      }
    }
  }
}
