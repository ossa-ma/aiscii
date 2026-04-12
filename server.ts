/**
 * aiscii dev server.
 * Serves static files and transpiles TypeScript on demand.
 *
 * The browser can reference .ts files directly in index.html — this server
 * intercepts those requests, strips types via Bun.Transpiler, and returns
 * plain JavaScript. Extensionless module imports (e.g. '../src/modules/math')
 * are resolved to their .ts counterpart automatically, so the ES module
 * chain works end-to-end without a build step.
 *
 * Bare specifiers from installed packages (e.g. 'aiscii', 'aiscii/modules/sdf')
 * are rewritten to their resolved file paths using each package's exports map,
 * so the browser can follow the import chain without a bundler.
 */

import { readFileSync } from 'fs'

const ROOT = import.meta.dir

function findPort(start: number): number {
  for (let port = start; port < start + 20; port++) {
    try {
      const s = Bun.serve({ port, fetch: () => new Response() })
      s.stop()
      return port
    } catch {}
  }
  throw new Error('No free port found')
}

const PORT = +(process.env.PORT ?? findPort(3000))

const transpiler = new Bun.Transpiler({ loader: 'ts' })

// ---------------------------------------------------------------------------
// Bare specifier resolution
// ---------------------------------------------------------------------------

// Cache parsed package.json files to avoid repeated disk reads
const pkgCache = new Map<string, Record<string, unknown>>()

function readPkg(pkgName: string): Record<string, unknown> | null {
  if (pkgCache.has(pkgName)) return pkgCache.get(pkgName)!
  try {
    const raw = JSON.parse(readFileSync(`${ROOT}/node_modules/${pkgName}/package.json`, 'utf-8'))
    pkgCache.set(pkgName, raw)
    return raw
  } catch {
    return null
  }
}

/**
 * Resolve a bare module specifier to a URL path the browser can request.
 * Uses the package's `exports` field in package.json.
 * Returns null if the specifier cannot be resolved (e.g. relative paths).
 *
 * Examples:
 *   'aiscii'              → '/node_modules/aiscii/src/index.ts'
 *   'aiscii/modules/sdf'  → '/node_modules/aiscii/src/modules/sdf.ts'
 */
function resolveSpecifier(specifier: string): string | null {
  // Skip relative and absolute paths — already valid browser URLs
  if (specifier.startsWith('.') || specifier.startsWith('/')) return null

  // Split into package name + subpath
  const isScoped = specifier.startsWith('@')
  const parts    = specifier.split('/')
  const pkgName  = isScoped ? `${parts[0]}/${parts[1]}` : parts[0]!
  const subparts = isScoped ? parts.slice(2) : parts.slice(1)
  const subpath  = subparts.length > 0 ? `./${subparts.join('/')}` : '.'

  const pkg = readPkg(pkgName)
  if (!pkg) return null

  const exports = pkg['exports'] as Record<string, string> | undefined
  if (!exports) return null

  // Normalize a relative path like './src/index.ts' to 'src/index.ts'
  const norm = (p: string) => p.replace(/^\.\//, '')

  // Direct match (e.g. '.' or './modules/math')
  const direct = exports[subpath]
  if (typeof direct === 'string') {
    return `/node_modules/${pkgName}/${norm(direct)}`
  }

  // Glob match (e.g. './modules/*' matching './modules/sdf')
  for (const [pattern, target] of Object.entries(exports)) {
    if (!pattern.includes('*')) continue
    const regex = new RegExp(`^${pattern.replace('*', '(.*)')}$`)
    const match = subpath.match(regex)
    if (match?.[1] && typeof target === 'string') {
      return `/node_modules/${pkgName}/${norm(target.replace('*', match[1]))}`
    }
  }

  return null
}

/**
 * Rewrite bare specifiers in transpiled JS to file paths the browser can fetch.
 * Handles: import/export from '...', import('...')
 */
function rewriteSpecifiers(js: string): string {
  return js.replace(
    /(from\s+['"]|import\s*\(\s*['"]|import\s+['"])([^'"]+)(['"]\s*\)?)/g,
    (_match, prefix, specifier, suffix) => {
      const resolved = resolveSpecifier(specifier)
      return resolved ? `${prefix}${resolved}${suffix}` : `${prefix}${specifier}${suffix}`
    }
  )
}

// ---------------------------------------------------------------------------
// File resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a URL pathname to a file path, handling:
 *   - exact matches
 *   - extensionless imports → .ts
 *   - directory index → index.ts
 */
async function resolve(pathname: string): Promise<string | null> {
  const base = ROOT + pathname
  for (const candidate of [base, base + '.ts', base + '/index.ts']) {
    if (await Bun.file(candidate).exists()) return candidate
  }
  return null
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.ts':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
}

function mime(path: string): string {
  const ext = path.slice(path.lastIndexOf('.'))
  return MIME[ext] ?? 'application/octet-stream'
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url  = new URL(req.url)
    const path = url.pathname === '/' ? '/index.html' : url.pathname
    const file = await resolve(path)

    if (!file) return new Response('Not found', { status: 404 })

    // Transpile TypeScript and rewrite bare specifiers before serving
    if (file.endsWith('.ts')) {
      const source = await Bun.file(file).text()
      const js     = rewriteSpecifiers(transpiler.transformSync(source))
      return new Response(js, {
        headers: { 'Content-Type': 'application/javascript' }
      })
    }

    return new Response(Bun.file(file), {
      headers: { 'Content-Type': mime(file) }
    })
  },
})

console.log(`aiscii dev server → http://localhost:${server.port}`)
