import { centered, clamp, smoothstep, mod } from '../src/modules/math'
import * as sdf from '../src/modules/sdf'
import { noise3 } from '../src/modules/noise'
import { hsl } from '../src/modules/color'

export const settings = {
  fps: 60,
  backgroundColor: '#1a1028',
  color: '#fff',
}

const BG = '#1a1028'

// Wink timing: open for ~3s, wink for ~0.4s
function isWinking(t: number): number {
  const cycle = mod(t, 3.5)
  if (cycle < 0.15) return smoothstep(0, 0.15, cycle)        // closing
  if (cycle < 0.3) return 1                                    // closed
  if (cycle < 0.45) return 1 - smoothstep(0.3, 0.45, cycle)  // opening
  return 0
}

// Ellipse SDF: circle with separate x/y radii
function ellipse(x: number, y: number, rx: number, ry: number): number {
  const nx = x / rx, ny = y / ry
  return (Math.sqrt(nx * nx + ny * ny) - 1) * Math.min(rx, ry)
}

export function main(coord: any, context: any) {
  const p = centered(coord, context)
  const t = context.time * 0.001

  // Gentle bob
  const bob = Math.sin(t * 1.2) * 0.012
  const px = p.x
  const py = p.y + bob

  const wink = isWinking(t)

  // ============ SPARKLES (behind everything) ============
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + t * 0.5
    const sparkR = 0.55 + Math.sin(t * 2 + i * 1.5) * 0.08
    const sx = Math.cos(angle) * sparkR * 0.7
    const sy = Math.sin(angle) * sparkR - 0.15
    const sd = Math.sqrt((px - sx) * (px - sx) + (py - sy) * (py - sy))
    const sparkle = Math.sin(t * 6 + i * 2) * 0.5 + 0.5
    if (sd < 0.02 && sparkle > 0.4) {
      return {
        char: sparkle > 0.7 ? '*' : '+',
        color: hsl(40 + i * 50, 80, 70 + sparkle * 25),
        backgroundColor: BG,
      }
    }
  }

  // ============ MANE (behind face) ============
  // Rainbow flowing hair on the right side and top
  const maneColors = [
    { cx: 0.22, cy: -0.22, rx: 0.14, ry: 0.12, hue: 350 }, // red
    { cx: 0.28, cy: -0.12, rx: 0.13, ry: 0.13, hue: 25 },  // orange
    { cx: 0.30, cy: 0.0,   rx: 0.12, ry: 0.14, hue: 50 },  // yellow
    { cx: 0.28, cy: 0.12,  rx: 0.12, ry: 0.13, hue: 140 }, // green
    { cx: 0.22, cy: 0.22,  rx: 0.13, ry: 0.12, hue: 210 }, // blue
    { cx: 0.14, cy: 0.30,  rx: 0.12, ry: 0.11, hue: 280 }, // purple
    // Top mane flowing over
    { cx: 0.08, cy: -0.34, rx: 0.15, ry: 0.08, hue: 340 }, // pink top
    { cx: -0.02, cy: -0.36, rx: 0.13, ry: 0.07, hue: 30 },  // orange top
  ]

  // Check mane (behind face, so check face first below)
  let maneHit = -1
  for (let i = maneColors.length - 1; i >= 0; i--) {
    const m = maneColors[i]!
    // Slight wave animation
    const wave = Math.sin(t * 2 + i * 0.8) * 0.015
    const d = ellipse(px - m.cx - wave, py - m.cy, m.rx, m.ry)
    if (d < 0) maneHit = i
  }

  // ============ HORN ============
  // Positioned at top of head, tilted left
  const hornBaseX = -0.06
  const hornBaseY = -0.32
  const hornTipX = -0.18
  const hornTipY = -0.62

  // Horn as a tapered shape: distance to line segment, narrowing toward tip
  const hornD = sdf.segment(px, py, hornBaseX, hornBaseY, hornTipX, hornTipY)
  // Taper: wider at base, narrow at tip
  const hornT = clamp(
    ((px - hornBaseX) * (hornTipX - hornBaseX) + (py - hornBaseY) * (hornTipY - hornBaseY)) /
    ((hornTipX - hornBaseX) ** 2 + (hornTipY - hornBaseY) ** 2),
    0, 1
  )
  const hornWidth = 0.04 * (1 - hornT * 0.7)
  const onHorn = hornD < hornWidth

  if (onHorn) {
    // Spiral stripe pattern on horn
    const stripe = Math.sin(hornT * 25 + t * 2) * 0.5 + 0.5
    const hue = 40 + stripe * 20 // gold shimmer
    return {
      char: stripe > 0.5 ? '#' : '=',
      color: hsl(hue, 80, 55 + stripe * 30),
      backgroundColor: hsl(hue, 60, 20),
    }
  }

  // ============ FACE (main circle) ============
  const faceD = sdf.circle(px, py, 0.30)
  const onFace = faceD < 0

  if (onFace) {
    // Face base color: soft lavender-white
    const faceLit = 82 + (1 - Math.sqrt(px * px + py * py) / 0.30) * 12

    // ---- LEFT EYE (our left = unicorn's right, the open one) ----
    const eyeLX = -0.10, eyeLY = -0.04
    const eyeLD = sdf.circle(px - eyeLX, py - eyeLY, 0.045)
    if (eyeLD < 0) {
      // Pupil
      const pupilD = sdf.circle(px - eyeLX - 0.008, py - eyeLY + 0.005, 0.025)
      if (pupilD < 0) {
        // Glint
        const glintD = sdf.circle(px - eyeLX - 0.015, py - eyeLY - 0.012, 0.008)
        if (glintD < 0) return { char: '*', color: '#fff', backgroundColor: '#fff' }
        return { char: '@', color: '#1a1028', backgroundColor: '#201030' }
      }
      return { char: 'O', color: '#2a1a3a', backgroundColor: '#e8e0f0' }
    }

    // Eyelashes on open eye
    const lashL1 = sdf.segment(px, py, eyeLX - 0.03, eyeLY - 0.045, eyeLX - 0.045, eyeLY - 0.065)
    const lashL2 = sdf.segment(px, py, eyeLX, eyeLY - 0.048, eyeLX - 0.005, eyeLY - 0.072)
    const lashL3 = sdf.segment(px, py, eyeLX + 0.03, eyeLY - 0.045, eyeLX + 0.04, eyeLY - 0.065)
    if (Math.min(lashL1, lashL2, lashL3) < 0.008) {
      return { char: '|', color: '#3a2050', backgroundColor: hsl(275, 25, faceLit) }
    }

    // ---- RIGHT EYE (winking one) ----
    const eyeRX = 0.10, eyeRY = -0.04
    if (wink > 0.5) {
      // Winking: curved line
      const winkD = sdf.segment(px, py, eyeRX - 0.04, eyeRY + 0.005, eyeRX + 0.04, eyeRY + 0.005)
      if (winkD < 0.012) {
        // Curved smile shape for wink
        const winkCurve = (px - eyeRX) * (px - eyeRX) * 8
        if (Math.abs(py - eyeRY - 0.005 + winkCurve) < 0.015) {
          return { char: '~', color: '#3a2050', backgroundColor: hsl(275, 25, faceLit) }
        }
      }
      // Wink lashes
      const wlash1 = sdf.segment(px, py, eyeRX + 0.04, eyeRY, eyeRX + 0.06, eyeRY - 0.025)
      const wlash2 = sdf.segment(px, py, eyeRX + 0.035, eyeRY - 0.01, eyeRX + 0.055, eyeRY - 0.035)
      if (Math.min(wlash1, wlash2) < 0.007) {
        return { char: '\\', color: '#3a2050', backgroundColor: hsl(275, 25, faceLit) }
      }
    } else {
      // Open eye (same as left)
      const eyeRD = sdf.circle(px - eyeRX, py - eyeRY, 0.045)
      if (eyeRD < 0) {
        const pupilD = sdf.circle(px - eyeRX + 0.008, py - eyeRY + 0.005, 0.025)
        if (pupilD < 0) {
          const glintD = sdf.circle(px - eyeRX - 0.01, py - eyeRY - 0.012, 0.008)
          if (glintD < 0) return { char: '*', color: '#fff', backgroundColor: '#fff' }
          return { char: '@', color: '#1a1028', backgroundColor: '#201030' }
        }
        return { char: 'O', color: '#2a1a3a', backgroundColor: '#e8e0f0' }
      }
      // Lashes
      const lashR1 = sdf.segment(px, py, eyeRX - 0.03, eyeRY - 0.045, eyeRX - 0.04, eyeRY - 0.065)
      const lashR2 = sdf.segment(px, py, eyeRX, eyeRY - 0.048, eyeRX + 0.005, eyeRY - 0.072)
      const lashR3 = sdf.segment(px, py, eyeRX + 0.03, eyeRY - 0.045, eyeRX + 0.045, eyeRY - 0.065)
      if (Math.min(lashR1, lashR2, lashR3) < 0.008) {
        return { char: '|', color: '#3a2050', backgroundColor: hsl(275, 25, faceLit) }
      }
    }

    // ---- BLUSH CHEEKS ----
    const cheekLD = sdf.circle(px - (-0.16), py - 0.08, 0.05)
    const cheekRD = sdf.circle(px - 0.16, py - 0.08, 0.05)
    if (cheekLD < 0) {
      const blush = sdf.fill(cheekLD, 0.03)
      return {
        char: '.',
        color: hsl(340, 70, 65 + blush * 15),
        backgroundColor: hsl(330, 50, 70 + blush * 10),
      }
    }
    if (cheekRD < 0) {
      const blush = sdf.fill(cheekRD, 0.03)
      return {
        char: '.',
        color: hsl(340, 70, 65 + blush * 15),
        backgroundColor: hsl(330, 50, 70 + blush * 10),
      }
    }

    // ---- NOSE ----
    const noseD = sdf.circle(px, py - 0.06, 0.015)
    if (noseD < 0) {
      return { char: '.', color: hsl(300, 30, 60), backgroundColor: hsl(280, 20, 80) }
    }

    // ---- MOUTH (small smile) ----
    const mouthCx = 0.0, mouthCy = 0.12
    const mouthDx = px - mouthCx
    const mouthDy = py - mouthCy
    // Curved smile: parabola opening downward
    const smileCurve = mouthDy - mouthDx * mouthDx * 6
    if (Math.abs(smileCurve) < 0.012 && Math.abs(mouthDx) < 0.07 && mouthDy > -0.01) {
      return { char: '~', color: hsl(340, 50, 45), backgroundColor: hsl(280, 20, faceLit) }
    }

    // ---- Tongue peek when winking ----
    if (wink > 0.5) {
      const tongueD = sdf.circle(px - 0.015, py - 0.155, 0.025)
      if (tongueD < 0 && py > 0.135) {
        return { char: 'o', color: hsl(350, 60, 55), backgroundColor: hsl(350, 55, 65) }
      }
    }

    // ---- FACE FILL ----
    // Subtle gradient: lighter at top, warmer at bottom
    const faceHue = 275 + py * 15
    return {
      char: ':',
      color: hsl(faceHue, 22, faceLit - 5),
      backgroundColor: hsl(faceHue, 25, faceLit),
    }
  }

  // ============ EAR (right side, pokes above face) ============
  const earD = ellipse(px - 0.20, py + 0.25, 0.07, 0.10)
  if (earD < 0) {
    const innerEar = ellipse(px - 0.21, py + 0.24, 0.04, 0.07)
    if (innerEar < 0) {
      return { char: '.', color: hsl(330, 50, 70), backgroundColor: hsl(330, 45, 75) }
    }
    return { char: ':', color: hsl(275, 25, 78), backgroundColor: hsl(275, 22, 82) }
  }

  // Left ear
  const earLD = ellipse(px + 0.20, py + 0.25, 0.07, 0.10)
  if (earLD < 0) {
    const innerEarL = ellipse(px + 0.21, py + 0.24, 0.04, 0.07)
    if (innerEarL < 0) {
      return { char: '.', color: hsl(330, 50, 70), backgroundColor: hsl(330, 45, 75) }
    }
    return { char: ':', color: hsl(275, 25, 78), backgroundColor: hsl(275, 22, 82) }
  }

  // ============ MANE (render behind face) ============
  if (maneHit >= 0) {
    const m = maneColors[maneHit]!
    const shimmer = Math.sin(t * 3 + maneHit * 1.2) * 0.5 + 0.5
    return {
      char: shimmer > 0.6 ? '#' : '=',
      color: hsl(m.hue, 70, 45 + shimmer * 25),
      backgroundColor: hsl(m.hue, 60, 18 + shimmer * 10),
    }
  }

  return { char: ' ', color: BG, backgroundColor: BG }
}
