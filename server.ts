/**
 * aiscii dev server.
 * Serves static files and transpiles TypeScript on demand.
 *
 * The browser can reference .ts files directly in index.html — this server
 * intercepts those requests, strips types via Bun.Transpiler, and returns
 * plain JavaScript. Extensionless module imports (e.g. '../src/modules/math')
 * are resolved to their .ts counterpart automatically, so the ES module
 * chain works end-to-end without a build step.
 */

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
  '.ts':   'application/javascript', // served as transpiled JS
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
}

function mime(path: string): string {
  const ext = path.slice(path.lastIndexOf('.'))
  return MIME[ext] ?? 'application/octet-stream'
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url  = new URL(req.url)
    const path = url.pathname === '/' ? '/index.html' : url.pathname
    const file = await resolve(path)

    if (!file) {
      return new Response('Not found', { status: 404 })
    }

    // Transpile TypeScript files to JavaScript before serving
    if (file.endsWith('.ts')) {
      const source = await Bun.file(file).text()
      const js     = transpiler.transformSync(source)
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
