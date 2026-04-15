/**
 * Preset shader functions.
 * Each maps CellData → StyledCell using a different visual style.
 *
 * Character ramps are string constants — index by brightness.
 */

import type { CellData, StyledCell, ShaderFn, StyledFrame, CellFrame } from './types'

const RAMP = ' .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'
const RAMP_LEN = RAMP.length

/** Precomputed LUT: brightness byte [0-255] → character */
const CHAR_LUT = new Array<string>(256)
for (let i = 0; i < 256; i++) {
  CHAR_LUT[i] = RAMP[Math.floor((i / 255) * (RAMP_LEN - 1))]
}

function charFromBrightness(b: number): string {
  return CHAR_LUT[Math.round(b * 255)] ?? ' '
}

function rgbStr(r: number, g: number, b: number): string {
  return `rgb(${r},${g},${b})`
}

// ---------------------------------------------------------------------------
// Default: brightness → char density, source colors preserved
// ---------------------------------------------------------------------------

export const defaultShader: ShaderFn = (cell) => {
  if (cell.brightness < 0.01 && cell.coverage < 0.01) {
    return { char: ' ', color: 'transparent' }
  }
  return {
    char: charFromBrightness(cell.brightness),
    color: rgbStr(cell.sourceColor[0], cell.sourceColor[1], cell.sourceColor[2]),
  }
}

// ---------------------------------------------------------------------------
// Silhouette: shape in one color
// ---------------------------------------------------------------------------

export function silhouetteShader(color = 'white'): ShaderFn {
  return (cell) => {
    if (cell.coverage < 0.15) {
      return { char: ' ', color: 'transparent' }
    }
    return {
      char: charFromBrightness(cell.brightness),
      color,
    }
  }
}

// ---------------------------------------------------------------------------
// Thermal: FLIR palette mapped to brightness
// ---------------------------------------------------------------------------

interface RGB { r: number; g: number; b: number }

const THERMAL_STOPS: { t: number; c: RGB }[] = [
  { t: 0.0,  c: { r: 0x00, g: 0x00, b: 0x80 } },
  { t: 0.10, c: { r: 0x00, g: 0x00, b: 0xcc } },
  { t: 0.18, c: { r: 0x00, g: 0x66, b: 0xff } },
  { t: 0.26, c: { r: 0x00, g: 0xbb, b: 0x66 } },
  { t: 0.36, c: { r: 0x00, g: 0xdd, b: 0x00 } },
  { t: 0.48, c: { r: 0x66, g: 0xff, b: 0x00 } },
  { t: 0.58, c: { r: 0xbb, g: 0xff, b: 0x00 } },
  { t: 0.68, c: { r: 0xff, g: 0xff, b: 0x00 } },
  { t: 0.78, c: { r: 0xff, g: 0xaa, b: 0x00 } },
  { t: 0.88, c: { r: 0xff, g: 0x33, b: 0x00 } },
  { t: 1.0,  c: { r: 0x8b, g: 0x00, b: 0x00 } },
]

// Precomputed thermal LUT: byte [0-255] → CSS color string
const THERMAL_LUT = new Array<string>(256)
for (let i = 0; i < 256; i++) {
  const h = i / 255
  let color = 'rgb(0,0,128)'
  for (let j = 0; j < THERMAL_STOPS.length - 1; j++) {
    if (h <= THERMAL_STOPS[j + 1].t) {
      const t = (h - THERMAL_STOPS[j].t) / (THERMAL_STOPS[j + 1].t - THERMAL_STOPS[j].t)
      const a = THERMAL_STOPS[j].c
      const b = THERMAL_STOPS[j + 1].c
      color = rgbStr(
        Math.round(a.r + (b.r - a.r) * t),
        Math.round(a.g + (b.g - a.g) * t),
        Math.round(a.b + (b.b - a.b) * t)
      )
      break
    }
  }
  THERMAL_LUT[i] = color
}

export const thermalShader: ShaderFn = (cell) => {
  if (cell.brightness < 0.01 && cell.coverage < 0.01) {
    return { char: ' ', color: 'transparent' }
  }
  return {
    char: charFromBrightness(cell.brightness),
    color: THERMAL_LUT[Math.round(cell.brightness * 255)],
  }
}

// ---------------------------------------------------------------------------
// Night vision: green phosphor
// ---------------------------------------------------------------------------

export const nightVisionShader: ShaderFn = (cell) => {
  if (cell.brightness < 0.01 && cell.coverage < 0.01) {
    return { char: ' ', color: 'transparent' }
  }
  const g = Math.round(cell.brightness * 255)
  return {
    char: charFromBrightness(cell.brightness),
    color: rgbStr(Math.round(g * 0.2), g, Math.round(g * 0.1)),
  }
}

// ---------------------------------------------------------------------------
// Blueprint: white on blue
// ---------------------------------------------------------------------------

export const blueprintShader: ShaderFn = (cell) => {
  if (cell.coverage < 0.15) {
    return { char: ' ', color: 'transparent' }
  }
  return {
    char: charFromBrightness(cell.brightness),
    color: rgbStr(
      Math.round(180 + cell.brightness * 75),
      Math.round(180 + cell.brightness * 75),
      255
    ),
  }
}

// ---------------------------------------------------------------------------
// X-ray: inverted, high contrast
// ---------------------------------------------------------------------------

export const xrayShader: ShaderFn = (cell) => {
  if (cell.brightness < 0.01 && cell.coverage < 0.01) {
    return { char: ' ', color: 'transparent' }
  }
  const inverted = 1 - cell.brightness
  const v = Math.round(inverted * 255)
  return {
    char: charFromBrightness(inverted),
    color: rgbStr(v, v, Math.min(255, v + 30)),
  }
}

// ---------------------------------------------------------------------------
// Shader registry
// ---------------------------------------------------------------------------

export const SHADERS: Record<string, ShaderFn> = {
  default: defaultShader,
  thermal: thermalShader,
  'night-vision': nightVisionShader,
  blueprint: blueprintShader,
  xray: xrayShader,
}

/** Look up a preset shader by name. Returns undefined if not found. */
export function getShader(name: string): ShaderFn | undefined {
  return SHADERS[name]
}

/**
 * Apply a shader to a cell frame, producing styled output.
 */
export function applyShader(frame: CellFrame, shader: ShaderFn): StyledFrame {
  return {
    cells: frame.cells.map(shader),
    cols: frame.cols,
    rows: frame.rows,
    delay: frame.delay,
  }
}
