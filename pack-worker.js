self.onmessage = function (e) {
  const { dims, r, offsetsList } = e.data
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
      const jMin = Math.ceil((minY - (off.oy + b[1])) / a)
      const jMax = Math.floor((maxY - (off.oy + b[1])) / a)
      const kMin = Math.ceil((minZ - (off.oz + b[2])) / a)
      const kMax = Math.floor((maxZ - (off.oz + b[2])) / a)
      count += (iMax - iMin + 1) * (jMax - jMin + 1) * (kMax - kMin + 1)
    }
    if (count > bestCount) {
      bestCount = count
      bestIdx = idx
    }
  }
  self.postMessage({ bestIdx, bestCount })
}

