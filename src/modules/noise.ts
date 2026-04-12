/**
 * @module noise
 * Simplex noise for 2D and 3D.
 * Use noise3(x, y, time * speed) to get animated 2D noise — the third dimension
 * acts as a time axis, producing smooth continuous animation.
 *
 * Output range: approximately [-1, 1].
 *
 * Based on Stefan Gustavson's simplex noise implementation.
 * Reference: https://weber.itn.liu.se/~stegu/simplexnoise/simplexnoise.pdf
 */

// ---------------------------------------------------------------------------
// Lookup tables (fixed — deterministic across all programs)
// ---------------------------------------------------------------------------

// Classic permutation table from Gustavson's paper
const P = new Uint8Array([
  151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,
  140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,
  247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,
  57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,
  74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,
  60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,
  65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,
  200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,
  52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,
  207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,
  119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,
  129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,
  218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,
  81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,
  184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,
  222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180,
])

// Double the table to avoid index wrapping
const PERM = new Uint8Array(512)
const PERM_MOD12 = new Uint8Array(512)
for (let i = 0; i < 512; i++) {
  PERM[i] = P[i & 255] as number
  PERM_MOD12[i] = (PERM[i] as number) % 12
}

// Gradient vectors for 3D simplex noise (12 edges of a cube)
const GRAD3 = new Float32Array([
  1,1,0, -1,1,0, 1,-1,0, -1,-1,0,
  1,0,1, -1,0,1, 1,0,-1, -1,0,-1,
  0,1,1, 0,-1,1, 0,1,-1, 0,-1,-1,
])

// ---------------------------------------------------------------------------
// 2D Simplex noise
// ---------------------------------------------------------------------------

const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6

/**
 * 2D simplex noise.
 * @returns value in approximately [-1, 1]
 */
export function noise2(xin: number, yin: number): number {
  const s = (xin + yin) * F2
  const i = Math.floor(xin + s)
  const j = Math.floor(yin + s)
  const t = (i + j) * G2

  const x0 = xin - (i - t)
  const y0 = yin - (j - t)

  // Determine which simplex triangle we're in
  const i1 = x0 > y0 ? 1 : 0
  const j1 = x0 > y0 ? 0 : 1

  const x1 = x0 - i1 + G2
  const y1 = y0 - j1 + G2
  const x2 = x0 - 1 + 2 * G2
  const y2 = y0 - 1 + 2 * G2

  const ii = i & 255
  const jj = j & 255

  const gi0 = (PERM_MOD12[ii + (PERM[jj] as number)] as number)
  const gi1 = (PERM_MOD12[ii + i1 + (PERM[jj + j1] as number)] as number)
  const gi2 = (PERM_MOD12[ii + 1 + (PERM[jj + 1] as number)] as number)

  let n0 = 0, n1 = 0, n2 = 0

  let t0 = 0.5 - x0 * x0 - y0 * y0
  if (t0 >= 0) {
    t0 *= t0
    n0 = t0 * t0 * (GRAD3[gi0 * 3]! * x0 + GRAD3[gi0 * 3 + 1]! * y0)
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1
  if (t1 >= 0) {
    t1 *= t1
    n1 = t1 * t1 * (GRAD3[gi1 * 3]! * x1 + GRAD3[gi1 * 3 + 1]! * y1)
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2
  if (t2 >= 0) {
    t2 *= t2
    n2 = t2 * t2 * (GRAD3[gi2 * 3]! * x2 + GRAD3[gi2 * 3 + 1]! * y2)
  }

  return 70 * (n0 + n1 + n2)
}

// ---------------------------------------------------------------------------
// 3D Simplex noise
// ---------------------------------------------------------------------------

const F3 = 1 / 3
const G3 = 1 / 6

/**
 * 3D simplex noise.
 * Using noise3(x, y, time * 0.001) gives smoothly animated 2D noise.
 * @returns value in approximately [-1, 1]
 */
export function noise3(xin: number, yin: number, zin: number): number {
  const s = (xin + yin + zin) * F3
  const i = Math.floor(xin + s)
  const j = Math.floor(yin + s)
  const k = Math.floor(zin + s)
  const t = (i + j + k) * G3

  const x0 = xin - (i - t)
  const y0 = yin - (j - t)
  const z0 = zin - (k - t)

  // Determine simplex (there are 6 possible tetrahedra in 3D)
  let i1: number, j1: number, k1: number
  let i2: number, j2: number, k2: number

  if (x0 >= y0) {
    if (y0 >= z0)      { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0 }
    else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1 }
    else               { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1 }
  } else {
    if (y0 < z0)       { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1 }
    else if (x0 < z0)  { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1 }
    else               { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0 }
  }

  const x1 = x0 - i1 + G3
  const y1 = y0 - j1 + G3
  const z1 = z0 - k1 + G3
  const x2 = x0 - i2 + 2 * G3
  const y2 = y0 - j2 + 2 * G3
  const z2 = z0 - k2 + 2 * G3
  const x3 = x0 - 1 + 3 * G3
  const y3 = y0 - 1 + 3 * G3
  const z3 = z0 - 1 + 3 * G3

  const ii = i & 255
  const jj = j & 255
  const kk = k & 255

  const gi0 = PERM_MOD12[ii + (PERM[jj + (PERM[kk] as number)] as number)] as number
  const gi1 = PERM_MOD12[ii + i1 + (PERM[jj + j1 + (PERM[kk + k1] as number)] as number)] as number
  const gi2 = PERM_MOD12[ii + i2 + (PERM[jj + j2 + (PERM[kk + k2] as number)] as number)] as number
  const gi3 = PERM_MOD12[ii + 1 + (PERM[jj + 1 + (PERM[kk + 1] as number)] as number)] as number

  let n0 = 0, n1 = 0, n2 = 0, n3 = 0

  let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0
  if (t0 >= 0) {
    t0 *= t0
    n0 = t0*t0*(GRAD3[gi0*3]!*x0 + GRAD3[gi0*3+1]!*y0 + GRAD3[gi0*3+2]!*z0)
  }
  let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1
  if (t1 >= 0) {
    t1 *= t1
    n1 = t1*t1*(GRAD3[gi1*3]!*x1 + GRAD3[gi1*3+1]!*y1 + GRAD3[gi1*3+2]!*z1)
  }
  let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2
  if (t2 >= 0) {
    t2 *= t2
    n2 = t2*t2*(GRAD3[gi2*3]!*x2 + GRAD3[gi2*3+1]!*y2 + GRAD3[gi2*3+2]!*z2)
  }
  let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3
  if (t3 >= 0) {
    t3 *= t3
    n3 = t3*t3*(GRAD3[gi3*3]!*x3 + GRAD3[gi3*3+1]!*y3 + GRAD3[gi3*3+2]!*z3)
  }

  return 32 * (n0 + n1 + n2 + n3)
}

/**
 * Fractional Brownian Motion — layers multiple octaves of noise for
 * richer, more natural-looking results.
 *
 * @param x, y   - position
 * @param z      - time/animation axis (use context.time * speed)
 * @param octaves - number of noise layers (2–6, higher = more detail but slower)
 * @returns value in approximately [-1, 1]
 */
export function fbm(x: number, y: number, z: number, octaves = 4): number {
  let value = 0
  let amplitude = 0.5
  let frequency = 1
  let max = 0

  for (let i = 0; i < octaves; i++) {
    value += noise3(x * frequency, y * frequency, z) * amplitude
    max += amplitude
    amplitude *= 0.5
    frequency *= 2
  }

  return value / max
}
