/**
 * Frame normalization for animated sources.
 *
 * Computes the union bounding box across all frames and pads each frame
 * to consistent dimensions with consistent centering. Without this,
 * animations jitter as the subject's bounding box shifts between frames.
 */

import type { Frame } from './types'

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
 * Find the bounding box of foreground pixels in a frame.
 * A pixel is foreground if it has alpha > 0 AND (if bgColor provided)
 * is not within threshold distance of the background color.
 */
function frameBounds(
  frame: Frame,
  bgColor?: [number, number, number],
  bgThreshold2 = 900  // 30^2
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const { data, width, height } = frame
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const a = data[i + 3]
      if (a === 0) continue

      if (bgColor) {
        if (colorDist2(data[i], data[i + 1], data[i + 2], bgColor[0], bgColor[1], bgColor[2]) < bgThreshold2) {
          continue
        }
      }

      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  if (maxX < 0) return null
  return { minX, minY, maxX, maxY }
}

/**
 * Normalize an array of frames to consistent dimensions.
 *
 * 1. Computes the union bounding box across all frames
 * 2. Adds padding around the union box
 * 3. Crops/recenters each frame to the union dimensions
 *
 * For single-frame inputs, returns the input unchanged.
 *
 * @param bgColor — background color for content detection. Without this,
 *   only alpha=0 pixels are treated as empty, which fails for GIFs with
 *   solid backgrounds (every pixel has a=255).
 */
export function normalizeFrames(
  frames: Frame[],
  padding = 2,
  bgColor?: [number, number, number]
): Frame[] {
  if (frames.length <= 1) return frames

  // Compute union bounding box across all frames
  let unionMinX = Infinity
  let unionMinY = Infinity
  let unionMaxX = -Infinity
  let unionMaxY = -Infinity

  for (const frame of frames) {
    const bounds = frameBounds(frame, bgColor)
    if (!bounds) continue
    if (bounds.minX < unionMinX) unionMinX = bounds.minX
    if (bounds.minY < unionMinY) unionMinY = bounds.minY
    if (bounds.maxX > unionMaxX) unionMaxX = bounds.maxX
    if (bounds.maxY > unionMaxY) unionMaxY = bounds.maxY
  }

  // If no frames had content, return as-is
  if (unionMaxX < 0) return frames

  // Add padding
  unionMinX = Math.max(0, unionMinX - padding)
  unionMinY = Math.max(0, unionMinY - padding)
  unionMaxX = Math.min(frames[0].width - 1, unionMaxX + padding)
  unionMaxY = Math.min(frames[0].height - 1, unionMaxY + padding)

  const outW = unionMaxX - unionMinX + 1
  const outH = unionMaxY - unionMinY + 1

  // If union box matches all frame dimensions, no work needed
  if (unionMinX === 0 && unionMinY === 0 && outW === frames[0].width && outH === frames[0].height) {
    return frames
  }

  // Crop each frame to the union bounding box
  return frames.map(frame => {
    const out = new Uint8Array(outW * outH * 4)

    for (let y = 0; y < outH; y++) {
      const srcY = unionMinY + y
      if (srcY < 0 || srcY >= frame.height) continue

      const srcOffset = (srcY * frame.width + unionMinX) * 4
      const dstOffset = y * outW * 4
      const copyLen = Math.min(outW, frame.width - unionMinX) * 4

      out.set(frame.data.subarray(srcOffset, srcOffset + copyLen), dstOffset)
    }

    return {
      data: out,
      width: outW,
      height: outH,
      delay: frame.delay,
    }
  })
}
