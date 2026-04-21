export function shader(cell: { brightness: number; coverage: number; sourceColor: [number, number, number]; x: number; y: number }) {
  if (cell.brightness < 0.02) return { char: ' ', color: 'transparent' }
  const b = cell.brightness
  const char = b > 0.7 ? '*' : b > 0.4 ? '~' : b > 0.2 ? '.' : '·'
  const hue = 180 + b * 60
  const sat = 70 + b * 30
  const lit = 10 + b * 50
  return { char, color: `hsl(${hue},${sat}%,${lit}%)` }
}
