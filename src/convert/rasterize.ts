/**
 * Rasterizer: converts pixel frames into cell data grids.
 *
 * This is where 80% of visual quality lives. The rasterizer downsamples
 * source pixels into a character grid, computing per-cell brightness,
 * coverage, and color.
 */

import type { Frame, CellData, CellFrame, RasterOptions, BgRemovalOptions } from './types'

// Precomputed luminance LUT: lum[byte] = 0-1 luminance contribution
// Avoids per-pixel float math in the hot loop
const LUM_R = new Float32Array(256)
const LUM_G = new Float32Array(256)
const LUM_B = new Float32Array(256)
for (let i = 0; i < 256; i++) {
  LUM_R[i] = 0.299 * i / 255
  LUM_G[i] = 0.587 * i / 255
  LUM_B[i] = 0.114 * i / 255
}

/** Compute luminance from RGB using precomputed LUT */
function luminance(r: number, g: number, b: number): number {
  return LUM_R[r] + LUM_G[g] + LUM_B[b]
}

/** Squared color distance between two RGB values */
function colorDist2(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number
): number {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return dr * dr + dg * dg + db * db
}

/**
 * Auto-detect the dominant background color by sampling corners and edges.
 * Returns [r, g, b] of the most common color in those samples.
 */
export function detectBgColor(frame: Frame): [number, number, number] {
  const { data, width, height } = frame
  const samples: [number, number, number][] = []

  // Sample from corners and edges
  const positions = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [Math.floor(width / 2), 0], [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)], [width - 1, Math.floor(height / 2)],
  ]

  for (const [x, y] of positions) {
    const i = (y * width + x) * 4
    samples.push([data[i], data[i + 1], data[i + 2]])
  }

  // Find the most common color (by bucketing with tolerance)
  const threshold2 = 30 * 30
  const buckets: { color: [number, number, number]; count: number }[] = []

  for (const sample of samples) {
    let matched = false
    for (const bucket of buckets) {
      if (colorDist2(sample[0], sample[1], sample[2], bucket.color[0], bucket.color[1], bucket.color[2]) < threshold2) {
        bucket.count++
        matched = true
        break
      }
    }
    if (!matched) {
      buckets.push({ color: sample, count: 1 })
    }
  }

  buckets.sort((a, b) => b.count - a.count)
  return buckets[0]?.color ?? [0, 0, 0]
}

/**
 * Compute the optimal number of rows given cols, source dimensions,
 * and character cell aspect ratio.
 */
export function computeRows(cols: number, srcWidth: number, srcHeight: number, charAspect: number): number {
  const imageAspect = srcWidth / srcHeight
  return Math.max(1, Math.round(cols / imageAspect / charAspect))
}

/**
 * Rasterize a single frame into cell data.
 *
 * For each cell in the output grid, we examine the block of source pixels
 * it covers and compute brightness, coverage, and average color.
 */
export function rasterizeFrame(
  frame: Frame,
  options: RasterOptions,
  bgRemoval?: BgRemovalOptions
): CellFrame {
  const { data, width, height, delay } = frame
  const charAspect = options.charAspect ?? 2.0
  const cols = options.cols
  const rows = options.rows ?? computeRows(cols, width, height, charAspect)
  const mode = options.mode

  // How many source pixels each cell covers
  const cellW = width / cols
  const cellH = height / rows

  // Background removal setup
  const removeBg = bgRemoval?.enabled ?? false
  const bgColor = bgRemoval?.color
  const bgThreshold2 = (bgRemoval?.threshold ?? 30) ** 2
  const coverageMin = bgRemoval?.coverageMin ?? 0.15

  const cells: CellData[] = new Array(cols * rows)

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      // Source pixel bounds for this cell
      const srcX0 = Math.floor(cx * cellW)
      const srcY0 = Math.floor(cy * cellH)
      const srcX1 = Math.min(width, Math.floor((cx + 1) * cellW))
      const srcY1 = Math.min(height, Math.floor((cy + 1) * cellH))

      let totalPixels = 0
      let fgPixels = 0
      let lumSum = 0
      let rSum = 0
      let gSum = 0
      let bSum = 0
      // Separate accumulators for foreground-only (used in coverage mode)
      let fgLumSum = 0
      let fgRSum = 0
      let fgGSum = 0
      let fgBSum = 0

      for (let py = srcY0; py < srcY1; py++) {
        for (let px = srcX0; px < srcX1; px++) {
          const i = (py * width + px) * 4
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const a = data[i + 3]

          totalPixels++

          // Determine if this pixel is foreground
          let isFg = true

          // Alpha check
          if (a < 128) {
            isFg = false
          }
          // Background color check
          else if (removeBg && bgColor) {
            if (colorDist2(r, g, b, bgColor[0], bgColor[1], bgColor[2]) < bgThreshold2) {
              isFg = false
            }
          }

          const lum = luminance(r, g, b)
          lumSum += lum
          rSum += r
          gSum += g
          bSum += b

          if (isFg) {
            fgPixels++
            fgLumSum += lum
            fgRSum += r
            fgGSum += g
            fgBSum += b
          }
        }
      }

      const coverage = totalPixels > 0 ? fgPixels / totalPixels : 0
      const allBrightness = totalPixels > 0 ? lumSum / totalPixels : 0
      const fgBrightness = fgPixels > 0 ? fgLumSum / fgPixels : 0

      // Pick brightness and color based on mode
      let brightness: number
      let sourceColor: [number, number, number]

      if (mode === 'coverage') {
        // Hybrid: use foreground-only values, mask by coverage
        if (coverage < coverageMin) {
          brightness = 0
          sourceColor = [0, 0, 0]
        } else {
          brightness = fgBrightness
          sourceColor = [
            Math.round(fgRSum / fgPixels),
            Math.round(fgGSum / fgPixels),
            Math.round(fgBSum / fgPixels),
          ]
        }
      } else if (mode === 'silhouette') {
        brightness = coverage >= coverageMin ? 1 : 0
        sourceColor = coverage >= coverageMin
          ? [Math.round(rSum / totalPixels), Math.round(gSum / totalPixels), Math.round(bSum / totalPixels)]
          : [0, 0, 0]
      } else {
        // brightness mode (default for photos)
        brightness = allBrightness
        sourceColor = totalPixels > 0
          ? [Math.round(rSum / totalPixels), Math.round(gSum / totalPixels), Math.round(bSum / totalPixels)]
          : [0, 0, 0]
      }

      cells[cx + cy * cols] = {
        brightness,
        coverage,
        sourceColor,
        x: cols > 1 ? cx / (cols - 1) : 0.5,
        y: rows > 1 ? cy / (rows - 1) : 0.5,
      }
    }
  }

  return { cells, cols, rows, delay }
}

/**
 * Rasterize multiple frames (for animated sources).
 */
export function rasterizeFrames(
  frames: Frame[],
  options: RasterOptions,
  bgRemoval?: BgRemovalOptions
): CellFrame[] {
  // Use first frame to compute rows if not specified
  if (!options.rows && frames.length > 0) {
    const charAspect = options.charAspect ?? 2.0
    options = {
      ...options,
      rows: computeRows(options.cols, frames[0].width, frames[0].height, charAspect),
    }
  }

  return frames.map(frame => rasterizeFrame(frame, options, bgRemoval))
}
