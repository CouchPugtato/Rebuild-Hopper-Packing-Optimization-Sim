const CLOSE_PACKING_DENSITY = Math.PI / Math.sqrt(18)

function inBounds(p, dims, r) {
  return (
    p.x >= -dims.width / 2 + r &&
    p.x <= dims.width / 2 - r &&
    p.y >= r &&
    p.y <= dims.height - r &&
    p.z >= -dims.depth / 2 + r &&
    p.z <= dims.depth / 2 - r
  )
}

export function packFCC(dims, r, offsets = { ox: 0, oy: 0, oz: 0 }) {
  const a = 2 * Math.SQRT2 * r
  const W = dims.width
  const H = dims.height
  const D = dims.depth
  const minX = -W / 2 + r
  const maxX = W / 2 - r
  const minY = r
  const maxY = H - r
  const minZ = -D / 2 + r
  const maxZ = D / 2 - r
  const positions = []
  const bases = [
    [0, 0, 0],
    [0, a / 2, a / 2],
    [a / 2, 0, a / 2],
    [a / 2, a / 2, 0]
  ]
  for (let i = -100; i <= 100; i++) {
    for (let j = -100; j <= 100; j++) {
      for (let k = -100; k <= 100; k++) {
        for (const b of bases) {
          const x = offsets.ox + i * a + b[0] - 0
          const y = offsets.oy + j * a + b[1] + 0
          const z = offsets.oz + k * a + b[2] - 0
          if (x < minX || x > maxX || y < minY || y > maxY || z < minZ || z > maxZ) continue
          positions.push({ x, y, z })
        }
      }
    }
  }
  return positions
}

function sampleOffsets(period, samples = 6) {
  const arr = []
  for (let i = 0; i < samples; i++) arr.push((period * i) / samples)
  return arr
}

export function packBestFCC(dims, r, optimize = true) {
  if (!optimize) return packFCC(dims, r, { ox: 0, oy: 0, oz: 0 })
  let best = []
  const a = 2 * Math.SQRT2 * r
  const xs = sampleOffsets(a)
  const ys = sampleOffsets(a)
  const zs = sampleOffsets(a)
  for (const ox of xs) for (const oy of ys) for (const oz of zs) {
    const positions = packFCC(dims, r, { ox: ox - dims.width / 2 + r, oy: oy + r, oz: oz - dims.depth / 2 + r })
    if (positions.length > best.length) best = positions
  }
  return best
}

export function packingMetrics(dims, r, count) {
  const boxVol = dims.width * dims.height * dims.depth
  const sphereVol = (4 / 3) * Math.PI * r * r * r
  const fraction = (count * sphereVol) / boxVol
  return { fraction, theoreticalMax: CLOSE_PACKING_DENSITY }
}
