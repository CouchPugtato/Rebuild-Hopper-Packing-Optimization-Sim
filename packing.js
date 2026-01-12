const SQRT3 = Math.sqrt(3)

function buildALayer(W, D, r) {
  const rows = []
  let j = 0
  while (true) {
    const z = r + j * r * SQRT3
    if (z > D - r) break
    const xStart = r + (j % 2 ? r : 0)
    const row = []
    let i = 0
    while (true) {
      const x = xStart + i * 2 * r
      if (x > W - r) break
      row.push({ x, z })
      i++
    }
    rows.push(row)
    j++
  }
  return rows
}

function buildBCentroids(rows) {
  const centroids = []
  for (let j = 0; j < rows.length - 1; j++) {
    const rowA = rows[j]
    const rowB = rows[j + 1]
    const m = Math.min(rowA.length - 1, rowB.length)
    for (let i = 0; i < m; i++) {
      const p0 = rowA[i]
      const p1 = rowA[i + 1]
      const p2 = rowB[i]
      const cx = (p0.x + p1.x + p2.x) / 3
      const cz = (p0.z + p1.z + p2.z) / 3
      centroids.push({ x: cx, z: cz })
    }
  }
  return centroids
}

export function packHCP(dims, r) {
  const W = dims.width
  const H = dims.height
  const D = dims.depth
  const rowsA = buildALayer(W, D, r)
  const layerA = rowsA.flat()
  const layerB = buildBCentroids(rowsA)
  const yStep = 2 * r * Math.sqrt(2 / 3)
  const positions = []
  let k = 0
  while (true) {
    const y = r + k * yStep
    if (y > H - r) break
    const isA = k % 2 === 0
    const base = isA ? layerA : layerB
    for (const p of base) positions.push({ x: p.x - W / 2, y, z: p.z - D / 2 })
    k++
  }
  return positions
}

