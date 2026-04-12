/**
 * @module buffer
 * Safe helpers for reading and writing the cell buffer.
 * The buffer is a flat 1D array indexed as: index = x + y * cols.
 * Out-of-bounds reads return an empty cell; out-of-bounds writes are no-ops.
 */

import type { Cell, Context } from '../types'

// A reusable empty cell returned for out-of-bounds reads
const EMPTY: Cell = { char: ' ' }

/** Safely read a cell from the buffer. Returns an empty cell if out of bounds. */
export function get(x: number, y: number, buffer: Cell[], context: Context): Cell {
  const { cols, rows } = context
  if (x < 0 || x >= cols || y < 0 || y >= rows) return EMPTY
  return buffer[x + y * cols] ?? EMPTY
}

/** Safely write a cell to the buffer. No-op if out of bounds. */
export function set(cell: Cell, x: number, y: number, buffer: Cell[], context: Context): void {
  const { cols, rows } = context
  if (x < 0 || x >= cols || y < 0 || y >= rows) return
  buffer[x + y * cols] = cell
}

/**
 * Safely merge partial cell properties into an existing cell.
 * Only the provided fields are updated; others are preserved.
 */
export function merge(partial: Partial<Cell>, x: number, y: number, buffer: Cell[], context: Context): void {
  const { cols, rows } = context
  if (x < 0 || x >= cols || y < 0 || y >= rows) return
  const i = x + y * cols
  buffer[i] = { ...(buffer[i] ?? EMPTY), ...partial }
}

/** Fill the entire buffer with a single cell value. */
export function fill(cell: Cell, buffer: Cell[]): void {
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = { ...cell }
  }
}

/** Fill a rectangular region with a single cell value. Clamps to buffer bounds. */
export function rect(
  cell: Cell,
  x: number,
  y: number,
  w: number,
  h: number,
  buffer: Cell[],
  context: Context
): void {
  const { cols, rows } = context
  const x1 = Math.max(0, x)
  const y1 = Math.max(0, y)
  const x2 = Math.min(cols, x + w)
  const y2 = Math.min(rows, y + h)
  for (let j = y1; j < y2; j++) {
    for (let i = x1; i < x2; i++) {
      buffer[i + j * cols] = { ...cell }
    }
  }
}

/**
 * Write a string of characters into the buffer starting at (x, y).
 * Newlines (\n) advance to the next row. Out-of-bounds characters are skipped.
 */
export function text(
  str: string,
  x: number,
  y: number,
  style: Omit<Cell, 'char'>,
  buffer: Cell[],
  context: Context
): void {
  const { cols, rows } = context
  let cx = x
  let cy = y
  for (const char of str) {
    if (char === '\n') {
      cx = x
      cy++
      continue
    }
    if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) {
      buffer[cx + cy * cols] = { ...style, char }
    }
    cx++
  }
}
