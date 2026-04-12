/**
 * Core type definitions for aiscii.
 * These form the contract between the runtime and every program written against it.
 */

// ---------------------------------------------------------------------------
// Cell
// ---------------------------------------------------------------------------

/**
 * A single character cell in the output grid.
 * Every position in the buffer holds one Cell.
 * Only `char` is required — color fields fall back to the container's CSS.
 */
export interface Cell {
  char: string
  color?: string            // CSS color string, e.g. 'white', '#ff0000', 'hsl(200,80%,50%)'
  backgroundColor?: string  // CSS color string
  fontWeight?: string       // CSS font-weight, e.g. '400', '700', 'bold'
}

// ---------------------------------------------------------------------------
// Coord
// ---------------------------------------------------------------------------

/**
 * Passed to main() for every cell on every frame.
 *
 * Grid coords (x, y):
 *   Integer position in the character grid. x goes left→right, y goes top→down.
 *   Use these when you want to reason about character positions directly.
 *
 * Normalized coords (u, v):
 *   Floating point 0→1 range. u=0 is left, u=1 is right, v=0 is top, v=1 is bottom.
 *   Use these for patterns that should scale with the container — gradients,
 *   tiling, anything you want to be resolution-independent.
 *
 * NOTE: u/v are NOT aspect-corrected. For SDF math where circles should look
 * circular, use the centered() helper from modules/math which applies the
 * aspect correction automatically.
 */
export interface Coord {
  x: number      // grid column, integer, range [0, cols-1]
  y: number      // grid row, integer, range [0, rows-1]
  index: number  // flat buffer index: x + y * cols
  u: number      // x / (cols - 1), range [0, 1]
  v: number      // y / (rows - 1), range [0, 1]
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/**
 * Measured dimensions of a single character cell.
 * Calculated at boot by rendering a span and measuring it — not hardcoded.
 * Remeasured on font or container size changes.
 */
export interface Metrics {
  cellWidth: number   // rendered width of one character in px
  lineHeight: number  // rendered height of one character in px
  aspect: number      // cellWidth / lineHeight, typically ~0.45–0.55 for monospace
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Read-only snapshot of runtime state passed to every lifecycle function.
 * Frozen each frame — do not attempt to mutate it.
 */
export interface Context {
  readonly frame: number    // frame counter, starts at 1
  readonly time: number     // elapsed time in milliseconds since start
  readonly cols: number     // current grid width in characters
  readonly rows: number     // current grid height in characters
  readonly metrics: Metrics // measured cell dimensions
}

// ---------------------------------------------------------------------------
// Cursor
// ---------------------------------------------------------------------------

/**
 * Pointer state in grid-space coordinates (not pixels).
 * x/y are floats — a cursor between two cells is valid.
 */
export interface Cursor {
  x: number        // column, float
  y: number        // row, float
  pressed: boolean // pointer/mouse is currently down
  prev: {
    x: number
    y: number
    pressed: boolean // state from the previous frame
  }
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

/**
 * The interface every aiscii program conforms to.
 *
 * Lifecycle order each frame:
 *   1. pre()   — whole-buffer setup: clear, draw backgrounds, reset state
 *   2. main()  — called once per cell, return a Cell or char string
 *   3. post()  — whole-buffer overlay: UI, debug info, compositing
 *
 * boot() runs once before the first frame. Its return value becomes `state`,
 * which is threaded through every subsequent lifecycle call. Programs with
 * no persistent state can omit boot() and leave S as void.
 *
 * Generic parameter S is the shape of the program's state object.
 */
export interface Program<S = void> {
  /** Optional settings overrides applied on top of run() settings */
  settings?: Partial<RunSettings>

  /**
   * Called once before the first frame.
   * Return an object to use as persistent state across frames.
   * Omit if your program is stateless (pure math over coord/context).
   */
  boot?(context: Context, buffer: Cell[], userData: unknown): S

  /**
   * Called once per frame before main().
   * Use to clear the buffer, set a background, or initialise per-frame data.
   */
  pre?(context: Context, cursor: Cursor, buffer: Cell[], state: S): void

  /**
   * Called once per cell per frame.
   * Return a Cell object to set char + style, or a plain string for char only.
   * Return null/undefined to leave the cell unchanged from pre().
   */
  main?(
    coord: Coord,
    context: Context,
    cursor: Cursor,
    buffer: Cell[],
    state: S
  ): Cell | string | null | undefined

  /**
   * Called once per frame after main().
   * Use for overlays, UI, or any post-processing on the buffer.
   */
  post?(context: Context, cursor: Cursor, buffer: Cell[], state: S): void
}

// ---------------------------------------------------------------------------
// RunSettings
// ---------------------------------------------------------------------------

/**
 * Configuration for run(). All fields are optional.
 * Merged in order: defaults → runSettings argument → program.settings.
 */
export interface RunSettings {
  element?: HTMLElement  // target element; a <pre> is created if omitted
  cols?: number          // fixed column count; 0 = fill container width
  rows?: number          // fixed row count; 0 = fill container height
  fps?: number           // frame rate cap, default 30
  once?: boolean         // if true, render one frame then stop

  // CSS applied to the container element
  backgroundColor?: string
  color?: string
  fontFamily?: string
  fontSize?: string
  fontWeight?: string
  letterSpacing?: string
  lineHeight?: string
}
