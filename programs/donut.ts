/**
 * Donut — rotating 3D torus rendered in ASCII.
 * Ported from a1k0n's classic donut.c.
 * Reference: https://www.a1k0n.net/2011/07/20/donut-math.html
 *
 * A good reference program for:
 *  - pre() for whole-buffer writes (z-buffer torus rendering)
 *  - writing directly into buffer[] in pre() without using main()
 *  - 3D projection math
 */

import type { Program, Cell } from '../src/types'

export const settings = {
  fps: 30,
  backgroundColor: '#0a0a0a',
  color: '#e0e0e0',
}

// Brightness ramp — index by surface normal, 0 = dark, 11 = bright
const CHARS = '.,-~:;=!*#$@'

export const pre: Program['pre'] = (context, _cursor, buffer) => {
  const { cols, rows, time, metrics } = context
  const TAU = Math.PI * 2

  // Rotation angles driven by time
  const A = time * 0.0015
  const B = time * 0.0017

  const cA = Math.cos(A), sA = Math.sin(A)
  const cB = Math.cos(B), sB = Math.sin(B)

  // Z-buffer and output buffer (reuse for the frame)
  const zBuf = new Float32Array(cols * rows)

  // Clear the cell buffer to background
  const bg: Cell = { char: ' ', backgroundColor: settings.backgroundColor }
  for (let i = 0; i < buffer.length; i++) buffer[i] = { ...bg }

  const scaleX = cols * 0.22
  const scaleY = scaleX * metrics.aspect  // aspect-corrected so it looks round

  const cx = cols / 2
  const cy = rows / 2

  // Iterate over torus surface using two angles: theta (cross-section) and phi (revolution)
  for (let j = 0; j < TAU; j += 0.05) {
    const ct = Math.cos(j), st = Math.sin(j)

    for (let i = 0; i < TAU; i += 0.01) {
      const sp = Math.sin(i), cp = Math.cos(i)

      // Point on the torus surface
      const h = ct + 2                          // R1 + R2*cos(theta)
      const D = 1 / (sp * h * sA + st * cA + 5) // 1/z (depth)
      const t = sp * h * cA - st * sA

      // Project to screen
      const x = (cx + scaleX * D * (cp * h * cB - t * sB)) | 0
      const y = (cy + scaleY * D * (cp * h * sB + t * cB)) | 0

      if (y < 0 || y >= rows || x < 0 || x >= cols) continue

      const o = x + y * cols
      if (D <= zBuf[o]!) continue  // depth test

      zBuf[o] = D

      // Compute surface normal to determine brightness
      const N = (8 * ((st * sA - sp * ct * cA) * cB - sp * ct * sA - st * cA - cp * ct * sB)) | 0
      const charIdx = N > 0 ? Math.min(N, CHARS.length - 1) : 0
      buffer[o] = {
        char: CHARS[charIdx] ?? ' ',
        color: '#e0e0e0',
        backgroundColor: settings.backgroundColor,
      }
    }
  }
}
