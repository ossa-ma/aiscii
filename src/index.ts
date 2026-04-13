/**
 * aiscii — browser-based ASCII animation runtime.
 * Main entry point. Re-exports everything a program author needs.
 */

// Runtime
export { run } from './runtime'

// Types
export type { Program, Cell, Context, Coord, Cursor, Metrics, RunSettings } from './types'

// Modules — re-exported as namespaces for clean program imports:
//   import { math, sdf, color, noise } from 'aiscii'
//   or import directly: import * as sdf from 'aiscii/modules/sdf'
export * as math   from './modules/math'
export * as vec2   from './modules/vec2'
export * as color  from './modules/color'
export * as sdf    from './modules/sdf'
export * as buffer from './modules/buffer'
export * as noise  from './modules/noise'
export * as image  from './modules/image'

// Density palettes surfaced at the top level for convenience
export { DENSITY } from './modules/math'
