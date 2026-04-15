/**
 * aiscii/convert — source-to-ASCII pipeline.
 *
 * Public API for programmatic use. The CLI (`aiscii convert`) wraps this.
 */

export { decode } from './decode'
export { normalizeFrames } from './normalize'
export { rasterizeFrame, rasterizeFrames, detectBgColor, computeRows } from './rasterize'
export { applyShader, getShader, SHADERS, defaultShader, silhouetteShader, thermalShader, nightVisionShader, blueprintShader, xrayShader } from './shaders'
export { renderAnsi, renderPlain, playAnsi, toJSON, toHTML } from './output'
export type { Frame, CellData, CellFrame, StyledCell, StyledFrame, RasterMode, RasterOptions, BgRemovalOptions, ShaderFn } from './types'
