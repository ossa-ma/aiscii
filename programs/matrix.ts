import { clamp, mod } from '../src/modules/math'
import { hsl } from '../src/modules/color'
import * as buf from '../src/modules/buffer'

export const settings = {
  fps: 30,
  backgroundColor: '#000',
  color: '#0f0',
}

const TITLE = 'AISCII'
const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789@#$%&*+=<>?/|{}[]~'

// Deterministic pseudo-random from column index
function colRand(col: number, seed: number): number {
  const x = Math.sin(col * 127.1 + seed * 311.7) * 43758.5453
  return x - Math.floor(x)
}

interface Drop {
  speed: number    // rows per second
  offset: number   // starting y offset (stagger)
  length: number   // trail length
  charSeed: number // for character selection
}

interface State {
  drops: Drop[]
  lastCols: number
}

export function boot(context: any) {
  const drops: Drop[] = []
  for (let c = 0; c < context.cols; c++) {
    drops.push(makeDrop(c))
  }
  return { drops, lastCols: context.cols }
}

function makeDrop(col: number): Drop {
  return {
    speed: 8 + colRand(col, 1) * 22,
    offset: colRand(col, 2) * 80,
    length: 8 + Math.floor(colRand(col, 3) * 24),
    charSeed: colRand(col, 4) * 1000,
  }
}

export function pre(context: any, _cursor: any, buffer: any, state: State) {
  // Handle resize
  if (context.cols !== state.lastCols) {
    state.drops = []
    for (let c = 0; c < context.cols; c++) {
      state.drops.push(makeDrop(c))
    }
    state.lastCols = context.cols
  }

  const t = context.time * 0.001
  const { cols, rows } = context

  // Clear buffer
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = { char: ' ', color: '#000', backgroundColor: '#000' }
  }

  // --- Matrix rain ---
  for (let c = 0; c < cols; c++) {
    const drop = state.drops[c]
    if (!drop) continue

    // Head position (wraps around)
    const headF = (t * drop.speed + drop.offset)
    const head = mod(headF, rows + drop.length + 10)

    for (let r = 0; r < rows; r++) {
      const distFromHead = head - r
      if (distFromHead < 0 || distFromHead > drop.length) continue

      const trailT = distFromHead / drop.length // 0 = head, 1 = tail

      // Character: changes over time for the glitch effect, head changes fastest
      const charFlicker = trailT < 0.05
        ? Math.floor(t * 20 + c) // head char flickers fast
        : Math.floor(drop.charSeed + r * 7.3 + Math.floor(t * 2) * (trailT < 0.15 ? 1 : 0))
      const char = CHARS[mod(charFlicker, CHARS.length)] ?? 'a'

      // Brightness: head is white-hot, fades to dark green
      const brightness = 1 - trailT
      const isHead = trailT < 0.04

      let color: string
      if (isHead) {
        color = hsl(120, 50, 85 + brightness * 15) // near white
      } else if (trailT < 0.15) {
        color = hsl(120, 90, 45 + brightness * 30) // bright green
      } else {
        color = hsl(120, 80, 5 + brightness * 35)  // fading green
      }

      const idx = c + r * cols
      if (idx < buffer.length) {
        buffer[idx] = {
          char,
          color,
          backgroundColor: isHead ? hsl(120, 80, 8) : '#000',
          fontWeight: isHead ? '700' : undefined,
        }
      }
    }
  }

  // --- Centered AISCII title ---
  const titleRow = Math.floor(rows / 2)
  const titleCol = Math.floor((cols - TITLE.length) / 2)

  // Glow region around title
  const glowPadX = 3
  const glowPadY = 1
  for (let dy = -glowPadY; dy <= glowPadY; dy++) {
    for (let dx = -glowPadX; dx <= TITLE.length + glowPadX - 1; dx++) {
      const gx = titleCol + dx
      const gy = titleRow + dy
      if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) continue
      const idx = gx + gy * cols
      if (idx < buffer.length) {
        // Darken background behind title for readability
        const existing = buffer[idx]
        if (existing && existing.char !== ' ') {
          // Dim the rain behind title
          buffer[idx] = {
            char: existing.char,
            color: hsl(120, 60, 8),
            backgroundColor: '#000',
          }
        }
      }
    }
  }

  // Title characters
  for (let i = 0; i < TITLE.length; i++) {
    const cx = titleCol + i
    if (cx < 0 || cx >= cols) continue
    const idx = cx + titleRow * cols
    if (idx >= buffer.length) continue

    // Per-character shimmer
    const shimmer = Math.sin(t * 3 + i * 0.8) * 0.5 + 0.5
    const lit = 55 + shimmer * 35

    buffer[idx] = {
      char: TITLE[i]!,
      color: hsl(120, 90, lit),
      backgroundColor: hsl(120, 90, 3 + shimmer * 4),
      fontWeight: '700',
    }
  }
}
