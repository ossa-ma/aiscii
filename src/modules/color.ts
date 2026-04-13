/**
 * @module color
 * Color utilities for aiscii programs.
 * All output is CSS color strings compatible with Cell.color / Cell.backgroundColor.
 */

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

/** Build a CSS rgb() string from integer components [0, 255]. */
export function rgb(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
}

/** Build a CSS hsl() string. h in [0, 360], s and l in [0, 100]. */
export function hsl(h: number, s: number, l: number): string {
  return `hsl(${h},${s}%,${l}%)`
}

/** Build a CSS hsla() string. h in [0, 360], s and l in [0, 100], a in [0, 1]. */
export function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${h},${s}%,${l}%,${a})`
}

// ---------------------------------------------------------------------------
// Inigo Quilez cosine palette
// ---------------------------------------------------------------------------

/**
 * Cosine colour palette — generates smooth, periodic colour gradients.
 * Reference: https://iquilezles.org/articles/palettes/
 *
 * Formula: color(t) = a + b * cos(2π(c*t + d))
 * Each of a, b, c, d is an [r, g, b] triple in [0, 1].
 * t is the position along the palette, typically in [0, 1].
 *
 * Returns a CSS rgb() string.
 *
 * @example
 * // Warm fire palette
 * const c = palette(t,
 *   [0.5, 0.2, 0.1],  // a: base brightness per channel
 *   [0.5, 0.4, 0.3],  // b: amplitude
 *   [1.0, 1.0, 1.0],  // c: frequency
 *   [0.0, 0.2, 0.4]   // d: phase offset per channel
 * )
 */
export function palette(
  t: number,
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  d: [number, number, number]
): string {
  const TAU = Math.PI * 2
  const r = a[0] + b[0] * Math.cos(TAU * (c[0] * t + d[0]))
  const g = a[1] + b[1] * Math.cos(TAU * (c[1] * t + d[1]))
  const bl = a[2] + b[2] * Math.cos(TAU * (c[2] * t + d[2]))
  return rgb(r * 255, g * 255, bl * 255)
}

// ---------------------------------------------------------------------------
// Preset palettes (IQ cosine palette presets)
// These cover common aesthetic moods — pass t in [0, 1].
// ---------------------------------------------------------------------------

/** Rainbow cycle */
export const PALETTES = {
  rainbow: (t: number) => palette(t,
    [0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 1.0, 1.0], [0.0, 0.33, 0.67]
  ),
  /** Cool blue-green-purple */
  cool: (t: number) => palette(t,
    [0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 1.0, 1.0], [0.5, 0.2, 0.25]
  ),
  /** Warm orange-red-yellow */
  warm: (t: number) => palette(t,
    [0.5, 0.4, 0.2], [0.5, 0.4, 0.2], [1.0, 1.0, 0.5], [0.0, 0.1, 0.2]
  ),
  /** Neon pink-cyan */
  neon: (t: number) => palette(t,
    [0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [2.0, 1.0, 0.0], [0.5, 0.2, 0.25]
  ),
  /** Grayscale */
  mono: (t: number) => {
    const v = Math.round(t * 255)
    return rgb(v, v, v)
  },
} as const

// ---------------------------------------------------------------------------
// Lerp between two hex/named CSS colors (component-space)
// ---------------------------------------------------------------------------

/**
 * Linearly interpolate between two RGB colours.
 * r, g, b components should be in [0, 255].
 */
export function lerpRGB(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  t: number
): string {
  return rgb(
    r1 + (r2 - r1) * t,
    g1 + (g2 - g1) * t,
    b1 + (b2 - b1) * t
  )
}

/**
 * Linearly interpolate between two HSL colours.
 * h in [0, 360], s and l in [0, 100]. Takes the shortest hue path.
 */
export function lerpHSL(
  h1: number, s1: number, l1: number,
  h2: number, s2: number, l2: number,
  t: number
): string {
  // Shortest-path hue interpolation
  let dh = h2 - h1
  if (dh > 180) dh -= 360
  if (dh < -180) dh += 360
  return hsl(
    ((h1 + dh * t) % 360 + 360) % 360,
    s1 + (s2 - s1) * t,
    l1 + (l2 - l1) * t,
  )
}
