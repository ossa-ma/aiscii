/**
 * Types for the convert pipeline.
 * Source → decode → normalize → rasterize → shade → output
 */

/** Raw RGBA pixel data for a single frame */
export interface Frame {
  data: Uint8Array   // RGBA, length = width * height * 4
  width: number
  height: number
  delay: number      // frame duration in ms (0 for static images)
}

/** Per-cell data produced by the rasterizer, consumed by shaders */
export interface CellData {
  brightness: number                    // 0-1 luminance (foreground-only in coverage mode)
  coverage: number                      // 0-1 foreground pixel ratio in this cell
  sourceColor: [number, number, number] // average RGB of source pixels [0-255]
  x: number                             // normalized grid position 0-1
  y: number                             // normalized grid position 0-1
}

/** A single styled cell in the output */
export interface StyledCell {
  char: string
  color: string
}

/** A full frame of rasterized cell data */
export interface CellFrame {
  cells: CellData[]    // flat array, length = cols * rows
  cols: number
  rows: number
  delay: number        // ms
}

/** A full frame of styled output */
export interface StyledFrame {
  cells: StyledCell[]  // flat array, length = cols * rows
  cols: number
  rows: number
  delay: number        // ms
}

/** Rasterization mode */
export type RasterMode = 'brightness' | 'silhouette' | 'coverage' | 'edge'

/** Options for the rasterizer */
export interface RasterOptions {
  cols: number
  rows?: number           // auto-computed from aspect ratio if omitted
  mode: RasterMode
  charAspect?: number     // character cell height/width ratio, default 2.0
}

/** Background removal options */
export interface BgRemovalOptions {
  enabled: boolean
  color?: [number, number, number]  // specific bg color to remove, or auto-detect
  threshold?: number                // color distance threshold, default 30
  coverageMin?: number              // min foreground coverage per cell, default 0.15
}

/** Shader function: maps cell data to styled output */
export type ShaderFn = (cell: CellData) => StyledCell
