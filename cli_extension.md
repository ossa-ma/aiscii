# aiscii CLI Extension: Source-to-ASCII Pipeline

## Core Concept

Extend aiscii with a CLI pipeline that converts any image/video/GIF source into styled ASCII art. Deterministic by default, extensibly generative via LLM shader generation.

```
bunx aiscii convert <source> [--style <description>]
```

Distributed via bunx. Lives within aiscii as a subcommand, not a separate package.

## Architecture Principles

1. **Zero dependencies for core logic.** Luminance calculation, character mapping, aspect ratio correction, string assembly — all trivial, all owned. Only justified external deps: image decoding (binary format parsing — can't avoid), GIF/video frame extraction. Terminal size is `process.stdout.columns` — no dep needed.
2. **Immutable data flow.** Each pipeline step takes data in, returns new data out. Never mutate source pixels or intermediate buffers. Enables: inspecting any step independently, swapping steps without side effects, caching intermediates (rasterize once, apply multiple shaders), no bugs from shared mutable state.
3. **Precompute everything possible.** Char mapping via 256-entry LUT built at init. Palette arrays for color stops. No per-cell math that could be per-init math.
4. **Small API surface.** Entire public API fits on one screen. Opinionated defaults, escape hatches for power users. Start with zero convenience flags, add only when pain is proven.
5. **Render modes as separate functions, not flag soup.** Plain ASCII, colored ANSI, half-block. Each is a distinct output function, not a single function with booleans.
6. **Character ramps as data, not code.** Named string constants. Users can pass custom strings. No enums, no class hierarchies.
7. **Aspect ratio correction at resize, not render.** Halve vertical dimension during the resize step. Don't skip rows or double characters during output.

## Package Structure: No Bundle Bloat

The current aiscii runtime is zero-dep and browser-targeted. The convert pipeline needs image decoders (native bindings or WASM) and Node APIs. These must never leak into the browser bundle.

Separate entry points in `package.json`:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./convert": "./dist/convert.js",
    "./sprite": "./dist/sprite.js"
  }
}
```

- `aiscii` (`.`) — browser runtime. Zero deps. What exists today. Never imports from convert.
- `aiscii/convert` — CLI pipeline. Node-only. Image decoders, file I/O, terminal output. Only imported by the CLI entry point and by users doing conversion programmatically.
- `aiscii/sprite` — sprite drawing helpers. Zero deps, pure buffer manipulation. Importable from both browser and Node. The bridge between convert output and runtime programs.

The CLI binary (`bunx aiscii convert`) imports from `./convert`. A browser app doing `import { run } from 'aiscii'` never touches the convert deps. Same package, clean separation.

## Composition: Sprites in Live Programs

JSON output from convert gives you static frame data. But using a converted sprite in a live aiscii program — e.g. a bird flying through a procedural noise field — requires a composition primitive.

The `aiscii/sprite` entry point provides this:

```ts
import { loadSprite, drawSprite } from 'aiscii/sprite'
import type { Program } from 'aiscii'

const bird = loadSprite('./bird.json')  // pre-converted frame data

const program: Program = {
  pre(ctx, cursor, buffer) {
    // procedural background first
    drawNoiseField(buffer, ctx)

    // stamp sprite on top — handles frame timing, position
    drawSprite(buffer, bird, {
      x: 10, y: 5,
      time: ctx.time,
      cols: ctx.cols, rows: ctx.rows
    })
  }
}
```

`loadSprite` parses the JSON (reads a file in Node, accepts pre-parsed data in browser). `drawSprite` is pure buffer manipulation — writes cells into the buffer at a position, respects frame timing for animation. No deps, works everywhere.

This keeps the separation clean: `convert` produces sprite data, `sprite` consumes it at runtime. The convert pipeline is never needed at runtime.

## Pipeline Architecture

```
source → [decode] → frames → [normalize] → [rasterize] → cell data → [shader] → output
           |           |           |              |              |           |
        decode      raw pixels   consistent    per-cell       styled     terminal/
        GIF/MP4/    per frame    dimensions    brightness/    char+color  HTML/file/
        PNG/URL                  + centering   mask+color                 JSON
```

Every step is deterministic. The only optional generative part is LLM shader generation for novel style descriptions.

## Layer 1: Source Ingestion

Decode input into raw pixel frames.

Supported sources:
- Static images (PNG, JPG, WebP)
- Animated (GIF, MP4, WebM)
- Live (webcam)
- URLs (fetch then decode)

## Layer 2: Background Removal

First-class, not an afterthought. `--no-bg` flag, default ON for GIFs/sprites, OFF for photos.

Three strategies:
- **Solid color removal**: auto-detect dominant color, or user-specified via `--bg-color`
- **Alpha-aware**: respect transparency if the source has it
- **Coverage threshold**: at the cell level, not pixel level. Each cell represents a block of pixels — if less than ~15% of the block is foreground, treat the cell as empty. This prevents background pixel noise from polluting the density mapping.

Known limitation: when foreground and background share colors (white bird on white clouds), these strategies break down. Deferred — address later via LLM-assisted foreground detection or user-provided masks.

## Layer 3: Frame Normalization

Hidden but critical step for animated sources.

Animated GIFs/videos produce frames with varying bounding boxes (e.g. wings up vs wings down = different silhouette extents). Without normalization, the animation jitters.

- Compute the union bounding box across ALL frames
- Center each frame within that bounding box
- Pad consistently so every frame has the same dimensions
- This happens between decode and rasterize

## Layer 4: Rasterization

The core product. This is where quality lives or dies. 80% of visual quality comes from rasterization, not shading.

### The resolution problem

Downsampling a 600px source to 28 chars wide means each cell represents ~21x29 pixels. At that compression, single-pixel details vanish. What matters is "what percentage of this cell block is foreground" — the character choice is secondary to getting the cell grid dimensions right.

Smart defaults for target resolution:
- Auto-detect terminal size (cols x rows)
- Compute optimal grid from source aspect ratio + character cell aspect ratio (~2:1 height:width)
- Allow override via `--cols` / `--rows`

### Rasterization modes

- `brightness` — pixel luminance averaged per cell → 0-1 value. Proper luminance: `0.299r + 0.587g + 0.114b`. Default for photos.
- `silhouette` — binary foreground/background mask. For simple shape extraction.
- `edge` — edge detection, outlines only.
- `coverage` — the hybrid mode. Uses foreground pixel coverage to determine the mask (is this cell part of the subject?), then brightness of only the foreground pixels determines density. This is the most useful mode for sprites and GIFs — pure brightness averages in background pixels, pure silhouette loses shading detail. Default for GIFs/sprites.

### Cell data output

```ts
interface CellData {
  brightness: number      // 0-1 luminance from source (foreground pixels only in coverage mode)
  coverage: number        // 0-1 foreground pixel percentage in this cell
  sourceColor: [number, number, number]  // average RGB of source pixels in this cell
  x: number               // normalized grid position 0-1
  y: number               // normalized grid position 0-1
  time: number            // ms elapsed (for animation)
  frame: number           // frame index
}
```

`sourceColor` is required — without it, shaders can only work in greyscale. The "default" shader that preserves original colors needs the original colors.

## Layer 5: Shader

Maps cell data → styled output. This is deliberately thin.

A bad rasterize with a great shader still looks bad. A great rasterize with the default shader looks good. The shader is a cherry on top, not the differentiator.

### Shader contract

```ts
type ShaderFn = (cell: CellData) => { char: string; color: string }
```

### Preset shaders (ship built-in, no LLM)

- `default` — brightness → character density, source colors preserved
- `silhouette` — shape in one color on background. `--style silhouette --color white`
- `thermal` — FLIR palette mapped to brightness
- `blueprint` — white-on-blue technical drawing
- `xray` — inverted, high contrast
- `neon` — glowing edges on dark background
- `night-vision` — green phosphor
- `pencil` — sketch-like with hatching characters

Default character ramp: ASCII characters. Blocks (`░▒▓█`) available but not default — they're the lazy option and produce visually chunky output. Half-block (`▀` with fg+bg color) offered as a high-resolution mode for users who want maximum detail.

### Custom shaders (user-written code)

Users write a function matching the contract. Small, pure, easy to share.

### Generated shaders (LLM)

Natural language → shader function via constrained code generation.

LLM receives the shader contract + style description, outputs a pure function. Generated once, cached by style description hash, deterministic from then on.

Not required at launch. The preset library covers 90% of use cases.

## Layer 6: Output

- Terminal (default) — render directly via aiscii engine
- HTML — export as styled pre/div
- JSON — structured cell/frame data for programmatic consumption
- File — save as image or animated GIF
- Pipe — stream cell data to stdout for composition

JSON output covers the use case of preparing sprites for aiscii programs. Language-specific formats (TypeScript constants, Python dicts, etc.) belong in userland wrappers, not the CLI.

## LLM Access Strategy

Three tiers, coexisting:

1. **API key** — `aiscii auth` stores an Anthropic API key. Direct, user-controlled.
2. **Claude Code / Cursor integration** — when running inside an AI-powered editor, bridge the existing LLM context automatically. Zero setup for users already in these environments. This is the default path.
3. **Community shader registry** — users share generated shaders. Popular styles become presets. Reduces how often anyone needs LLM access. Not prioritized for launch but the architecture should support it.

## CLI Interface

Minimal flags. Infer what you can. Add flags only when pain is proven.

```bash
# Basic conversion
bunx aiscii convert photo.jpg
bunx aiscii convert photo.jpg --style thermal
bunx aiscii convert running.gif --style silhouette --color white

# Background removal
bunx aiscii convert sprite.gif --no-bg
bunx aiscii convert sprite.gif --no-bg --bg-color "#0000ff"

# Resolution control
bunx aiscii convert photo.jpg --cols 120

# Output formats
bunx aiscii convert photo.jpg --style thermal --output html
bunx aiscii convert running.gif --output json

# Generated styles (requires LLM access)
bunx aiscii convert photo.jpg --style "underwater bioluminescence"

# Auth
bunx aiscii auth
```

## Dependencies

Minimal. The convert pipeline has three external concerns: image decoding, GIF frame extraction, and video frame extraction. Everything else is owned.

### Image decoding: jSquash

`@jsquash/png`, `@jsquash/jpeg`, `@jsquash/webp`, `@jsquash/avif` — one ecosystem from the same author, each a separate zero-dep WASM package backed by real codec libraries (rust PNG crate, MozJPEG, libwebp, libavif). Consistent API across formats. Also provides `@jsquash/resize` for downsampling to cell grid dimensions.

Why jSquash:
- Zero system dependencies — WASM runs anywhere `bunx` runs
- Each codec is a separate package — only pull in what you need
- Backed by production codec libraries, not hand-rolled JS decoders
- Includes resize, which we need for rasterization
- ESM-native, actively maintained

### GIF frame extraction: gifuct-js

One transitive dep, pure JS. Handles GIF disposal methods correctly — raw GIF decoders give you diff patches per frame, not composited frames. `gifuct-js` does the compositing. API: `parseGIF(buffer)` → `decompressFrames()` → array of `{data: Uint8Array, delay: number, dims}`.

### Video frame extraction: Bun.spawn(ffmpeg)

Zero npm deps. ffmpeg is a system requirement for video only. No wrapper library — `Bun.spawn(["ffmpeg", "-i", input, "-f", "rawvideo", "-pix_fmt", "rgba", "-"])` gives raw RGBA. Anyone feeding MP4s into an ASCII converter already has ffmpeg installed. The CLI should detect missing ffmpeg and print a clear install message.

Video is the only source type that requires a system dependency. Images and GIFs need nothing installed.

### Dependency summary

| Source type | Package | npm deps | System deps |
|-------------|---------|----------|-------------|
| PNG | `@jsquash/png` | 0 | none |
| JPEG | `@jsquash/jpeg` | 0 | none |
| WebP | `@jsquash/webp` | 0 | none |
| AVIF | `@jsquash/avif` | 0 | none |
| Resize | `@jsquash/resize` | 0 | none |
| GIF | `gifuct-js` | 1 | none |
| Video | `Bun.spawn` | 0 | ffmpeg |
| Core logic | owned | 0 | none |

## Build Order

1. **Rasterizer** — the core. Brightness mode + coverage mode + aspect ratio correction + terminal size detection + precomputed LUT.
2. **Source decoder** — static images first, then GIF, then video.
3. **Background removal** — solid color + alpha-aware + coverage threshold.
4. **Frame normalization** — bounding box union + centering.
5. **Preset shaders** — default, silhouette, thermal. Expand from there.
6. **CLI wiring** — argument parsing, output modes (terminal, JSON, HTML).
7. **LLM shader generation** — API key auth + Claude Code bridge.
8. **Community registry** — later.

## Decisions Made

- Platform: bunx (zero-install distribution, migrate hot paths to native later if needed)
- Home: stays within aiscii as a subcommand
- LLM access: API key + Claude Code/Cursor bridge + community registry (registry deprioritized)
- Generative scope at launch: minimal. Presets first, LLM generation as opt-in
- CellData includes sourceColor — shaders need color, not just brightness
- Coverage mode is hybrid (mask + foreground-only brightness), not binary
- JSON as structured output format, not language-specific formats
- No convenience flags at launch (no --flip, etc.) — add when proven needed
- Default char ramp is ASCII, not blocks. Half-block as high-res option
- Immutable data flow throughout pipeline
- Foreground/background color edge cases deferred, not over-engineered at launch
- Separate entry points (`.`, `./convert`, `./sprite`) to prevent convert deps bloating browser bundle
- `aiscii/sprite` as the zero-dep bridge between convert output and runtime programs
- Terminal size via `process.stdout.columns` — no dependency needed
- Image decoding via jSquash (zero-dep WASM, all formats, includes resize)
- GIF via gifuct-js (1 transitive dep, handles frame compositing)
- Video via raw Bun.spawn(ffmpeg) — no wrapper lib, ffmpeg is the only system dep (video only)
