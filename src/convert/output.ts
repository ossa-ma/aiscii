/**
 * Output renderers: convert styled frames into terminal output, JSON, or HTML.
 */

import type { StyledFrame, CellFrame } from './types'

// ---------------------------------------------------------------------------
// Terminal (ANSI colored)
// ---------------------------------------------------------------------------

/** Convert a CSS rgb() string to ANSI 24-bit escape code */
function rgbToAnsi(color: string): string {
  if (color === 'transparent') return '\x1b[0m'
  const match = color.match(/rgb\((\d+),(\d+),(\d+)\)/)
  if (!match) return '\x1b[0m'
  return `\x1b[38;2;${match[1]};${match[2]};${match[3]}m`
}

/** Render a single styled frame as an ANSI string for terminal output */
export function renderAnsi(frame: StyledFrame): string {
  const { cells, cols, rows } = frame
  const lines: string[] = []

  for (let y = 0; y < rows; y++) {
    let line = ''
    for (let x = 0; x < cols; x++) {
      const cell = cells[x + y * cols]
      if (cell.color === 'transparent' || cell.char === ' ') {
        line += ' '
      } else {
        line += rgbToAnsi(cell.color) + cell.char
      }
    }
    lines.push(line + '\x1b[0m')
  }

  return lines.join('\n')
}

/** Render a plain (no color) ASCII frame */
export function renderPlain(frame: StyledFrame): string {
  const { cells, cols, rows } = frame
  const lines: string[] = []

  for (let y = 0; y < rows; y++) {
    let line = ''
    for (let x = 0; x < cols; x++) {
      line += cells[x + y * cols].char
    }
    lines.push(line)
  }

  return lines.join('\n')
}

/**
 * Play an animation in the terminal by printing frames sequentially.
 * Uses ANSI escape codes to clear and rewrite.
 */
export async function playAnsi(frames: StyledFrame[]): Promise<void> {
  const { write } = process.stdout

  // Hide cursor
  process.stdout.write('\x1b[?25l')

  for (const frame of frames) {
    // Move cursor to top-left
    process.stdout.write('\x1b[H')
    process.stdout.write(renderAnsi(frame))

    if (frame.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, frame.delay))
    }
  }

  // Show cursor
  process.stdout.write('\x1b[?25h\n')
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

/** Export cell frames as JSON (for programmatic consumption / sprite loading) */
export function toJSON(frames: CellFrame[]): string {
  return JSON.stringify({
    frameCount: frames.length,
    cols: frames[0]?.cols ?? 0,
    rows: frames[0]?.rows ?? 0,
    frames: frames.map(f => ({
      delay: f.delay,
      cells: f.cells.map(c => ({
        b: Math.round(c.brightness * 255),  // compact: byte instead of float
        c: c.coverage > 0.01 ? Math.round(c.coverage * 255) : 0,
        r: c.sourceColor,
        x: c.x,
        y: c.y,
      })),
    })),
  })
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

/** Export a styled frame as a self-contained HTML string */
export function toHTML(frame: StyledFrame, bgColor = '#000000'): string {
  const { cells, cols, rows } = frame
  let cellsHtml = ''

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = cells[x + y * cols]
      if (cell.color === 'transparent' || cell.char === ' ') {
        cellsHtml += ' '
      } else {
        cellsHtml += `<span style="color:${cell.color}">${escapeHtml(cell.char)}</span>`
      }
    }
    cellsHtml += '\n'
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>aiscii</title></head>
<body style="margin:0;background:${bgColor};display:flex;justify-content:center;align-items:center;min-height:100vh">
<pre style="font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.15em;letter-spacing:0.5px">${cellsHtml}</pre>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
