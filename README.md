# aiscii

A browser-based ASCII animation runtime. Programs are per-cell shaders written in TypeScript — each cell on screen gets a character, color, and background color every frame. Ships with a Claude Code plugin with two skills: generate procedural animations from natural language, or convert any image, GIF, or video into an ASCII program.

LLMs are good at writing code. ASCII animation is code. This is cheaper and faster than generating images or video.

## Demos

[View all demos](https://ossama.is/aiscii) — live animations with code/preview toggle.

## Quickstart

```bash
bun add aiscii
bunx aiscii init
bun dev
```

This scaffolds a working project with a demo program and dev server. Open `http://localhost:3000` to see it running.

## Claude Code plugin

aiscii ships as a Claude Code plugin with three skills. Install it once (persists across sessions):

```
/plugin marketplace add ossa-ma/aiscii
/plugin install aiscii@aiscii
/reload-plugins
```

To opt in to auto-updates: `/plugin` → Marketplaces → `aiscii` → Enable auto-update.

For local development of the plugin itself, you can instead activate it ephemerally from `node_modules`:
```bash
claude --plugin-dir ./node_modules/aiscii
```

After `bunx aiscii init`:

**Generate procedural animations:**
```
/aiscii:generate a tunnel zoom effect like flying through a wormhole, neon palette
```
The skill generates a program file, updates `main.ts`, and tells you to refresh. Every program in the demos table above was generated this way.

**Convert images, GIFs, or video to ASCII:**
```
/aiscii:convert bird.gif — make it white on black, use as a sprite
```
Claude analyzes the source, picks the right flags (background removal, cols, style), runs the CLI, previews the result, and iterates until it looks good. Produces a ready-to-use `Program<State>` file.

## How it works

Programs export lifecycle functions. The runtime calls them every frame:

```
boot() → initial state
  ↓
per frame:
  pre(context, cursor, buffer, state)     — setup / clear
  main(coord, context, cursor, buffer, state)  — called per cell
  post(context, cursor, buffer, state)    — overlays
```

A minimal program only needs `main`:

```typescript
import { centered, DENSITY, map } from 'aiscii/modules/math'
import { PALETTES } from 'aiscii/modules/color'

export const settings = { fps: 60, backgroundColor: '#000' }

export function main(coord, context) {
  const { x, y } = centered(coord, context)
  const t = context.time * 0.001
  const v = Math.sin(x * 3 + t) + Math.cos(y * 2 - t * 0.7)

  const d = DENSITY.complex
  const i = Math.floor(map(v, -2, 2, 0, d.length - 1))
  const char = d[Math.max(0, Math.min(d.length - 1, i))] ?? ' '

  return { char, color: '#fff', backgroundColor: PALETTES.neon(v * 0.25 + t * 0.1) }
}
```

## Modules

| Module | What it does |
|--------|-------------|
| `aiscii/modules/math` | map, clamp, lerp, oscillators, easing, `centered()` for aspect-corrected coords, `toPolar()` for polar coordinates, `DENSITY` character ramps |
| `aiscii/modules/sdf` | Signed distance functions — circle, box, ring, triangle, polygon, star, boolean ops, smooth blending, domain repetition |
| `aiscii/modules/color` | `rgb`, `hsl`, `lerpHSL`, IQ cosine palettes, preset palettes (rainbow, cool, warm, neon, mono) |
| `aiscii/modules/noise` | 2D/3D simplex noise, fractional Brownian motion |
| `aiscii/modules/vec2` | 2D vector math |
| `aiscii/modules/buffer` | Safe read/write operations on the cell buffer |

## Use on your site

Install aiscii in your project:

```bash
npm install aiscii
```

Copy your program file into your project, then mount it:

```typescript
import { run } from 'aiscii'
import * as program from './programs/my-animation.ts'

run(program, {
  element: document.getElementById('my-element'),
})
```

Works with any bundler (Vite, webpack, Next.js, Astro). The package ships compiled JS — no TypeScript config needed.

For a quick embed without a bundler:

```html
<pre id="aiscii" style="width:100%;height:400px;background:#000;font-family:monospace;font-size:13px;line-height:1.2em"></pre>
<script type="module">
  import { run } from 'https://unpkg.com/aiscii/dist/index.js'
  // paste your program's main() here or import a hosted program file
</script>
```

## Limitations

aiscii works best with abstract, procedural animation — things that can be expressed as math: wave patterns, noise fields, geometric shapes, particle effects.

For representational animation (recognizable figures, choreographed sequences), use `/aiscii:convert` with a GIF or video source rather than trying to generate it procedurally. Install the plugin first with `/plugin marketplace add ossa-ma/aiscii` then `/plugin install aiscii@aiscii`.

## Acknowledgements

aiscii's runtime architecture was inspired by [play.core](https://github.com/ertdfgcvb/play.core) by Andreas Gysin. Check it out!

## License

[PolyForm Shield 1.0.0](LICENSE) — free to use, modify, and distribute. You may not use it to build a competing product.
