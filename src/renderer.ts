/**
 * DOM text renderer.
 *
 * Renders the cell buffer into a <pre> element as a series of <span> rows.
 * Uses a back-buffer to dirty-check at the row level — only rows that changed
 * since the last frame are rewritten into the DOM, avoiding unnecessary reflows.
 *
 * Styling is applied as inline CSS on <span> elements only when it differs
 * from the container's baseline style, keeping the DOM as lean as possible.
 */

import type { Cell, Context, Metrics, RunSettings } from './types'

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/**
 * Measure the actual rendered dimensions of a single character in `el`.
 * Creates a temporary <span>, measures it, then removes it.
 * Call this after fonts have loaded (document.fonts.ready).
 */
export function calcMetrics(el: HTMLElement): Metrics {
  const style = getComputedStyle(el)
  const fontSize = parseFloat(style.fontSize)
  const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.2

  // Measure average character width over 50 chars to handle subpixel rounding
  const span = document.createElement('span')
  span.style.visibility = 'hidden'
  span.style.position = 'absolute'
  span.textContent = 'X'.repeat(50)
  el.appendChild(span)
  const cellWidth = span.getBoundingClientRect().width / 50
  el.removeChild(span)

  return {
    cellWidth,
    lineHeight,
    aspect: cellWidth / lineHeight,
  }
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

/**
 * Create a stateful text renderer.
 * Call render() each frame; call invalidate() on resize to force a full redraw.
 */
export function createTextRenderer() {
  // Back-buffer stores the last rendered state for dirty checking
  const backBuffer: Cell[] = []
  let backCols = 0
  let backRows = 0

  /** Force a full redraw on the next render() call (used after resize). */
  function invalidate() {
    backBuffer.length = 0
    backCols = 0
    backRows = 0
  }

  function render(
    el: HTMLElement,
    context: Context,
    buffer: Cell[],
    settings: RunSettings
  ): void {
    const { cols, rows } = context

    // Sync DOM row count with current grid height
    while (el.childElementCount < rows) {
      const span = document.createElement('span')
      span.style.display = 'block'
      span.style.whiteSpace = 'pre'
      el.appendChild(span)
    }
    while (el.childElementCount > rows) {
      el.removeChild(el.lastChild!)
    }

    // On resize, reset back-buffer dimensions so every row is marked dirty
    if (cols !== backCols || rows !== backRows) {
      backCols = cols
      backRows = rows
      backBuffer.length = 0
    }

    // Render each row
    for (let j = 0; j < rows; j++) {
      const offset = j * cols

      // Check if any cell in this row changed since last frame
      let rowDirty = false
      for (let i = 0; i < cols; i++) {
        if (!cellsEqual(buffer[offset + i], backBuffer[offset + i])) {
          rowDirty = true
          break
        }
      }
      if (!rowDirty) continue

      // Build the HTML string for this row
      const rowEl = el.childNodes[j] as HTMLElement
      rowEl.innerHTML = buildRowHTML(buffer, offset, cols, settings)

      // Snapshot this row into the back-buffer
      for (let i = 0; i < cols; i++) {
        backBuffer[offset + i] = { ...(buffer[offset + i] ?? { char: ' ' }) }
      }
    }
  }

  return { render, invalidate }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the innerHTML string for one row of the grid.
 * Groups adjacent cells with identical styles into a single <span> to keep
 * the DOM lean. Only emits inline styles that differ from the container defaults.
 */
function buildRowHTML(
  buffer: Cell[],
  offset: number,
  cols: number,
  settings: RunSettings
): string {
  let html = ''
  let prevColor: string | undefined
  let prevBg: string | undefined
  let prevWeight: string | undefined
  let spanOpen = false

  for (let i = 0; i < cols; i++) {
    const cell = buffer[offset + i] ?? { char: ' ' }
    const char = cell.char || ' '

    // Determine if this cell's style differs from the previous cell
    const color = cell.color !== settings.color ? cell.color : undefined
    const bg = cell.backgroundColor !== settings.backgroundColor ? cell.backgroundColor : undefined
    const weight = cell.fontWeight !== settings.fontWeight ? cell.fontWeight : undefined

    const styleChanged = color !== prevColor || bg !== prevBg || weight !== prevWeight

    if (styleChanged) {
      if (spanOpen) html += '</span>'
      // Only open a new span if there's any non-default style to apply
      if (color || bg || weight) {
        let css = ''
        if (color)  css += `color:${color};`
        if (bg)     css += `background:${bg};`
        if (weight) css += `font-weight:${weight};`
        html += `<span style="${css}">`
        spanOpen = true
      } else {
        spanOpen = false
      }
      prevColor = color
      prevBg = bg
      prevWeight = weight
    }

    // Escape HTML special characters
    html += escapeChar(char)
  }

  if (spanOpen) html += '</span>'
  return html
}

/** Escape a single character for safe HTML injection. */
function escapeChar(char: string): string {
  switch (char) {
    case '&': return '&amp;'
    case '<': return '&lt;'
    case '>': return '&gt;'
    default:  return char
  }
}

/** Deep equality check for two cells. */
function cellsEqual(a: Cell | undefined, b: Cell | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.char            === b.char &&
    a.color           === b.color &&
    a.backgroundColor === b.backgroundColor &&
    a.fontWeight      === b.fontWeight
  )
}
