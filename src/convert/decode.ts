/**
 * Source decoder: reads image/GIF/video files into raw RGBA frames.
 *
 * Static images → single Frame
 * GIFs → array of Frames with timing
 * Video → frames via ffmpeg (requires ffmpeg installed)
 */

import { readFileSync } from 'fs'
import { extname } from 'path'
import type { Frame } from './types'

/**
 * Decode a source file into RGBA frames.
 * Dispatches based on file extension.
 */
export async function decode(path: string): Promise<Frame[]> {
  const ext = extname(path).toLowerCase()

  if (ext === '.gif') {
    return decodeGif(path)
  }
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    const frame = await decodeImage(path)
    return [frame]
  }
  if (['.mp4', '.webm', '.mov', '.avi'].includes(ext)) {
    return decodeVideo(path)
  }

  throw new Error(`Unsupported format: ${ext}`)
}

/**
 * Decode a static image (PNG, JPEG, WebP) into a single RGBA frame.
 */
async function decodeImage(path: string): Promise<Frame> {
  const buf = readFileSync(path)
  const ext = extname(path).toLowerCase()

  let imageData: ImageData

  if (ext === '.png') {
    const { decode } = await import('@jsquash/png')
    imageData = await decode(buf.buffer)
  } else if (ext === '.jpg' || ext === '.jpeg') {
    const { decode } = await import('@jsquash/jpeg')
    imageData = await decode(buf.buffer)
  } else if (ext === '.webp') {
    const { decode } = await import('@jsquash/webp')
    imageData = await decode(buf.buffer)
  } else {
    throw new Error(`Unsupported image format: ${ext}`)
  }

  return {
    data: new Uint8Array(imageData.data.buffer),
    width: imageData.width,
    height: imageData.height,
    delay: 0,
  }
}

/**
 * Decode an animated GIF into an array of composited RGBA frames.
 * Uses gifuct-js which handles disposal methods correctly.
 */
async function decodeGif(path: string): Promise<Frame[]> {
  const { parseGIF, decompressFrames } = await import('gifuct-js')
  const buf = readFileSync(path)
  const gif = parseGIF(buf.buffer instanceof ArrayBuffer ? buf.buffer : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const rawFrames = decompressFrames(gif, true)

  if (rawFrames.length === 0) {
    throw new Error('GIF contains no frames')
  }

  // gifuct-js gives us patch frames — we need to composite them
  // onto a full canvas, respecting disposal methods
  const { width: gifWidth, height: gifHeight } = rawFrames[0].dims
  // Use the logical screen size from the first frame's full dimensions
  const canvasWidth = gif.lsd?.width ?? gifWidth
  const canvasHeight = gif.lsd?.height ?? gifHeight

  const canvas = new Uint8Array(canvasWidth * canvasHeight * 4)
  const frames: Frame[] = []

  for (const raw of rawFrames) {
    const { dims, patch, delay, disposalType } = raw

    // Apply patch to canvas
    for (let y = 0; y < dims.height; y++) {
      for (let x = 0; x < dims.width; x++) {
        const si = (y * dims.width + x) * 4
        const di = ((dims.top + y) * canvasWidth + (dims.left + x)) * 4

        // Only write non-transparent pixels
        if (patch[si + 3] > 0) {
          canvas[di] = patch[si]
          canvas[di + 1] = patch[si + 1]
          canvas[di + 2] = patch[si + 2]
          canvas[di + 3] = patch[si + 3]
        }
      }
    }

    // Snapshot the canvas as this frame
    frames.push({
      data: new Uint8Array(canvas),
      width: canvasWidth,
      height: canvasHeight,
      delay: delay * 10, // gifuct-js delay is in centiseconds
    })

    // Handle disposal
    if (disposalType === 2) {
      // Restore to background — clear the patch area
      for (let y = 0; y < dims.height; y++) {
        for (let x = 0; x < dims.width; x++) {
          const di = ((dims.top + y) * canvasWidth + (dims.left + x)) * 4
          canvas[di] = 0
          canvas[di + 1] = 0
          canvas[di + 2] = 0
          canvas[di + 3] = 0
        }
      }
    }
    // disposalType 3 (restore to previous) is rare and complex — skip for now
  }

  return frames
}

/**
 * Decode video frames via ffmpeg.
 * Requires ffmpeg installed on the system.
 */
async function decodeVideo(path: string): Promise<Frame[]> {
  // Probe video dimensions first
  const probe = Bun.spawn(
    ['ffprobe', '-v', 'error', '-select_streams', 'v:0',
     '-show_entries', 'stream=width,height,r_frame_rate',
     '-of', 'json', path],
    { stdout: 'pipe', stderr: 'pipe' }
  )

  const probeOut = await new Response(probe.stdout).text()
  const probeErr = await new Response(probe.stderr).text()
  await probe.exited

  if (probe.exitCode !== 0) {
    if (probeErr.includes('not found') || probeErr.includes('No such file')) {
      throw new Error('ffmpeg/ffprobe not found. Install ffmpeg for video support.')
    }
    throw new Error(`ffprobe failed: ${probeErr}`)
  }

  const probeData = JSON.parse(probeOut)
  const stream = probeData.streams?.[0]
  if (!stream) throw new Error('No video stream found')

  const width = stream.width as number
  const height = stream.height as number
  const [fpsNum, fpsDen] = (stream.r_frame_rate as string).split('/').map(Number)
  const fps = fpsDen ? fpsNum / fpsDen : 30
  const frameDelay = Math.round(1000 / fps)

  // Extract raw RGBA frames
  const ffmpeg = Bun.spawn(
    ['ffmpeg', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgba',
     '-v', 'error', '-'],
    { stdout: 'pipe', stderr: 'pipe' }
  )

  const rawData = new Uint8Array(await new Response(ffmpeg.stdout).arrayBuffer())
  const stderrText = await new Response(ffmpeg.stderr).text()
  await ffmpeg.exited

  if (ffmpeg.exitCode !== 0) {
    throw new Error(`ffmpeg failed: ${stderrText}`)
  }

  const frameSize = width * height * 4
  const frameCount = Math.floor(rawData.length / frameSize)
  const frames: Frame[] = []

  for (let i = 0; i < frameCount; i++) {
    frames.push({
      data: rawData.slice(i * frameSize, (i + 1) * frameSize),
      width,
      height,
      delay: frameDelay,
    })
  }

  return frames
}
