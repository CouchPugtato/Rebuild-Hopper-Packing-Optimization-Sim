self.onmessage = function (e) {
  const { dims, r, offsetsList, slope } = e.data
  const a = 2 * Math.SQRT2 * r
  const W = dims.width
  const H = dims.height
  const D = dims.depth
  const minX = -W / 2 + r
  const maxX = W / 2 - r
  const maxY = H - r
  const minZ = -D / 2 + r
  const maxZ = D / 2 - r
  const angle = slope && slope.slopeAngleDeg ? slope.slopeAngleDeg : 0
  const axis = slope && slope.slopeAxis ? slope.slopeAxis : 'x'
  const tan = Math.tan((angle * Math.PI) / 180)
  const minAxis = axis === 'x' ? -W / 2 + r : -D / 2 + r
  const bases = [
    [0, 0, 0],
    [0, a / 2, a / 2],
    [a / 2, 0, a / 2],
    [a / 2, a / 2, 0]
  ]
  let bestIdx = -1
  let bestCount = -1
  for (let idx = 0; idx < offsetsList.length; idx++) {
    const off = offsetsList[idx]
    let count = 0
    for (const b of bases) {
      const iMin = Math.ceil((minX - (off.ox + b[0])) / a)
      const iMax = Math.floor((maxX - (off.ox + b[0])) / a)
      const kMin = Math.ceil((minZ - (off.oz + b[2])) / a)
      const kMax = Math.floor((maxZ - (off.oz + b[2])) / a)
      for (let i = iMin; i <= iMax; i++) {
        for (let k = kMin; k <= kMax; k++) {
          const x = off.ox + i * a + b[0]
          const z = off.oz + k * a + b[2]
          const axisCoord = axis === 'x' ? x : z
          const minYLocal = r + tan * (axisCoord - minAxis)
          const jMin = Math.ceil((minYLocal - (off.oy + b[1])) / a)
          const jMax = Math.floor((maxY - (off.oy + b[1])) / a)
          if (jMax >= jMin) count += (jMax - jMin + 1)
        }
      }
    }
    if (count > bestCount) {
      bestCount = count
      bestIdx = idx
    }
  }
  self.postMessage({ bestIdx, bestCount })
}
