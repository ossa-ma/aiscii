#!/usr/bin/env bun

import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const PKG = import.meta.dir
const CWD = process.cwd()
const cmd = process.argv[2]

if (cmd === 'init') {
  init()
} else {
  console.log('Usage: aiscii init')
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

  // Add dev script to package.json
  const pkgPath = join(CWD, 'package.json')
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    if (!pkg.scripts?.dev) {
      pkg.scripts = { ...pkg.scripts, dev: 'bun run server.ts' }
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
      console.log('  update  package.json  (added dev script)')
    }
  }

  console.log('\nReady. Run `bun dev` to start.')
}
