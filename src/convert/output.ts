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

/** Export styled frames as a self-contained HTML string with animation */
export function toHTML(frames: StyledFrame | StyledFrame[], bgColor = '#000000'): string {
  const frameArr = Array.isArray(frames) ? frames : [frames]

  function renderFrame(frame: StyledFrame): string {
    const { cells, cols, rows } = frame
    let html = ''
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = cells[x + y * cols]
        if (cell.color === 'transparent' || cell.char === ' ') {
          html += ' '
        } else {
          html += `<span style="color:${cell.color}">${escapeHtml(cell.char)}</span>`
        }
      }
      html += '\n'
    }
    return html
  }

  if (frameArr.length === 1) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>aiscii</title></head>
<body style="margin:0;background:${bgColor};display:flex;justify-content:center;align-items:center;min-height:100vh">
<pre style="font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.15em;letter-spacing:0.5px">${renderFrame(frameArr[0])}</pre>
</body>
</html>`
  }

  // Animated: embed all frames and cycle with JS
  const framesJson = JSON.stringify(frameArr.map(renderFrame))
  const delays = JSON.stringify(frameArr.map(f => f.delay || 40))

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>aiscii</title></head>
<body style="margin:0;background:${bgColor};display:flex;justify-content:center;align-items:center;min-height:100vh">
<pre id="canvas" style="font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.15em;letter-spacing:0.5px"></pre>
<script>
const frames = ${framesJson};
const delays = ${delays};
let i = 0;
const el = document.getElementById('canvas');
function tick() {
  el.innerHTML = frames[i];
  const delay = delays[i];
  i = (i + 1) % frames.length;
  setTimeout(tick, delay);
}
tick();
</script>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ---------------------------------------------------------------------------
// Program (.ts) — generates a self-contained aiscii Program
// ---------------------------------------------------------------------------

/**
 * Generate a complete aiscii Program .ts file with embedded frame data.
 * The program plays back pre-rendered ASCII frames as a sprite animation.
 */
export function toProgram(
  frames: StyledFrame[],
  options: {
    name?: string
    backgroundColor?: string
    fps?: number
  } = {}
): string {
  const name = options.name ?? 'convertedProgram'
  const bg = options.backgroundColor ?? '#000000'
  const fps = options.fps ?? (frames.length > 1 && frames[0].delay > 0
    ? Math.round(1000 / frames[0].delay)
    : 24)

  const cols = frames[0]?.cols ?? 0
  const rows = frames[0]?.rows ?? 0

  // Extract frame data as string[][] (each frame = array of row strings)
  const frameStrings: string[][][] = frames.map(frame => {
    const rowStrings: string[][] = []
    for (let y = 0; y < frame.rows; y++) {
      const chars: string[] = []
      for (let x = 0; x < frame.cols; x++) {
        const cell = frame.cells[x + y * frame.cols]
        chars.push(cell.color === 'transparent' || cell.char === ' ' ? ' ' : cell.char)
      }
      // Find the last non-space character to trim trailing spaces
      let lastNonSpace = chars.length - 1
      while (lastNonSpace >= 0 && chars[lastNonSpace] === ' ') lastNonSpace--
      rowStrings.push(chars.slice(0, lastNonSpace + 1))
    }
    return rowStrings
  })

  // Collect unique non-space characters and colors used
  const colorSet = new Set<string>()
  for (const frame of frames) {
    for (const cell of frame.cells) {
      if (cell.color !== 'transparent' && cell.char !== ' ') {
        colorSet.add(cell.color)
      }
    }
  }
  const primaryColor = colorSet.size === 1
    ? [...colorSet][0]
    : '#ffffff'

  // Serialize frames as string arrays (each row is a string)
  const serializedFrames = frameStrings.map(rows =>
    rows.map(chars => chars.join(''))
  )

  // Escape backtick and backslash for template literal safety
  function escapeStr(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')
  }

  const framesArrayStr = serializedFrames.map(rows => {
    const rowStrs = rows.map(row => `"${escapeStr(row)}"`)
    return `[${rowStrs.join(', ')}]`
  }).join(',\n')

  return `import type { Program, Cell, Context, Cursor } from 'aiscii'

const FRAMES: string[][] = [
${framesArrayStr}
]
const FRAME_WIDTH = ${cols}
const FRAME_HEIGHT = ${rows}
const FRAME_COUNT = ${frames.length}

interface State {
  frameIndex: number
}

export const ${name}: Program<State> = {
  settings: {
    fps: ${fps},
    backgroundColor: '${bg}',
    color: '${primaryColor}',
    fontSize: '12px',
    fontFamily: '"Courier New", Courier, monospace',
    lineHeight: '1.15em',
    letterSpacing: '0.5px',
  },

  boot() {
    return { frameIndex: 0 }
  },

  pre(context: Context, _cursor: Cursor, buffer: Cell[], state: State) {
    const { cols, rows, time } = context

    // Clear
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = { char: ' ', backgroundColor: '${bg}' }
    }

    // Current animation frame
    const frameIdx = Math.floor(time / ${Math.round(1000 / fps)}) % FRAME_COUNT
    const frame = FRAMES[frameIdx]

    // Center the sprite
    const ox = Math.floor((cols - FRAME_WIDTH) / 2)
    const oy = Math.floor((rows - FRAME_HEIGHT) / 2)

    for (let fy = 0; fy < frame.length && oy + fy < rows; fy++) {
      if (oy + fy < 0) continue
      const line = frame[fy]
      for (let fx = 0; fx < line.length && ox + fx < cols; fx++) {
        if (ox + fx < 0) continue
        const ch = line[fx]
        if (ch === ' ') continue
        const idx = (ox + fx) + (oy + fy) * cols
        if (idx >= 0 && idx < buffer.length) {
          buffer[idx] = { char: ch, color: '${primaryColor}', backgroundColor: '${bg}' }
        }
      }
    }
  },
}
`
}
