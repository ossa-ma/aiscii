/**
 * @module sdf
 * Signed Distance Functions (SDFs) for 2D shapes.
 *
 * SDFs return the signed distance from a point to the surface of a shape:
 *   - Negative: inside the shape
 *   - Zero:     on the surface
 *   - Positive: outside the shape
 *
 * All functions expect coordinates in centered, aspect-corrected space.
 * Use centered() from modules/math to convert Coord → { x, y } before calling these.
 *
 * Reference: https://iquilezles.org/articles/distfunctions2d/
 */

// ---------------------------------------------------------------------------
// Primitive shapes
// ---------------------------------------------------------------------------

/** Signed distance to a circle centered at the origin with radius r. */
export function circle(x: number, y: number, r: number): number {
  return Math.sqrt(x * x + y * y) - r
}

/** Signed distance to an axis-aligned box centered at the origin, half-extents (hw, hh). */
export function box(x: number, y: number, hw: number, hh: number): number {
  const dx = Math.abs(x) - hw
  const dy = Math.abs(y) - hh
  return Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2) + Math.min(Math.max(dx, dy), 0)
}

/** Signed distance to a line segment from (ax, ay) to (bx, by). Always positive. */
export function segment(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const pax = x - ax, pay = y - ay
  const bax = bx - ax, bay = by - ay
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)))
  const dx = pax - bax * h
  const dy = pay - bay * h
  return Math.sqrt(dx * dx + dy * dy)
}

/** Signed distance to an infinite line passing through origin at angle (radians). */
export function line(x: number, y: number, angle: number): number {
  return x * Math.cos(angle) - y * Math.sin(angle)
}

/** Signed distance to a ring (annulus) centered at origin, radius r, thickness t. */
export function ring(x: number, y: number, r: number, t: number): number {
  return Math.abs(Math.sqrt(x * x + y * y) - r) - t
}

/** Signed distance to an equilateral triangle centered at origin, size r. */
export function triangle(x: number, y: number, r: number): number {
  const k = Math.sqrt(3)
  let px = Math.abs(x) - r
  let py = y + r / k
  if (px + k * py > 0) { const t = px; px = (px - k * py) / 2; py = (-k * t - py) / 2 }
  px -= Math.max(-2 * r, Math.min(0, px))
  return -Math.sqrt(px * px + py * py) * Math.sign(py)
}

/**
 * Signed distance to a regular polygon centered at origin.
 * @param n  Number of sides (3 = triangle, 5 = pentagon, 6 = hexagon, etc.)
 * @param r  Circumradius (distance from center to vertex)
 */
export function polygon(x: number, y: number, n: number, r: number): number {
  const an = Math.PI / n
  const he = r * Math.cos(an) // apothem (center to edge midpoint)
  // Fold into one sector using angular repetition
  let a = Math.atan2(y, x)
  a = ((a % (2 * an)) + 2 * an) % (2 * an) - an
  const d = Math.sqrt(x * x + y * y)
  // Distance to the nearest edge
  return d * Math.cos(a) - he
}

/**
 * Signed distance to a star centered at origin.
 * @param n   Number of points (5 = classic star, 6 = Star of David, etc.)
 * @param ro  Outer radius (tip of points)
 * @param ri  Inner radius (valley between points)
 */
export function star(x: number, y: number, n: number, ro: number, ri: number): number {
  const an = Math.PI / n
  // Fold into one sector
  let a = Math.atan2(y, x)
  a = ((a % (2 * an)) + 2 * an) % (2 * an) - an
  const d = Math.sqrt(x * x + y * y)
  const sx = d * Math.cos(a), sy = d * Math.abs(Math.sin(a))
  // Edge from inner valley (ri, 0) rotated by an, to outer tip (ro, 0)
  const vx = ri * Math.cos(an), vy = ri * Math.sin(an)
  const ex = ro - vx, ey = -vy
  const t = Math.max(0, Math.min(1, ((sx - vx) * ex + (sy - vy) * ey) / (ex * ex + ey * ey)))
  const px = sx - vx - ex * t, py = sy - vy - ey * t
  const dist = Math.sqrt(px * px + py * py)
  const sign = sx * ey - sy * ex > 0 ? 1 : -1
  return dist * sign
}

// ---------------------------------------------------------------------------
// Boolean operations
// ---------------------------------------------------------------------------

/** Union of two SDFs — the region covered by either shape. */
export function union(a: number, b: number): number {
  return Math.min(a, b)
}

/** Intersection of two SDFs — the region covered by both shapes. */
export function intersect(a: number, b: number): number {
  return Math.max(a, b)
}

/** Subtract shape b from shape a. */
export function subtract(a: number, b: number): number {
  return Math.max(a, -b)
}

/**
 * Smooth union — blends the boundary between two shapes.
 * k controls the blend radius (try 0.05–0.3).
 */
export function smoothUnion(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

/**
 * Smooth subtract — softens the cut edge.
 * k controls the blend radius.
 */
export function smoothSubtract(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(-b - a), 0) / k
  return Math.max(a, -b) + h * h * k * 0.25
}

// ---------------------------------------------------------------------------
// Domain operations
// ---------------------------------------------------------------------------

/**
 * Tile the x-axis with period p.
 * Apply before calling a shape function to repeat it along x.
 * Returns the modified x coordinate.
 */
export function repeatX(x: number, period: number): number {
  return x - period * Math.round(x / period)
}

/**
 * Tile both axes with periods (px, py).
 * Returns the modified { x, y }.
 */
export function repeat(x: number, y: number, px: number, py: number): { x: number; y: number } {
  return {
    x: x - px * Math.round(x / px),
    y: y - py * Math.round(y / py),
  }
}

/**
 * Rotate the domain by angle (radians) around the origin before applying a shape.
 * Returns modified { x, y }.
 */
export function rotateDomain(x: number, y: number, angle: number): { x: number; y: number } {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: x * c - y * s, y: x * s + y * c }
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

/**
 * Convert a signed distance to a 0→1 fill value suitable for density palette indexing.
 * Cells inside the shape (d < 0) return 1.0; outside return 0.0.
 * The `softness` parameter controls the anti-aliasing width at the boundary.
 */
export function fill(d: number, softness = 0.02): number {
  return 1 - Math.max(0, Math.min(1, d / softness + 0.5))
}

/**
 * Convert a signed distance to a 0→1 outline value.
 * Peaks at 1.0 on the surface (d ≈ 0), falls to 0 on either side.
 * `width` controls the outline thickness, `softness` controls edge smoothness.
 */
export function outline(d: number, width = 0.03, softness = 0.01): number {
  return 1 - Math.min(1, Math.abs(d - width * 0.5) / softness)
}
