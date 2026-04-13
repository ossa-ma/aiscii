/**
 * aiscii runtime.
 * Manages the animation loop, cell buffer, lifecycle dispatch, and resize handling.
 *
 * Usage:
 *   import { run } from 'aiscii'
 *   import * as myProgram from './programs/plasma'
 *   run(myProgram, { element: document.querySelector('#hero') })
 */

import { calcMetrics, createTextRenderer } from './renderer'
import type { Cell, Context, Coord, Cursor, Metrics, Program, RunSettings } from './types'

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: Required<Omit<RunSettings, 'element'>> = {
  cols: 0,
  rows: 0,
  fps: 30,
  once: false,
  backgroundColor: '#000000',
  color: '#ffffff',
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '14px',
  fontWeight: '400',
  letterSpacing: '0',
  lineHeight: '1.2em',
}

// CSS properties forwarded from settings to the container element
const CSS_PROPS = [
  'backgroundColor', 'color', 'fontFamily', 'fontSize',
  'fontWeight', 'letterSpacing', 'lineHeight',
] as const

// ---------------------------------------------------------------------------
// run()
// ---------------------------------------------------------------------------

/**
 * Start an aiscii program.
 *
 * @param program     - The program module (exports main, pre, post, boot, settings)
 * @param runSettings - Optional settings overrides
 * @param userData    - Optional arbitrary data passed through to all lifecycle functions
 * @returns           - Promise that resolves with the context after the first frame
 */
export function run<S = void>(
  program: Program<S>,
  runSettings?: Partial<RunSettings>,
  userData: unknown = {}
): Promise<Context> {
  return new Promise((resolve) => {

    // Merge settings: defaults → runSettings → program.settings
    const settings: Required<Omit<RunSettings, 'element'>> & { element: HTMLElement } = {
      ...DEFAULT_SETTINGS,
      ...runSettings,
      ...program.settings,
      element: null as unknown as HTMLElement, // resolved below
    }

    // Create or adopt the target element
    if (runSettings?.element) {
      settings.element = runSettings.element
    } else if (program.settings?.element) {
      settings.element = program.settings.element
    } else {
      const el = document.createElement('pre')
      document.body.appendChild(el)
      settings.element = el
    }

    const el = settings.element

    // Apply CSS to the container
    for (const prop of CSS_PROPS) {
      if (settings[prop]) (el.style as unknown as Record<string, string>)[prop] = settings[prop]
    }
    el.style.fontStretch = 'normal'
    el.style.userSelect = 'none'
    el.style.webkitUserSelect = 'none'
    el.style.margin = '0'
    el.style.padding = '0'
    el.style.overflow = 'hidden'

    // ---------------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------------

    const frameState = { frame: 0, time: 0 }
    let metrics: Metrics
    let programState: S
    let currentCols = 0
    let currentRows = 0

    // The cell buffer — flat array, indexed as x + y * cols
    const buffer: Cell[] = []

    // Default cell used to initialise and reset the buffer
    function makeDefaultCell(): Cell {
      return {
        char: ' ',
        color: settings.color,
        backgroundColor: settings.backgroundColor,
        fontWeight: settings.fontWeight,
      }
    }

    // ---------------------------------------------------------------------------
    // Pointer tracking (in pixel space, converted to grid-space in the loop)
    // ---------------------------------------------------------------------------

    const pointer = { x: 0, y: 0, pressed: false, px: 0, py: 0, ppressed: false }

    el.addEventListener('pointermove', (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
    })
    el.addEventListener('pointerdown', () => { pointer.pressed = true })
    el.addEventListener('pointerup',   () => { pointer.pressed = false })

    // ---------------------------------------------------------------------------
    // Renderer
    // ---------------------------------------------------------------------------

    const renderer = createTextRenderer()

    // ---------------------------------------------------------------------------
    // Context builder — called every frame to produce a fresh frozen snapshot
    // ---------------------------------------------------------------------------

    function buildContext(): Context {
      const rect = el.getBoundingClientRect()
      // cols/rows from settings (fixed) or auto-computed from container + cell size
      const cols = settings.cols || Math.max(1, Math.floor(rect.width  / metrics.cellWidth))
      const rows = settings.rows || Math.max(1, Math.floor(rect.height / metrics.lineHeight))
      return Object.freeze({
        frame:   frameState.frame,
        time:    frameState.time,
        cols,
        rows,
        metrics: Object.freeze({ ...metrics }),
      })
    }

    // ---------------------------------------------------------------------------
    // Boot — runs once after fonts are ready
    // ---------------------------------------------------------------------------

    async function boot(): Promise<void> {
      metrics = calcMetrics(el)
      const context = buildContext()
      if (typeof program.boot === 'function') {
        // boot() optionally returns initial state; supports async (e.g. image loading)
        const result = program.boot(context, buffer, userData)
        programState = (result instanceof Promise ? await result : result) as S
      }
      requestAnimationFrame(loop)
    }

    // ---------------------------------------------------------------------------
    // Animation loop
    // ---------------------------------------------------------------------------

    let timeSample = 0
    const interval = 1000 / settings.fps
    let firstFrameResolved = false

    function loop(t: number): void {
      // FPS cap: skip frames that arrive too early
      const delta = t - timeSample
      if (delta < interval) {
        if (!settings.once) requestAnimationFrame(loop)
        return
      }
      // Align the time sample to avoid drift accumulation
      timeSample = t - (delta % interval)

      frameState.time  = t
      frameState.frame += 1

      const context = buildContext()
      const { cols, rows } = context

      // On resize: rebuild the buffer and invalidate the renderer's back-buffer
      if (cols !== currentCols || rows !== currentRows) {
        currentCols = cols
        currentRows = rows
        buffer.length = cols * rows
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = makeDefaultCell()
        }
        renderer.invalidate()
      }

      // Build the cursor in grid-space
      const cursor: Cursor = {
        x:       Math.min(cols - 1, pointer.x / metrics.cellWidth),
        y:       Math.min(rows - 1, pointer.y / metrics.lineHeight),
        pressed: pointer.pressed,
        prev: {
          x:       pointer.px / metrics.cellWidth,
          y:       pointer.py / metrics.lineHeight,
          pressed: pointer.ppressed,
        },
      }

      // 1. pre() — whole-buffer setup
      program.pre?.(context, cursor, buffer, programState)

      // 2. main() — per-cell
      if (typeof program.main === 'function') {
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            const index = i + j * cols

            // u/v: normalised 0→1 screen coords (not aspect-corrected)
            // Use centered() from modules/math for aspect-corrected SDF work
            const u = cols > 1 ? i / (cols - 1) : 0
            const v = rows > 1 ? j / (rows - 1) : 0
            const coord: Coord = { x: i, y: j, index, u, v }

            const out = program.main(coord, context, cursor, buffer, programState)

            if (out === null || out === undefined) continue

            if (typeof out === 'string') {
              buffer[index] = { ...(buffer[index] ?? makeDefaultCell()), char: out || ' ' }
            } else {
              buffer[index] = {
                ...(buffer[index] ?? makeDefaultCell()),
                ...out,
                char: out.char || ' ',
              }
            }
          }
        }
      }

      // 3. post() — overlays
      program.post?.(context, cursor, buffer, programState)

      // 4. Render to DOM
      renderer.render(el, context, buffer, settings)

      // 5. Snapshot pointer state for next frame's cursor.prev
      pointer.px       = pointer.x
      pointer.py       = pointer.y
      pointer.ppressed = pointer.pressed

      // Resolve the promise on the first successful frame
      if (!firstFrameResolved) {
        firstFrameResolved = true
        resolve(context)
      }

      if (!settings.once) requestAnimationFrame(loop)
    }

    // ---------------------------------------------------------------------------
    // Font load guard
    // Safari has a known bug where fonts aren't measurable immediately after
    // fonts.ready fires. Running 3 rAF cycles first reliably works around it.
    // See: https://bugs.webkit.org/show_bug.cgi?id=217047
    // ---------------------------------------------------------------------------

    document.fonts.ready.then(() => {
      let count = 3
      ;(function waitFrames() {
        if (--count > 0) requestAnimationFrame(waitFrames)
        else boot()
      })()
    })
  })
}
