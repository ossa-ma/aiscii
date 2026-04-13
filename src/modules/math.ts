/**
 * @module math
 * Core math utilities for aiscii programs.
 * Covers remapping, interpolation, oscillators, easing, and density palettes.
 */

import type { Coord, Context } from '../types'

// ---------------------------------------------------------------------------
// Remapping & interpolation
// ---------------------------------------------------------------------------

/** Remap a value from one range to another. Does not clamp. */
export function map(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return ((v - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin
}

/** Clamp a value between min and max (inclusive). */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

/** Linear interpolation between a and b. t=0 returns a, t=1 returns b. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Remap then clamp — map() with output clamped to [outMin, outMax]. */
export function mapClamp(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return clamp(map(v, inMin, inMax, outMin, outMax), outMin, outMax)
}

/** GLSL-style smoothstep. Returns 0 below edge0, 1 above edge1, smooth S-curve in between. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Fractional part of x. fract(1.7) = 0.7, fract(-0.3) = 0.7 */
export function fract(x: number): number {
  return x - Math.floor(x)
}

/** Modulo that always returns a positive result, unlike JS % for negative numbers. */
export function mod(x: number, y: number): number {
  return ((x % y) + y) % y
}

// ---------------------------------------------------------------------------
// Oscillators
// ---------------------------------------------------------------------------

/**
 * Sine oscillator. Returns a value in [0, 1].
 * @param time  - context.time (milliseconds)
 * @param freq  - cycles per second
 * @param phase - phase offset in [0, 1], default 0
 */
export function osc(time: number, freq: number, phase = 0): number {
  return (Math.sin((time / 1000) * freq * Math.PI * 2 + phase * Math.PI * 2) + 1) / 2
}

/**
 * Sine oscillator. Returns a value in [-1, 1].
 * @param time  - context.time (milliseconds)
 * @param freq  - cycles per second
 * @param phase - phase offset in [0, 1], default 0
 */
export function oscBipolar(time: number, freq: number, phase = 0): number {
  return Math.sin((time / 1000) * freq * Math.PI * 2 + phase * Math.PI * 2)
}

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

/** Collection of standard easing functions. Input t should be in [0, 1]. */
export const ease = {
  /** Starts slow, ends fast */
  in: (t: number): number => t * t,
  /** Starts fast, ends slow */
  out: (t: number): number => 1 - (1 - t) * (1 - t),
  /** Slow at both ends */
  inOut: (t: number): number => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  /** Overshoots slightly, elastic feel */
  elastic: (t: number): number => {
    if (t === 0 || t === 1) return t
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1
  },
}

// ---------------------------------------------------------------------------
// Aspect-corrected centered coordinates
// ---------------------------------------------------------------------------

/**
 * Convert a Coord to aspect-corrected centered coordinates.
 *
 * In this space, an SDF circle with radius 0.5 will appear as a circle
 * (not an ellipse) regardless of terminal dimensions or font metrics.
 *
 * - Origin (0, 0) is at the center of the grid
 * - Range is approximately [-1, 1] on the shorter axis
 * - X is scaled by metrics.aspect to correct for non-square characters
 *
 * @example
 * const { x: cx, y: cy } = centered(coord, context)
 * const d = sdf.circle(cx, cy, 0.4)
 */
export function centered(coord: Coord, context: Context): { x: number; y: number } {
  const { u, v } = coord
  const { cols, rows, metrics } = context
  // Divide by min(cols, rows) so the shorter axis maps to [-1, 1]
  const m = Math.min(cols, rows)
  return {
    x: (u - 0.5) * 2 * (cols / m) * metrics.aspect,
    y: (v - 0.5) * 2 * (rows / m),
  }
}

// ---------------------------------------------------------------------------
// Polar coordinates
// ---------------------------------------------------------------------------

/**
 * Convert centered (x, y) coordinates to polar (angle, radius).
 * angle is in radians, range [-π, π]. radius is always >= 0.
 * Pair with centered() for aspect-corrected polar patterns.
 *
 * @example
 * const { x, y } = centered(coord, context)
 * const { angle, radius } = toPolar(x, y)
 * // spiral: angle + radius * 5 + time
 */
export function toPolar(x: number, y: number): { angle: number; radius: number } {
  return {
    angle: Math.atan2(y, x),
    radius: Math.sqrt(x * x + y * y),
  }
}

// ---------------------------------------------------------------------------
// Character density palettes
// ---------------------------------------------------------------------------

/**
 * Named character density ramps, ordered dark→light (index 0 = darkest).
 *
 * Usage: index into a palette using a normalized brightness value:
 *   const i = Math.floor(brightness * (palette.length - 1))
 *   return palette[i]
 *
 * SAFE palettes use only printable ASCII — render correctly in any font.
 * EXTENDED palettes use Unicode block characters — may not render in all fonts.
 */
export const DENSITY = {
  /** 10-char ASCII ramp, minimal. Safe. */
  simple: ' .:-=+*#%@',
  /** 70-char ASCII ramp, high detail. Safe. */
  complex: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  /** Dot-based, light feel. Safe. */
  dots: ' ...:::ooo***',
  /** Binary/code aesthetic. Safe. */
  binary: ' .,:;!|?1lI0OX',
  /** Unicode block fill — requires unicode monospace font. Extended. */
  blocks: ' ░▒▓█',
  /** Braille dots — requires braille-supporting font. Extended. */
  braille: ' ⠁⠃⠇⠿',
} as const

export type DensityKey = keyof typeof DENSITY
