Generate an aiscii animation program based on the user's description.

## What is aiscii

A browser-based ASCII animation runtime. Programs are TypeScript modules that export lifecycle functions. The runtime calls them every frame and renders the result into a DOM element.

## Program anatomy

```typescript
import type { Program } from '../src/types'

// Optional: override runtime settings for this program
export const settings = {
  fps: 60,
  backgroundColor: '#000',
  color: '#fff',
}

// Optional: runs once before the first frame. Return value becomes `state`.
export function boot(context, buffer, userData) {
  return { /* initial state */ }
}

// Optional: runs once per frame BEFORE main(). Use to clear or set background.
export function pre(context, cursor, buffer, state) { }

// Optional: runs once per CELL per frame. Return a Cell or char string.
export function main(coord, context, cursor, buffer, state) {
  return { char: '.', color: 'white', backgroundColor: 'black' }
  // or just: return '.'
}

// Optional: runs once per frame AFTER main(). Use for overlays.
export function post(context, cursor, buffer, state) { }
```

You only need to export the functions you use. A pure-math animation only needs `main`. A z-buffer renderer only needs `pre`.

## Key types

```typescript
// Passed to main() — position of the current cell
interface Coord {
  x: number     // grid column, integer, [0, cols-1]
  y: number     // grid row, integer, [0, rows-1]
  index: number // flat buffer index: x + y * cols
  u: number     // x / (cols-1), range [0, 1]
  v: number     // y / (rows-1), range [0, 1]
}

// Passed to all lifecycle functions
interface Context {
  frame:   number   // frame counter, starts at 1
  time:    number   // elapsed ms since start
  cols:    number   // grid width in characters
  rows:    number   // grid height in characters
  metrics: {
    cellWidth:  number  // px width of one character
    lineHeight: number  // px height of one character
    aspect:     number  // cellWidth / lineHeight (~0.45–0.55)
  }
}

// What main() returns
interface Cell {
  char:            string   // the character to display
  color?:          string   // CSS color, e.g. 'white', '#ff0'
  backgroundColor?: string  // CSS color
  fontWeight?:      string  // CSS font-weight, e.g. '700'
}
```

## Available modules

Import from `../src/modules/<name>`:

### math
```typescript
import { map, clamp, lerp, osc, oscBipolar, ease, smoothstep, fract, mod, centered, DENSITY } from '../src/modules/math'

map(v, inMin, inMax, outMin, outMax)  // remap a value between ranges
clamp(v, min, max)
lerp(a, b, t)
osc(time, freq, phase?)               // sine oscillator → [0, 1]
oscBipolar(time, freq, phase?)        // sine oscillator → [-1, 1]
ease.in(t) / ease.out(t) / ease.inOut(t) / ease.elastic(t)
smoothstep(edge0, edge1, x)
fract(x)                              // fractional part
mod(x, y)                             // always-positive modulo

// CRITICAL for SDF work — converts Coord to aspect-corrected centered space
// Origin at center, [-1,1] on shorter axis, circles look circular
centered(coord, context) → { x, y }

DENSITY.simple   // ' .:-=+*#%@'         (10 chars, safe ASCII)
DENSITY.complex  // 70-char ASCII ramp   (safe ASCII)
DENSITY.dots     // dot-based ramp       (safe ASCII)
DENSITY.binary   // code/binary aesthetic (safe ASCII)
DENSITY.blocks   // '░▒▓█' block chars   (unicode, needs compatible font)
```

### sdf
```typescript
import * as sdf from '../src/modules/sdf'

// Primitives — return signed distance (negative = inside, positive = outside)
sdf.circle(x, y, r)                   // circle at origin
sdf.box(x, y, halfW, halfH)           // axis-aligned box at origin
sdf.ring(x, y, radius, thickness)     // annulus
sdf.segment(x, y, ax, ay, bx, by)     // line segment
sdf.triangle(x, y, r)                 // equilateral triangle

// Boolean ops
sdf.union(a, b)                        // min(a, b)
sdf.intersect(a, b)                    // max(a, b)
sdf.subtract(a, b)                     // cut b from a
sdf.smoothUnion(a, b, k)              // blended union
sdf.smoothSubtract(a, b, k)           // blended subtract

// Domain ops
sdf.repeat(x, y, px, py) → { x, y }  // tile both axes
sdf.repeatX(x, period)                // tile x axis
sdf.rotateDomain(x, y, angle) → { x, y }

// Rendering helpers
sdf.fill(d, softness?)    // SDF distance → 0-1 fill value (1 = inside)
sdf.outline(d, width?, softness?)  // SDF distance → 0-1 outline value
```

### color
```typescript
import { rgb, hsl, hsla, palette, PALETTES, lerpRGB } from '../src/modules/color'

rgb(r, g, b)             // r,g,b in [0,255] → CSS string
hsl(h, s, l)             // h [0,360], s,l [0,100] → CSS string
palette(t, a, b, c, d)   // IQ cosine palette, t in [0,1], each of a,b,c,d is [r,g,b] triple in [0,1]

PALETTES.rainbow(t)      // full spectrum
PALETTES.cool(t)         // blue-green-purple
PALETTES.warm(t)         // orange-red-yellow
PALETTES.neon(t)         // pink-cyan
PALETTES.mono(t)         // grayscale
```

### noise
```typescript
import { noise2, noise3, fbm } from '../src/modules/noise'

noise2(x, y)                  // 2D simplex noise → [-1, 1]
noise3(x, y, z)               // 3D simplex noise → [-1, 1]
                               // noise3(x, y, time*0.001) = animated 2D noise
fbm(x, y, z, octaves?)        // fractional brownian motion, layered noise
```

### vec2
```typescript
import * as vec2 from '../src/modules/vec2'
vec2.vec2(x, y) / add / sub / mul / div / dot / length / normalize / dist / lerp / rotate
```

### buffer
```typescript
import * as buf from '../src/modules/buffer'
buf.get(x, y, buffer, context)
buf.set(cell, x, y, buffer, context)
buf.fill(cell, buffer)
buf.rect(cell, x, y, w, h, buffer, context)
buf.text(str, x, y, style, buffer, context)
```

## Patterns

### Density lookup
```typescript
const d = DENSITY.complex
const i = Math.floor(map(value, -1, 1, 0, d.length - 1))
return d[Math.max(0, Math.min(d.length - 1, i))] ?? ' '
```

### SDF shape with color
```typescript
import { centered } from '../src/modules/math'
import * as sdf from '../src/modules/sdf'

export function main(coord, context) {
  const { x, y } = centered(coord, context)
  const t = context.time * 0.001
  const d = sdf.circle(x, y, 0.3 + Math.sin(t) * 0.1)
  const f = sdf.fill(d)
  return {
    char: f > 0.5 ? '@' : ' ',
    backgroundColor: f > 0.5 ? 'hsl(200,80%,40%)' : '#000',
  }
}
```

### Animated noise field
```typescript
import { noise3 } from '../src/modules/noise'
import { map, centered, DENSITY } from '../src/modules/math'

export function main(coord, context) {
  const { x, y } = centered(coord, context)
  const n = noise3(x * 2, y * 2, context.time * 0.0005)
  const i = Math.floor(map(n, -1, 1, 0, DENSITY.simple.length - 1))
  return DENSITY.simple[Math.max(0, i)] ?? ' '
}
```

### Pre-pass for whole-frame rendering (e.g. 3D)
```typescript
export function pre(context, cursor, buffer) {
  // Clear to background
  for (let i = 0; i < buffer.length; i++) buffer[i] = { char: ' ' }
  // Then write directly into buffer[x + y * context.cols]
}
// No main() needed — pre() owns the whole buffer
```

### Stateful program with boot()
```typescript
interface State { particles: Array<{ x: number; y: number; vx: number; vy: number }> }
const program: Program<State> = {
  boot(context) {
    return { particles: Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random(), vx: 0, vy: 0 })) }
  },
  pre(context, cursor, buffer, state) {
    buf.fill({ char: ' ' }, buffer)
    for (const p of state.particles) {
      p.x += p.vx * 0.01
      p.y += p.vy * 0.01
      // wrap, write to buffer, etc.
    }
  }
}
```

## Output file location

Save new programs to `/Users/ossama/Documents/Projects/aiscii/programs/<name>.ts`

To run: update the import in `index.html` to point to the new program file.

## Rules

- Use `centered()` before any SDF math — never do SDF in raw u/v space
- `DENSITY` strings are ordered dark→light. Index 0 = darkest, last index = brightest.
- `time` is milliseconds. Multiply by small numbers (0.0005–0.002) for readable speeds.
- For smooth animation without flicker, prefer `pre()` for clearing + `main()` for per-cell math. Only use `pre()` alone (writing buffer directly) when doing z-buffer or particle rendering.
- Keep `main()` stateless when possible — pure function over (coord, context) → cell.
- Never mutate `context` or `coord` — they are frozen/read-only.
