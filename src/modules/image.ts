/**
 * @module image
 * Load images and sample them into cell buffers at runtime.
 * Uses an offscreen canvas to read pixel data.
 */

import type { Cell, Context } from '../types'

/** RGBA color from pixel sampling. Each channel [0, 255]. */
export interface RGBA {
  r: number
  g: number
  b: number
  a: number
}

/** Result of sampling an image to a cell grid. */
export interface SampledImage {
  /** Cell buffer: one Cell per grid position (cols * rows). */
  cells: Cell[]
  /** Raw RGBA per grid position — use for lighting, masking, effects. */
  pixels: RGBA[]
  /** Source image dimensions. */
  width: number
  height: number
}

/**
 * Load an image from a URL and sample it to fit the given grid dimensions.
 * Each cell maps to a rectangular region of the source image.
 * Brightness determines the character from the density ramp.
 * Background color is set to the average color of the sampled region.
 *
 * @param src       Image URL (relative or absolute)
 * @param context   Runtime context (for cols, rows, metrics)
 * @param options   Optional overrides
 */
export async function load(
  src: string,
  context: Context,
  options: {
    /** Character density ramp, dark→light. Default: spaces only (use bg color). */
    density?: string
    /** If true, use only backgroundColor (char is always space). Default: true. */
    colorOnly?: boolean
    /** Padding as fraction of grid (0.08 = 8% margin on each side). Default: 0. */
    padding?: number
    /** Background color for padded area. Default: transparent black. */
    padColor?: { r: number; g: number; b: number }
  } = {},
): Promise<SampledImage> {
  const { cols, rows } = context
  const colorOnly = options.colorOnly ?? true
  const density = options.density ?? ' '
  const padding = options.padding ?? 0
  const padColor = options.padColor ?? { r: 0, g: 0, b: 0 }

  const img = await loadImage(src)
  const { data, width, height } = rasterize(img, cols, rows, padding, padColor)

  const cells: Cell[] = new Array(cols * rows)
  const pixels: RGBA[] = new Array(cols * rows)

  // Each cell covers a rectangular region of the image
  const cellW = width / cols
  const cellH = height / rows

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      // Sample the center pixel of this cell's region
      const sx = Math.floor(cx * cellW + cellW / 2)
      const sy = Math.floor(cy * cellH + cellH / 2)
      const i = (sy * width + sx) * 4

      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      const a = data[i + 3]!

      pixels[cx + cy * cols] = { r, g, b, a }

      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255

      if (colorOnly) {
        cells[cx + cy * cols] = {
          char: ' ',
          color: `rgb(${r},${g},${b})`,
          backgroundColor: `rgb(${r},${g},${b})`,
        }
      } else {
        const di = Math.floor(lum * (density.length - 1))
        const char = density[Math.max(0, Math.min(density.length - 1, di))] ?? ' '
        cells[cx + cy * cols] = {
          char,
          color: `rgb(${r},${g},${b})`,
          backgroundColor: `rgb(${Math.floor(r * 0.15)},${Math.floor(g * 0.15)},${Math.floor(b * 0.15)})`,
        }
      }
    }
  }

  return { cells, pixels, width, height }
}

/**
 * Create a boolean mask: true for cells whose color differs from `bgColor`.
 * Useful for isolating the "content" (letters, shapes) from the background.
 */
export function mask(pixels: RGBA[], bgColor: RGBA, threshold = 30): boolean[] {
  return pixels.map(p => {
    const dr = Math.abs(p.r - bgColor.r)
    const dg = Math.abs(p.g - bgColor.g)
    const db = Math.abs(p.b - bgColor.b)
    return dr + dg + db > threshold
  })
}

/**
 * Apply a brightness multiplier to a cell's colors.
 * Returns a new Cell with modified color and backgroundColor.
 */
export function shade(cell: Cell, pixel: RGBA, intensity: number): Cell {
  const r = Math.min(255, Math.round(pixel.r * intensity))
  const g = Math.min(255, Math.round(pixel.g * intensity))
  const b = Math.min(255, Math.round(pixel.b * intensity))
  return {
    char: cell.char,
    color: `rgb(${r},${g},${b})`,
    backgroundColor: `rgb(${r},${g},${b})`,
  }
}

/** Parse a hex color string to RGBA. */
export function hex(color: string): RGBA {
  const c = color.replace('#', '')
  const n = parseInt(c, 16)
  if (c.length === 3) {
    return {
      r: ((n >> 8) & 0xf) * 17,
      g: ((n >> 4) & 0xf) * 17,
      b: (n & 0xf) * 17,
      a: 255,
    }
  }
  return {
    r: (n >> 16) & 0xff,
    g: (n >> 8) & 0xff,
    b: n & 0xff,
    a: 255,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

/** Draw image to an offscreen canvas, with optional padding margin. */
function rasterize(
  img: HTMLImageElement,
  cols: number,
  rows: number,
  padding: number,
  padColor: { r: number; g: number; b: number },
) {
  const scale = Math.max(1, Math.ceil(Math.max(img.width / cols, img.height / rows)))
  const w = cols * scale
  const h = rows * scale

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  // Fill with pad color
  ctx.fillStyle = `rgb(${padColor.r},${padColor.g},${padColor.b})`
  ctx.fillRect(0, 0, w, h)

  // Inner region after padding
  const px = Math.floor(w * padding)
  const py = Math.floor(h * padding)
  const iw = w - 2 * px
  const ih = h - 2 * py

  // Maintain aspect ratio — contain within inner region
  const imgAspect = img.width / img.height
  const innerAspect = iw / ih
  let dw: number, dh: number, dx: number, dy: number
  if (imgAspect > innerAspect) {
    dw = iw
    dh = iw / imgAspect
    dx = px
    dy = py + (ih - dh) / 2
  } else {
    dh = ih
    dw = ih * imgAspect
    dx = px + (iw - dw) / 2
    dy = py
  }

  ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh)

  return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h }
}
