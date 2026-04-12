/**
 * @module vec2
 * 2D vector math. All operations return new vectors — inputs are not mutated.
 * Vectors are plain objects { x, y } for zero-overhead construction.
 */

export interface Vec2 {
  x: number
  y: number
}

/** Create a new Vec2 */
export function vec2(x: number, y: number): Vec2 {
  return { x, y }
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function mul(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s }
}

export function div(a: Vec2, s: number): Vec2 {
  return { x: a.x / s, y: a.y / s }
}

/** Dot product */
export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y
}

/** Euclidean length */
export function length(a: Vec2): number {
  return Math.sqrt(a.x * a.x + a.y * a.y)
}

/** Squared length — faster than length() when you only need relative comparisons */
export function lengthSq(a: Vec2): number {
  return a.x * a.x + a.y * a.y
}

/** Unit vector in the direction of a. Returns {x:0, y:0} for zero-length input. */
export function normalize(a: Vec2): Vec2 {
  const len = length(a)
  return len > 0 ? { x: a.x / len, y: a.y / len } : { x: 0, y: 0 }
}

/** Distance between two points */
export function dist(a: Vec2, b: Vec2): number {
  return length(sub(a, b))
}

/** Linear interpolation between two vectors */
export function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** Per-component absolute value */
export function abs(a: Vec2): Vec2 {
  return { x: Math.abs(a.x), y: Math.abs(a.y) }
}

/** Per-component max */
export function max(a: Vec2, b: Vec2): Vec2 {
  return { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) }
}

/** Per-component min */
export function min(a: Vec2, b: Vec2): Vec2 {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) }
}

/** Rotate vector by angle (radians) */
export function rotate(a: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c }
}

/** Reflect vector around a normal */
export function reflect(a: Vec2, normal: Vec2): Vec2 {
  const d = 2 * dot(a, normal)
  return { x: a.x - d * normal.x, y: a.y - d * normal.y }
}
