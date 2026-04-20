---
description: Generate a procedural ASCII animation program. Use when the user wants to create an animation, visual effect, or interactive ASCII art from scratch using code — e.g. "make a plasma wave", "create a starfield", "build a particle effect".
---

Generate an aiscii animation program based on the user's description.

## Prerequisites

Before doing anything else, verify the environment:
- `package.json` exists in the current directory
- `node_modules/aiscii/` exists

If either is missing, stop and tell the user: "Your aiscii project isn't set up yet. Run `/aiscii:setup` first."

## What is aiscii

A browser-based ASCII animation runtime. Programs are TypeScript modules that export lifecycle functions. The runtime calls them every frame and renders the result into a DOM element.

## Import paths

If aiscii is installed as a package (`bun add aiscii` / `npm install aiscii`):
```typescript
import { run } from 'aiscii'
import { map, centered, DENSITY } from 'aiscii/modules/math'
import * as sdf from 'aiscii/modules/sdf'
import { PALETTES } from 'aiscii/modules/color'
import { noise3 } from 'aiscii/modules/noise'
import * as vec2 from 'aiscii/modules/vec2'
import * as buf from 'aiscii/modules/buffer'
```

If working inside the aiscii repo itself (contributors):
```typescript
import { map, centered, DENSITY } from '../src/modules/math'
import * as sdf from '../src/modules/sdf'
// etc.
```

Detect which applies by checking whether `node_modules/aiscii` exists. Default to the package import path.

## Program anatomy

```typescript
import type { Program } from 'aiscii'

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
  char:             string   // the character to display
  color?:           string   // CSS color, e.g. 'white', '#ff0'
  backgroundColor?: string   // CSS color
  fontWeight?:      string   // CSS font-weight, e.g. '700'
}
```

## Available modules

### math
```typescript
import { map, clamp, lerp, osc, oscBipolar, ease, smoothstep, fract, mod, centered, toPolar, DENSITY } from 'aiscii/modules/math'

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

// Convert to polar coordinates — for spirals, radials, kaleidoscopes
toPolar(x, y) → { angle, radius }    // angle in [-π, π], radius >= 0

DENSITY.simple   // ' .:-=+*#%@'         (10 chars, safe ASCII)
DENSITY.complex  // 70-char ASCII ramp   (safe ASCII)
DENSITY.dots     // dot-based ramp       (safe ASCII)
DENSITY.binary   // code/binary aesthetic (safe ASCII)
DENSITY.blocks   // '░▒▓█' block chars   (unicode, needs compatible font)
```

### sdf
```typescript
import * as sdf from 'aiscii/modules/sdf'

// Primitives — return signed distance (negative = inside, positive = outside)
sdf.circle(x, y, r)                   // circle at origin
sdf.box(x, y, halfW, halfH)           // axis-aligned box at origin
sdf.ring(x, y, radius, thickness)     // annulus
sdf.segment(x, y, ax, ay, bx, by)     // line segment
sdf.triangle(x, y, r)                 // equilateral triangle
sdf.polygon(x, y, sides, r)           // regular polygon (5 = pentagon, 6 = hexagon)
sdf.star(x, y, points, outerR, innerR) // star shape (5, 0.3, 0.15 = classic star)

// Boolean ops
sdf.union(a, b)                        // min(a, b)
sdf.intersect(a, b)                    // max(a, b)
sdf.subtract(a, b)                     // cut b from a
sdf.smoothUnion(a, b, k)               // blended union
sdf.smoothSubtract(a, b, k)            // blended subtract

// Domain ops
sdf.repeat(x, y, px, py) → { x, y }   // tile both axes
sdf.repeatX(x, period)                 // tile x axis
sdf.rotateDomain(x, y, angle) → { x, y }

// Rendering helpers
sdf.fill(d, softness?)                 // SDF distance → 0-1 fill value (1 = inside)
sdf.outline(d, width?, softness?)      // SDF distance → 0-1 outline value
```

### color
```typescript
import { rgb, hsl, hsla, palette, PALETTES, lerpRGB, lerpHSL } from 'aiscii/modules/color'

rgb(r, g, b)             // r,g,b in [0,255] → CSS string
hsl(h, s, l)             // h [0,360], s,l [0,100] → CSS string
palette(t, a, b, c, d)   // IQ cosine palette, t in [0,1], each of a,b,c,d is [r,g,b] triple in [0,1]
lerpRGB(r1,g1,b1, r2,g2,b2, t) // interpolate between two RGB colors
lerpHSL(h1,s1,l1, h2,s2,l2, t) // interpolate between two HSL colors (shortest hue path)

PALETTES.rainbow(t)      // full spectrum
PALETTES.cool(t)         // blue-green-purple
PALETTES.warm(t)         // orange-red-yellow
PALETTES.neon(t)         // pink-cyan
PALETTES.mono(t)         // grayscale
```

### noise
```typescript
import { noise2, noise3, fbm } from 'aiscii/modules/noise'

noise2(x, y)                  // 2D simplex noise → [-1, 1]
noise3(x, y, z)               // 3D simplex noise → [-1, 1]
                               // noise3(x, y, time*0.001) = animated 2D noise
fbm(x, y, z, octaves?)        // fractional brownian motion, layered noise
```

### vec2
```typescript
import * as vec2 from 'aiscii/modules/vec2'
vec2.vec2(x, y) / add / sub / mul / div / dot / length / normalize / dist / lerp / rotate
```

### buffer
```typescript
import * as buf from 'aiscii/modules/buffer'
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
import { centered } from 'aiscii/modules/math'
import * as sdf from 'aiscii/modules/sdf'

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
import { noise3 } from 'aiscii/modules/noise'
import { map, centered, DENSITY } from 'aiscii/modules/math'

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

### Polar coordinates (spirals, radials, kaleidoscopes)
```typescript
import { centered, toPolar, map, DENSITY } from 'aiscii/modules/math'

export function main(coord, context) {
  const { x, y } = centered(coord, context)
  const { angle, radius } = toPolar(x, y)
  const t = context.time * 0.001

  // Spiral: combine angle and radius with time
  const spiral = angle + radius * 5 - t * 2
  const v = Math.sin(spiral) * 0.5 + 0.5

  // Kaleidoscope: fold the angle to repeat a pattern N times
  const N = 6
  const fold = Math.abs(((angle / Math.PI + 1) * N / 2) % 1 - 0.5) * 2

  const d = DENSITY.simple
  const i = Math.floor(v * (d.length - 1))
  return d[Math.max(0, Math.min(d.length - 1, i))] ?? ' '
}
```

### Text animation (typewriter, scrolling)
```typescript
import * as buf from 'aiscii/modules/buffer'

export function pre(context, cursor, buffer) {
  for (let i = 0; i < buffer.length; i++) buffer[i] = { char: ' ' }

  const t = context.time * 0.001
  const msg = 'hello world'

  // Typewriter: reveal one character at a time
  const revealed = msg.slice(0, Math.floor(t * 4) % (msg.length + 5))
  const x = Math.floor((context.cols - msg.length) / 2)
  const y = Math.floor(context.rows / 2)
  buf.text(revealed, x, y, { color: '#fff' }, buffer, context)

  // Scrolling marquee: move text across the screen
  const scrollX = ((t * 8) % (context.cols + msg.length)) - msg.length
  buf.text(msg, Math.floor(scrollX), y + 2, { color: '#0ff' }, buffer, context)
}
```

### Scene transitions
```typescript
import { smoothstep } from 'aiscii/modules/math'
import { lerpHSL } from 'aiscii/modules/color'

export function main(coord, context) {
  const t = context.time * 0.001
  const sceneDuration = 4  // seconds per scene
  const fadeTime = 1       // seconds for crossfade

  const scene = Math.floor(t / sceneDuration)
  const local = (t % sceneDuration)
  // 0→1 blend: 0 during scene body, ramps to 1 during last fadeTime seconds
  const blend = smoothstep(sceneDuration - fadeTime, sceneDuration, local)

  // Scene A and Scene B return cells; blend between them
  const a = sceneA(coord, context)
  const b = sceneB(coord, context)

  // Alternate: even scenes show A→B, odd show B→A
  const from = scene % 2 === 0 ? a : b
  const to = scene % 2 === 0 ? b : a

  return {
    char: blend < 0.5 ? from.char : to.char,
    color: lerpHSL(/* from hsl */, /* to hsl */, blend),
  }
}
```

### Stateful program with boot()
```typescript
import type { Program } from 'aiscii'

interface State { particles: Array<{ x: number; y: number; vx: number; vy: number }> }

const program: Program<State> = {
  boot(context) {
    return { particles: Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random(), vx: 0, vy: 0 })) }
  },
  pre(context, cursor, buffer, state) {
    for (let i = 0; i < buffer.length; i++) buffer[i] = { char: ' ' }
    for (const p of state.particles) {
      p.x += p.vx * 0.01
      p.y += p.vy * 0.01
    }
  }
}
```

## Output file location

Save new programs to `./programs/<name>.ts` relative to the project root.

After creating the program file, update `main.ts` to import and run it:
```typescript
import { run } from 'aiscii'
import * as program from './programs/<name>.ts'

run(program, {
  element: document.getElementById('canvas') as HTMLElement,
})
```

Then tell the user to run `bun dev` and open the URL, or refresh if the server is already running. Include a brief summary of the animation as a few bullet points describing the key visual techniques used.

## Visual quality

The characters ARE the art. Never use spaces with colored backgrounds as the primary visual — that produces ugly colored blocks. Instead:

- ALWAYS use `DENSITY.complex` (70-char ramp) as the default character set. Use the full range of characters to create texture, depth, and detail.
- `backgroundColor` should be a single flat dark color for the whole animation. The character `color` and character selection do all the visual work.
- **Every program needs a macro structure** — a geometric backbone the viewer's eye can follow. Sine interference patterns, SDF shapes, concentric rings, wave crests, radial lines, grid repetitions. Noise and fbm are detail layers, never the primary structure. Domain warping should distort a readable shape, not replace it. "fbm warped by fbm sampled through fbm" produces formless mush. Study how breathing-rings.ts uses concentric rings as its backbone with noise only for edge wobble, or how waves.ts uses three sine wave trains with fbm only for surface turbulence.
- Color should vary with the field value — use `lerp` between two hues or a `PALETTES` function so crests/peaks look different from troughs/valleys. A single flat hue with only brightness variation looks dead.
- Keep programs under 60 lines in `main()`. Complexity comes from layering simple techniques, not from sprawling code. If you're over 80 lines, simplify.

## Rules

- Do NOT start, restart, or stop the dev server yourself. Tell the user the command to run.
- Do NOT curl, fetch, or open the dev server URL to verify output.
- ALWAYS update `main.ts` to import the new program after creating it.
- Use `centered()` before any SDF math — never do SDF in raw u/v space.
- `DENSITY` strings are ordered dark→light. Index 0 = darkest, last index = brightest.
- `time` is milliseconds. Multiply by small numbers (0.0005–0.002) for readable speeds.
- For smooth animation without flicker, prefer `pre()` for clearing + `main()` for per-cell math. Only use `pre()` alone (writing buffer directly) when doing z-buffer or particle rendering.
- Keep `main()` stateless when possible — pure function over (coord, context) → cell.
- Never mutate `context` or `coord` — they are frozen/read-only.
