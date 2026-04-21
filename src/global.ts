import { run } from './runtime'
import * as math from './modules/math'
import * as vec2 from './modules/vec2'
import * as color from './modules/color'
import * as sdf from './modules/sdf'
import * as buffer from './modules/buffer'
import * as noise from './modules/noise'
import { DENSITY } from './modules/math'

;(window as any).aiscii = { run, math, vec2, color, sdf, buffer, noise, DENSITY }
