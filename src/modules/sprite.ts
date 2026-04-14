/**
 * Sprite — frame-based ASCII animation support.
 *
 * A Sprite is an array of frames, where each frame is an array of strings (rows).
 * The module handles frame cycling, positioning, and blitting to the buffer.
 */

import type { Cell, Context } from '../types'

/** A single frame: array of strings, one per row */
export type Frame = string[]

/** A sprite: array of frames forming an animation */
export type Sprite = Frame[]

/**
 * Pick the current frame from a sprite based on elapsed time.
 * @param sprite   Array of frames
 * @param time     Elapsed ms (context.time)
 * @param fps      Playback speed in frames per second (default 8)
 */
export function frame(sprite: Sprite, time: number, fps = 8): Frame {
  const idx = Math.floor((time / 1000) * fps) % sprite.length
  return sprite[idx]!
}

/**
 * Blit a frame into the cell buffer at position (ox, oy).
 * Spaces in the frame are treated as transparent (skipped).
 *
 * @param f        The frame (array of strings)
 * @param ox       X position (column) in the grid
 * @param oy       Y position (row) in the grid
 * @param style    Color/background to apply to non-space characters
 * @param buffer   The cell buffer
 * @param context  Runtime context (for cols/rows bounds)
 */
export function blit(
  f: Frame,
  ox: number,
  oy: number,
  style: { color?: string; backgroundColor?: string },
  buffer: Cell[],
  context: Context,
): void {
  const { cols, rows } = context
  for (let r = 0; r < f.length; r++) {
    const row = f[r]!
    const y = oy + r
    if (y < 0 || y >= rows) continue
    for (let c = 0; c < row.length; c++) {
      const x = ox + c
      if (x < 0 || x >= cols) continue
      const ch = row[c]!
      if (ch === ' ') continue
      const cell: Cell = { char: ch }
      if (style.color) cell.color = style.color
      if (style.backgroundColor) cell.backgroundColor = style.backgroundColor
      buffer[x + y * cols] = cell
    }
  }
}

/**
 * Center a frame horizontally and vertically in the grid.
 * Returns the top-left (ox, oy) for use with blit().
 */
export function center(f: Frame, context: Context): { ox: number; oy: number } {
  const width = Math.max(...f.map(row => row.length))
  const height = f.length
  return {
    ox: Math.floor((context.cols - width) / 2),
    oy: Math.floor((context.rows - height) / 2),
  }
}

/**
 * Scroll a sprite horizontally. Returns the x position for blit().
 * Wraps around so the sprite re-enters from the opposite side.
 *
 * @param time      Elapsed ms
 * @param speed     Columns per second (negative = left)
 * @param width     Width of the sprite frame
 * @param cols      Grid width (context.cols)
 */
export function scrollX(time: number, speed: number, width: number, cols: number): number {
  const travel = (time / 1000) * speed
  return ((travel % (cols + width)) + cols + width) % (cols + width) - width
}
