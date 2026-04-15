#!/usr/bin/env bun

import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join, basename } from 'path'

const PKG = import.meta.dir
const CWD = process.cwd()
const cmd = process.argv[2]

if (cmd === 'init') {
  init()
} else if (cmd === 'convert') {
  convert()
} else {
  console.log('Usage: aiscii <command>\n\nCommands:\n  init      Set up an aiscii project\n  convert   Convert image/GIF/video to ASCII art')
  process.exit(1)
}

function init() {
  console.log('Setting up aiscii project...\n')

  mkdirSync(join(CWD, 'programs'), { recursive: true })
  mkdirSync(join(CWD, '.claude/commands'), { recursive: true })

  const files: [string, string][] = [
    ['templates/index.html',  'index.html'],
    ['templates/main.ts',     'main.ts'],
    ['templates/plasma.ts',   'programs/plasma.ts'],
    ['server.ts',             'server.ts'],
    ['skill.md',              '.claude/commands/aiscii.md'],
  ]

  for (const [src, dest] of files) {
    const target = join(CWD, dest)
    if (existsSync(target)) {
      console.log(`  skip  ${dest}  (exists)`)
      continue
    }
    copyFileSync(join(PKG, src), target)
    console.log(`  create  ${dest}`)
  }

  // Ensure package.json exists with a dev script
  const pkgPath = join(CWD, 'package.json')
  if (!existsSync(pkgPath)) {
    const pkg = {
      name: basename(CWD),
      type: 'module',
      scripts: { dev: 'bun run server.ts' },
      dependencies: { aiscii: 'latest' },
    }
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
    console.log('  create  package.json')
  } else {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    if (!pkg.scripts?.dev) {
      pkg.scripts = { ...pkg.scripts, dev: 'bun run server.ts' }
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
      console.log('  update  package.json  (added dev script)')
    }
  }

  console.log('\nReady. Run `bun dev` to start.')
}

async function convert() {
  const args = process.argv.slice(3)

  // Parse arguments
  let source = ''
  let style = 'default'
  let cols = process.stdout.columns || 80
  let output = 'terminal'
  let noBg = false
  let bgColor: string | undefined
  let color = 'white'

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--style' && args[i + 1]) {
      style = args[++i]
    } else if (arg === '--cols' && args[i + 1]) {
      cols = parseInt(args[++i], 10)
    } else if (arg === '--output' && args[i + 1]) {
      output = args[++i]
    } else if (arg === '--no-bg') {
      noBg = true
    } else if (arg === '--bg-color' && args[i + 1]) {
      bgColor = args[++i]
      noBg = true
    } else if (arg === '--color' && args[i + 1]) {
      color = args[++i]
    } else if (!arg.startsWith('-')) {
      source = arg
    }
  }

  if (!source) {
    console.log('Usage: aiscii convert <source> [--style <name>] [--cols <n>] [--output terminal|json|html] [--no-bg] [--color <css>]')
    process.exit(1)
  }

  const { existsSync: fileExists } = await import('fs')
  if (!fileExists(source)) {
    console.error(`File not found: ${source}`)
    process.exit(1)
  }

  const { decode, normalizeFrames, rasterizeFrames, detectBgColor, applyShader, getShader, silhouetteShader, renderAnsi, playAnsi, toJSON, toHTML } = await import('./src/convert/index')

  // Auto-detect: enable bg removal for GIFs by default
  const ext = source.split('.').pop()?.toLowerCase()
  if (ext === 'gif' && !noBg) {
    noBg = true
  }

  // Decode
  console.error(`Decoding ${source}...`)
  const frames = await decode(source)
  console.error(`  ${frames.length} frame(s), ${frames[0].width}x${frames[0].height}`)

  // Normalize (for animations)
  const normalized = normalizeFrames(frames)

  // Background removal
  let bgRemoval = undefined
  if (noBg) {
    let parsedBgColor: [number, number, number] | undefined
    if (bgColor) {
      // Parse hex color
      const hex = bgColor.replace('#', '')
      parsedBgColor = [
        parseInt(hex.substring(0, 2), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(4, 6), 16),
      ]
    } else {
      // Auto-detect from first frame
      parsedBgColor = detectBgColor(normalized[0])
      console.error(`  Auto-detected bg: rgb(${parsedBgColor.join(',')})`)
    }
    bgRemoval = { enabled: true, color: parsedBgColor }
  }

  // Rasterize
  const mode = (style === 'silhouette') ? 'silhouette' as const : noBg ? 'coverage' as const : 'brightness' as const
  console.error(`  Rasterizing ${cols} cols, mode: ${mode}`)
  const cellFrames = rasterizeFrames(normalized, { cols, mode }, bgRemoval)
  console.error(`  Grid: ${cellFrames[0].cols}x${cellFrames[0].rows}`)

  // Shade
  let shader = getShader(style)
  if (!shader) {
    if (style === 'silhouette') {
      shader = silhouetteShader(color)
    } else {
      console.error(`Unknown style: ${style}. Available: default, thermal, night-vision, blueprint, xray, silhouette`)
      process.exit(1)
    }
  }

  const styledFrames = cellFrames.map(f => applyShader(f, shader!))

  // Output
  if (output === 'json') {
    process.stdout.write(toJSON(cellFrames))
  } else if (output === 'html') {
    process.stdout.write(toHTML(styledFrames[0]))
  } else {
    // Terminal
    if (styledFrames.length === 1) {
      console.log(renderAnsi(styledFrames[0]))
    } else {
      // Clear screen first
      process.stdout.write('\x1b[2J')
      await playAnsi(styledFrames)
    }
  }
}
