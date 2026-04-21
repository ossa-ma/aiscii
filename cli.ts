#!/usr/bin/env bun

import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join, basename } from 'path'
import { spawnSync } from 'child_process'

const PKG = import.meta.dir
const CWD = process.cwd()
const cmd = process.argv[2]

if (cmd === 'init') {
  init()
} else if (cmd === 'convert') {
  await convert()
} else {
  console.log('Usage: aiscii <command>\n\nCommands:\n  init      Set up an aiscii project\n  convert   Convert image/GIF/video to ASCII art')
  process.exit(1)
}

function init() {
  console.log('Setting up aiscii project...\n')

  mkdirSync(join(CWD, 'programs'), { recursive: true })

  const files: [string, string][] = [
    ['templates/index.html',  'index.html'],
    ['templates/main.ts',     'main.ts'],
    ['templates/plasma.ts',   'programs/plasma.ts'],
    ['server.ts',             'server.ts'],
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

  console.log('\nInstalling dependencies...')
  spawnSync('bun', ['install'], { stdio: 'inherit', cwd: CWD })

  console.log('\nReady. Run `bun dev` to start.')
  console.log('\nClaude Code plugin: activate with')
  console.log('  claude --plugin-dir ./node_modules/aiscii')
  console.log('Then use /aiscii:generate and /aiscii:convert in your Claude session.')
}

async function convert() {
  const args = process.argv.slice(3)

  // Parse arguments
  let source = ''
  let style = 'default'
  let colsOverride: number | undefined
  let output = 'terminal'
  let noBg = false
  let bgColor: string | undefined
  let color = 'white'
  let shaderPath: string | undefined
  let charAspect: number | undefined

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--style' && args[i + 1]) {
      style = args[++i]
    } else if (arg === '--shader' && args[i + 1]) {
      shaderPath = args[++i]
    } else if (arg === '--cols' && args[i + 1]) {
      colsOverride = parseInt(args[++i], 10)
    } else if (arg === '--output' && args[i + 1]) {
      output = args[++i]
    } else if (arg === '--no-bg') {
      noBg = true
    } else if (arg === '--bg-color' && args[i + 1]) {
      bgColor = args[++i]
      noBg = true
    } else if (arg === '--color' && args[i + 1]) {
      color = args[++i]
    } else if (arg === '--char-aspect' && args[i + 1]) {
      charAspect = parseFloat(args[++i])
    } else if (!arg.startsWith('-')) {
      source = arg
    }
  }

  // Default cols: terminal width for terminal output, 80 for file outputs
  const cols = colsOverride ?? (output === 'terminal' ? (process.stdout.columns || 80) : 80)

  if (!source) {
    console.log('Usage: aiscii convert <source> [--style <name>] [--cols <n>] [--output terminal|json|html] [--no-bg] [--color <css>]')
    process.exit(1)
  }

  const { existsSync: fileExists } = await import('fs')
  if (!fileExists(source)) {
    console.error(`File not found: ${source}`)
    process.exit(1)
  }

  const { decode, normalizeFrames, rasterizeFrames, detectBgColor, applyShader, getShader, silhouetteShader, renderAnsi, playAnsi, toJSON, toHTML, toProgram } = await import('./src/convert/index')

  // Auto-detect: enable bg removal for GIFs by default
  const ext = source.split('.').pop()?.toLowerCase()
  if (ext === 'gif' && !noBg) {
    noBg = true
  }

  // Decode
  console.error(`Decoding ${source}...`)
  const frames = await decode(source)
  console.error(`  ${frames.length} frame(s), ${frames[0].width}x${frames[0].height}`)

  // Background detection (must happen before normalization so bounds are content-aware)
  let parsedBgColor: [number, number, number] | undefined
  let bgRemoval = undefined
  if (noBg) {
    if (bgColor) {
      const hex = bgColor.replace('#', '')
      parsedBgColor = [
        parseInt(hex.substring(0, 2), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(4, 6), 16),
      ]
    } else {
      parsedBgColor = detectBgColor(frames[0])
      console.error(`  Auto-detected bg: rgb(${parsedBgColor.join(',')})`)
    }
    bgRemoval = { enabled: true, color: parsedBgColor }
  }

  // Normalize (crop to content bounds, consistent dimensions across frames)
  const normalized = normalizeFrames(frames, 2, parsedBgColor)

  // Rasterize
  const mode = (style === 'silhouette' || noBg) ? 'coverage' as const : 'brightness' as const
  console.error(`  Rasterizing ${cols} cols, mode: ${mode}`)
  const cellFrames = rasterizeFrames(normalized, { cols, mode, ...(charAspect ? { charAspect } : {}) }, bgRemoval)
  console.error(`  Grid: ${cellFrames[0].cols}x${cellFrames[0].rows}`)

  // Shade
  let shader
  if (shaderPath) {
    // Load custom shader from file
    const { resolve } = await import('path')
    const absPath = resolve(process.cwd(), shaderPath)
    if (!fileExists(absPath)) {
      console.error(`Shader file not found: ${shaderPath}`)
      process.exit(1)
    }
    const mod = await import(absPath)
    shader = mod.shader ?? mod.default
    if (typeof shader !== 'function') {
      console.error(`Shader file must export a 'shader' or 'default' function: (cell: CellData) => { char, color }`)
      process.exit(1)
    }
    console.error(`  Using custom shader: ${shaderPath}`)
  } else {
    shader = getShader(style)
    if (!shader) {
      if (style === 'silhouette') {
        shader = silhouetteShader(color)
      } else {
        console.error(`Unknown style: ${style}. Available: default, thermal, night-vision, blueprint, xray, silhouette`)
        console.error(`Or use --shader ./path.ts to load a custom shader function.`)
        process.exit(1)
      }
    }
  }

  const styledFrames = cellFrames.map(f => applyShader(f, shader!))

  // Output
  if (output === 'json') {
    process.stdout.write(toJSON(cellFrames))
  } else if (output === 'html') {
    process.stdout.write(toHTML(styledFrames))
  } else if (output === 'program') {
    const name = basename(source).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_') + 'Program'
    process.stdout.write(toProgram(styledFrames, { name }))
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
