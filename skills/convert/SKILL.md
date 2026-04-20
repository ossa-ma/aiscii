---
description: Convert an image, GIF, or video file into an ASCII art animation program. Use when the user wants to turn existing media into ASCII — e.g. "convert this GIF to ASCII", "make an ASCII sprite from this PNG", "turn this video into an ASCII animation".
---

Convert a source image, GIF, or video into an ASCII art program using the aiscii CLI.

## Prerequisites

Before doing anything else, verify the environment:
- `package.json` exists in the current directory
- `node_modules/aiscii/` exists

If either is missing, stop and tell the user: "Your aiscii project isn't set up yet. Run `/aiscii:setup` first."

You are the intelligence layer. The CLI is deterministic — it executes exactly what flags it receives. Your job is to analyze the source, make the decisions a human art director would make, pick the right flags, and iterate until the output looks good.

## CLI invocation

Inside the aiscii repo (contributor context):
```bash
bun cli.ts convert <source> [flags]
```

Installed as a package:
```bash
bunx aiscii convert <source> [flags]
```

Detect which applies: if `cli.ts` exists in the current directory, use `bun cli.ts`. Otherwise use `bunx aiscii`.

## Flags

- `--cols <n>` — output width in characters
- `--style <name>` — preset shader: `default`, `thermal`, `night-vision`, `blueprint`, `xray`, `silhouette`
- `--shader <path>` — custom shader file (TypeScript, exports `shader` function)
- `--no-bg` — remove background (auto-detect color from image corners)
- `--bg-color <hex>` — explicit background color to remove, e.g. `#0000ff`. Implies `--no-bg`.
- `--color <css>` — foreground color for silhouette style
- `--output <format>` — `terminal` (default), `html`, `json`, `program`

## Step 1: View the source

Read or view the source file before doing anything. You need to understand:
- What is the subject? (person, animal, object, scene)
- What is the background? (solid color, gradient, complex/outdoor, transparent)
- Is it a GIF or video? (animated) or a still image?
- What is the intended use? (sprite in an aiscii program, full-screen art, terminal output)

## Step 2: Decide the flags

### Background removal

| Background type | Decision |
|---|---|
| Solid uniform color (studio, greenscreen) | `--no-bg` (auto-detect works) |
| Known solid color | `--bg-color <hex>` (more reliable than auto-detect) |
| GIF with any background | Always use `--no-bg` or `--bg-color` — GIFs almost never have transparency |
| PNG with transparency | No flag needed — transparency is preserved |
| Complex (outdoor, gradient, cluttered) | Hard. Try `--bg-color` with the dominant background color. Warn the user the result may be noisy. |

Auto-detect (`--no-bg` without `--bg-color`) samples 8 corner/edge points and picks the median. It works well for clean studio shots. It fails for outdoor scenes or images where the subject is near the edges.

### Cols

| Intended use | Cols |
|---|---|
| Sprite for an aiscii program (embedded in browser) | 28–40 |
| Full-screen background in an aiscii program | 60–80 |
| Terminal preview (evaluating output) | omit — uses terminal width |
| HTML standalone art | 80–120 |

Smaller cols = blockier, faster to evaluate. Start lower (28–40) for sprites and scale up if detail is lost.

### Style

| Source / desired look | Style |
|---|---|
| Subject on removed background (sprite) | `silhouette` — clean shape, one color |
| Photograph, scene, portrait | `default` — preserves source colors |
| Styled/artistic output | `thermal`, `xray`, `night-vision`, `blueprint` |
| Custom look described by user | Write a `--shader` file (see below) |

### Custom shaders

When the user describes a visual style not covered by a preset ("underwater bioluminescence", "old CRT", "neon outlines"), write a shader file at `./shaders/<name>.ts`:

```typescript
import type { CellData, StyledCell } from 'aiscii/convert'

/**
 * CellData:
 *   brightness: number      — 0-1 luminance
 *   coverage: number        — 0-1 foreground pixel ratio in cell
 *   sourceColor: [r, g, b]  — average RGB [0-255] of source pixels
 *   x: number               — normalized position 0-1
 *   y: number               — normalized position 0-1
 */
export function shader(cell: CellData): StyledCell {
  if (cell.brightness < 0.02) return { char: ' ', color: 'transparent' }
  // map brightness/coverage to char and color
  return { char: '·', color: 'white' }
}
```

Then pass it: `--shader ./shaders/<name>.ts`

## Step 3: Preview

Always start with `--output html` and open the result:

```bash
bun cli.ts convert <source> [flags] --output html > preview.html && open preview.html
```

Evaluate the HTML output. Ask yourself:
- Is the subject cleanly extracted from the background?
- Are the edges crisp or noisy?
- Is the character density appropriate — too sparse (big empty areas), too dense (everything at max)?
- Is the subject at a readable size?

## Step 4: Iterate

Common problems and fixes:

| Problem | Fix |
|---|---|
| Background still showing | Switch from `--no-bg` to explicit `--bg-color` with the exact hex |
| Subject too small / blocky | Increase `--cols` |
| Subject detail lost | Increase `--cols` |
| Too dense, everything is `@` or `#` | Try `--style silhouette` or a lower `--cols` |
| Wrong colors | Switch from `default` to `silhouette --color <css>`, or write a custom shader |
| Noisy edges on complex background | Warn the user — this source needs masking before conversion |

Rerun with adjusted flags and re-open the preview until satisfied.

## Step 5: Final output

When the preview looks good, produce the final format based on intended use:

**For embedding in an aiscii program (most common):**
```bash
bun cli.ts convert <source> [flags] --output program > programs/<name>.ts
```
This generates a complete `Program<State>` TypeScript file with the frames embedded. Import and run it with `run()`.

**For standalone HTML:**
```bash
bun cli.ts convert <source> [flags] --output html > gallery/<name>.html
```

**For programmatic use / sprite data:**
```bash
bun cli.ts convert <source> [flags] --output json > data/<name>.json
```

## Rules

- Always view the source before picking flags. Never guess the background color.
- Always preview with `--output html` before producing the final output.
- For GIFs: always use `--no-bg` or `--bg-color`. Never skip background removal for GIFs.
- For complex backgrounds: tell the user why auto-removal may fail and what they can do (mask the source, use a cleaner version, or accept noisy edges).
- Do not add flags that aren't needed. A PNG with transparency needs no `--no-bg`. A solid black background doesn't need a custom shader.
- The `--cols` you choose for preview doesn't have to match the final. Use a comfortable preview size, then produce final at the target cols.
