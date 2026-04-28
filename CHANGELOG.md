## Changelog

All notable user-facing changes to aiscii. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows [SemVer](https://semver.org/).

## [Unreleased]

## [0.2.2] - 2026-04-28

### Added
- `bunx aiscii preview <source>` subcommand that extracts one representative frame from any image, GIF or video and writes it as a PNG. Reuses the existing `decode()` pipeline so every source type (image, GIF, video) goes through one consistent tool.
- `/aiscii:convert` skill now uses `preview` for video sources instead of shelling out to ffmpeg directly.

### Fixed
- `--output program` now preserves per-cell colors via a deduplicated palette, so converted sprite programs render in source colors (or shader gradients for thermal/xray/blueprint) instead of flat white. RGB channels are quantized to multiples of 8 to keep palette size manageable for high-resolution sources.
- `--output program` no longer breaks the TypeScript parser on sources whose ASCII output contains `"` characters. String escaping now matches double-quoted-string rules instead of template-literal rules.
- GIF sources in the convert pipeline now honor per-frame delays from the source file, matching original playback speed instead of running roughly 10x slow.

### Changed
- Custom shaders in `shaders/` are now gitignored so local experiments stay local.

## [0.2.0] - 2026-04-21

Claude Code plugin release. aiscii now installs as a plugin and ships three skills: generate, convert, setup. Adds a full pipeline for turning images, GIFs or videos into ASCII programs.

### Added
- `/aiscii:convert` skill and `bunx aiscii convert` pipeline (source → rasterize → shade → output) for turning images, GIFs or videos into ready-to-run `Program<State>` files.
- `/aiscii:setup` skill that runs prerequisite checks before generate or convert.
- Plugin distribution via `/plugin marketplace add ossa-ma/aiscii` then `/plugin install aiscii@aiscii`. Auto-update is opt-in.
- `--shader` flag on `convert` for supplying custom shader files.
- `convert` auto-opens an HTML preview and auto-saves the generated program to `programs/<name>.ts` when run in an interactive terminal.
- `bunx aiscii init` runs `bun install` automatically after scaffolding, so the first run produces a working project in one step.
- New module primitives: polygon and star SDFs, `toPolar()` for polar coordinates, `lerpHSL()` for hue-correct color blending.
- Curated demo set shipped in the published package: breathing-rings, plasma, waves, donut, donuts, aurora. Default template program switched to shooting-stars.

### Changed
- Generate skill rewritten around macro structure, character-as-art visual rules and a ban on noise-on-noise patterns, to push output away from generic colored-block aesthetics.
- Skills now carry description frontmatter so Claude Code auto-invokes them when relevant.

### Fixed
- Background-aware brightness normalization in the convert shader.
- GIF disposal method 3 (restore-to-previous) now renders correctly.
- Character aspect-ratio flag respected end-to-end.
- Default column count set to a sensible value.
- Animated HTML export plays all frames instead of freezing on one.
- Silhouette character ramp for high-contrast sources.
- Star SDF sign computation for points outside the shape.
- `convert` command now awaits async completion before exiting.

## [0.1.0] - 2026-04-12

Initial public release.

### Added
- Browser-based ASCII animation runtime. Programs are per-cell shaders in TypeScript with `boot`, `pre`, `main` and `post` lifecycle hooks.
- `bunx aiscii init` scaffolds a complete project (index.html, main.ts, demo program, dev server) and wires it up for `bun dev`.
- `/aiscii:generate` skill that produces full procedural animation programs from a natural-language prompt.
- Core modules: `math` (map, clamp, lerp, oscillators, easing, `centered`, `DENSITY` ramps), `sdf` (circle, box, ring, triangle, boolean ops, smooth blending, domain repetition), `color` (rgb, hsl, IQ cosine palettes, preset palettes), `noise` (2D/3D simplex, fBm), `vec2`, `buffer`.
- Bun-native dev server with bare-specifier resolution and conditional exports support.
- Prebuilt JS bundle (`dist/`) for embedding on any site without a TypeScript toolchain.

[Unreleased]: https://github.com/ossa-ma/aiscii/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/ossa-ma/aiscii/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ossa-ma/aiscii/releases/tag/v0.1.0
