/**
 * Will logo — loaded from image, with animated i-dot.
 * The dot morphs between teardrop, circle, and star.
 */

import type { Program, Cell } from '../src/types'
import * as img from '../src/modules/image'
import * as sdf from '../src/modules/sdf'
import { centered, smoothstep, lerp, clamp } from '../src/modules/math'

export const settings = {
  fps: 30,
  backgroundColor: '#1a1ac1',
  color: '#ffffff',
}

const BG_HEX = '#1a1ac1'

interface State {
  base: img.SampledImage
  contentMask: boolean[]
}

const program: Program<State> = {
  settings,

  async boot(context) {
    const base = await img.load('/will-logo.png', context, { colorOnly: true })
    const bgColor = img.hex(BG_HEX)
    const contentMask = img.mask(base.pixels, bgColor, 40)
    return { base, contentMask }
  },

  pre(context, _cursor, buffer, state) {
    // Copy base image into buffer
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = state.base.cells[i] ?? { char: ' ', backgroundColor: BG_HEX }
    }
  },

  main(coord, context, _cursor, buffer, state) {
    if (!state.contentMask[coord.index]) return null // background — keep as-is

    const t = context.time * 0.001
    const p = centered(coord, context)

    // Find the i-dot region: detect the isolated cluster of white pixels
    // above the i stem. We approximate: content pixels in a small area
    // around where the dot should be.
    // The dot is roughly at u=0.52, v=0.32 in the logo (above the i stem).
    // We'll define a region and only animate cells within it.
    const dotCenterU = 0.52
    const dotCenterV = 0.32
    const dotRadius = 0.04

    const du = coord.u - dotCenterU
    const dv = coord.v - dotCenterV
    const distToDot = Math.sqrt(du * du + dv * dv)

    if (distToDot > dotRadius) return null // not in dot region — keep base image

    // We're in the dot region. Apply morphing animation.
    // Use centered coords relative to the dot center
    const dotX = p.x - ((dotCenterU - 0.5) * 2 * (context.cols / Math.min(context.cols, context.rows)) * context.metrics.aspect)
    const dotY = p.y - ((dotCenterV - 0.5) * 2 * (context.rows / Math.min(context.cols, context.rows)))

    const dotR = 0.06

    // Three shapes
    const circleD = sdf.circle(dotX, dotY, dotR)
    const tCircle = sdf.circle(dotX, dotY + dotR * 0.12, dotR * 0.62)
    const tTri = sdf.triangle(dotX, -(dotY - dotR * 0.55), dotR * 0.4)
    const teardropD = sdf.smoothUnion(tCircle, tTri, 0.02)
    const starD = sdf.star(dotX, dotY, 5, dotR * 1.1, dotR * 0.45)

    // 6s cycle: teardrop → circle → star
    const phase = t % 6
    const fade = 0.5
    let d: number
    if (phase < 2) {
      d = lerp(teardropD, circleD, smoothstep(2 - fade, 2, phase))
    } else if (phase < 4) {
      d = lerp(circleD, starD, smoothstep(4 - fade, 4, phase))
    } else {
      d = lerp(starD, teardropD, smoothstep(6 - fade, 6, phase))
    }

    const fill = 1 - clamp(d / 0.015 + 0.5, 0, 1)

    if (fill > 0.5) {
      return { char: ' ', color: '#ffffff', backgroundColor: '#ffffff' }
    }
    return { char: ' ', color: BG_HEX, backgroundColor: BG_HEX }
  },
}

export const { boot, pre, main } = program
