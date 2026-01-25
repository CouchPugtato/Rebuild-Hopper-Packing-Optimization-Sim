const CLOSE_PACKING_DENSITY = Math.PI / Math.sqrt(18)

export function packingMetrics(dims, r, count) {
  const volBox = dims.width * dims.height * dims.depth
  const volBall = (4 / 3) * Math.PI * Math.pow(r, 3)
  const totalBallVol = count * volBall
  return {
    fraction: totalBallVol / volBox,
    theoreticalMax: CLOSE_PACKING_DENSITY
  }
}

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
  for (const b of bases) {
    const iMin = Math.ceil((minX - (offsets.ox + b[0])) / a)
    const iMax = Math.floor((maxX - (offsets.ox + b[0])) / a)
    const jMin = Math.ceil((minY - (offsets.oy + b[1])) / a)
    const jMax = Math.floor((maxY - (offsets.oy + b[1])) / a)
    const kMin = Math.ceil((minZ - (offsets.oz + b[2])) / a)
    const kMax = Math.floor((maxZ - (offsets.oz + b[2])) / a)
    for (let i = iMin; i <= iMax; i++) {
      for (let j = jMin; j <= jMax; j++) {
        for (let k = kMin; k <= kMax; k++) {
          const x = offsets.ox + i * a + b[0]
          const y = offsets.oy + j * a + b[1]
          const z = offsets.oz + k * a + b[2]
          positions.push({ x, y, z })
        }
      }
    }
  }
  return positions
}

export function countFCC(dims, r, offsets = { ox: 0, oy: 0, oz: 0 }) {
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
  let count = 0
  const bases = [
    [0, 0, 0],
    [0, a / 2, a / 2],
    [a / 2, 0, a / 2],
    [a / 2, a / 2, 0]
  ]
  for (const b of bases) {
    const iMin = Math.ceil((minX - (offsets.ox + b[0])) / a)
    const iMax = Math.floor((maxX - (offsets.ox + b[0])) / a)
    const jMin = Math.ceil((minY - (offsets.oy + b[1])) / a)
    const jMax = Math.floor((maxY - (offsets.oy + b[1])) / a)
    const kMin = Math.ceil((minZ - (offsets.oz + b[2])) / a)
    const kMax = Math.floor((maxZ - (offsets.oz + b[2])) / a)
    count += (iMax - iMin + 1) * (jMax - jMin + 1) * (kMax - kMin + 1)
  }
  return count
}

export function packFCCArray(dims, r, offsets = { ox: 0, oy: 0, oz: 0 }) {
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
  const total = countFCC(dims, r, offsets)
  if (total > 100_000_000) {
    throw new Error(`Too many items to pack: ${total}. Check box dimensions and units.`)
  }
  const arr = new Float32Array(total * 3)
  let idx = 0
  for (const b of bases) {
    const iMin = Math.ceil((minX - (offsets.ox + b[0])) / a)
    const iMax = Math.floor((maxX - (offsets.ox + b[0])) / a)
    const jMin = Math.ceil((minY - (offsets.oy + b[1])) / a)
    const jMax = Math.floor((maxY - (offsets.oy + b[1])) / a)
    const kMin = Math.ceil((minZ - (offsets.oz + b[2])) / a)
    const kMax = Math.floor((maxZ - (offsets.oz + b[2])) / a)
    for (let i = iMin; i <= iMax; i++) {
      for (let j = jMin; j <= jMax; j++) {
        for (let k = kMin; k <= kMax; k++) {
          arr[idx++] = offsets.ox + i * a + b[0]
          arr[idx++] = offsets.oy + j * a + b[1]
          arr[idx++] = offsets.oz + k * a + b[2]
        }
      }
    }
  }
  return arr
}

function slopeParams(dims, r, slope) {
  const angle = (slope && slope.slopeAngleDeg) ? slope.slopeAngleDeg : 0
  const axis = (slope && slope.slopeAxis) ? slope.slopeAxis : 'x'
  const tan = Math.tan((angle * Math.PI) / 180)
  const minAxis = axis === 'x' ? -dims.width / 2 : -dims.depth / 2
  const span = axis === 'x' ? dims.width : dims.depth
  const maxRise = tan * span
  return { tan, axis, minAxis, maxRise }
}

export function countFCCSlope(dims, r, offsets = { ox: 0, oy: 0, oz: 0 }, slope) {
  const a = 2 * Math.SQRT2 * r
  const W = dims.width
  const H = dims.height
  const D = dims.depth
  const minX = -W / 2 + r
  const maxX = W / 2 - r
  const maxY = H - r
  const minZ = -D / 2 + r
  const maxZ = D / 2 - r
  const { tan, axis, minAxis } = slopeParams(dims, r, slope)
  let count = 0
  const bases = [
    [0, 0, 0],
    [0, a / 2, a / 2],
    [a / 2, 0, a / 2],
    [a / 2, a / 2, 0]
  ]
  for (const b of bases) {
    const iMin = Math.ceil((minX - (offsets.ox + b[0])) / a)
    const iMax = Math.floor((maxX - (offsets.ox + b[0])) / a)
    const kMin = Math.ceil((minZ - (offsets.oz + b[2])) / a)
    const kMax = Math.floor((maxZ - (offsets.oz + b[2])) / a)
    for (let i = iMin; i <= iMax; i++) {
      for (let k = kMin; k <= kMax; k++) {
        const x = offsets.ox + i * a + b[0]
        const z = offsets.oz + k * a + b[2]
        const axisCoord = axis === 'x' ? x : z
        const minYLocal = r + tan * (axisCoord - minAxis)
        const jMin = Math.ceil((minYLocal - (offsets.oy + b[1])) / a)
        const jMax = Math.floor((maxY - (offsets.oy + b[1])) / a)
        if (jMax >= jMin) count += (jMax - jMin + 1)
      }
    }
  }
  return count
}

export function packFCCArraySlope(dims, r, offsets = { ox: 0, oy: 0, oz: 0 }, slope) {
  const a = 2 * Math.SQRT2 * r
  const W = dims.width
  const H = dims.height
  const D = dims.depth
  const minX = -W / 2 + r
  const maxX = W / 2 - r
  const maxY = H - r
  const minZ = -D / 2 + r
  const maxZ = D / 2 - r
  const bases = [
    [0, 0, 0],
    [0, a / 2, a / 2],
    [a / 2, 0, a / 2],
    [a / 2, a / 2, 0]
  ]
  const { tan, axis, minAxis } = slopeParams(dims, r, slope)
  const total = countFCCSlope(dims, r, offsets, slope)
  if (total > 100_000_000) {
    throw new Error(`Too many items to pack: ${total}. Check box dimensions and units.`)
  }
  const arr = new Float32Array(total * 3)
  let idx = 0
  for (const b of bases) {
    const iMin = Math.ceil((minX - (offsets.ox + b[0])) / a)
    const iMax = Math.floor((maxX - (offsets.ox + b[0])) / a)
    const kMin = Math.ceil((minZ - (offsets.oz + b[2])) / a)
    const kMax = Math.floor((maxZ - (offsets.oz + b[2])) / a)
    for (let i = iMin; i <= iMax; i++) {
      for (let k = kMin; k <= kMax; k++) {
        const x = offsets.ox + i * a + b[0]
        const z = offsets.oz + k * a + b[2]
        const axisCoord = axis === 'x' ? x : z
        const minYLocal = r + tan * (axisCoord - minAxis)
        const jMin = Math.ceil((minYLocal - (offsets.oy + b[1])) / a)
        const jMax = Math.floor((maxY - (offsets.oy + b[1])) / a)
        for (let j = jMin; j <= jMax; j++) {
          arr[idx++] = x
          arr[idx++] = offsets.oy + j * a + b[1]
          arr[idx++] = z
        }
      }
    }
  }
  return arr
}

export class SpatialHash {
  constructor(triangles, cellSize) {
    this.cellSize = cellSize
    this.map = new Map()
    this.triangles = triangles 
    
    let gMinX = Infinity, gMaxX = -Infinity, gMinZ = Infinity, gMaxZ = -Infinity
    
    for (let i = 0; i < triangles.length; i += 9) {
      const minX = Math.min(triangles[i], triangles[i+3], triangles[i+6])
      const maxX = Math.max(triangles[i], triangles[i+3], triangles[i+6])
      const minZ = Math.min(triangles[i+2], triangles[i+5], triangles[i+8])
      const maxZ = Math.max(triangles[i+2], triangles[i+5], triangles[i+8])
      
      if (minX < gMinX) gMinX = minX
      if (maxX > gMaxX) gMaxX = maxX
      if (minZ < gMinZ) gMinZ = minZ
      if (maxZ > gMaxZ) gMaxZ = maxZ

      const startX = Math.floor(minX / cellSize)
      const endX = Math.floor(maxX / cellSize)
      const startZ = Math.floor(minZ / cellSize)
      const endZ = Math.floor(maxZ / cellSize)

      for (let x = startX; x <= endX; x++) {
        for (let z = startZ; z <= endZ; z++) {
          const key = (x|0) + ',' + (z|0)
          let list = this.map.get(key)
          if (!list) {
            list = []
            this.map.set(key, list)
          }
          list.push(i)
        }
      }
    }
    console.log(`[Worker] SpatialHash built. Triangles: ${triangles.length/9}, Bounds X: [${gMinX.toFixed(2)}, ${gMaxX.toFixed(2)}], Z: [${gMinZ.toFixed(2)}, ${gMaxZ.toFixed(2)}]`)
  }

  get(x, z) {
    const key = Math.floor(x / this.cellSize) + ',' + Math.floor(z / this.cellSize)
    return this.map.get(key)
  }
}

function getIntersections(x, z, triangles, candidateIndices) {
  const hits = []
  if (!candidateIndices) return hits
  
  for (const tIdx of candidateIndices) {
    const x1 = triangles[tIdx], y1 = triangles[tIdx+1], z1 = triangles[tIdx+2]
    const x2 = triangles[tIdx+3], y2 = triangles[tIdx+4], z2 = triangles[tIdx+5]
    const x3 = triangles[tIdx+6], y3 = triangles[tIdx+7], z3 = triangles[tIdx+8]

    const det = (z2 - z3) * (x1 - x3) + (x3 - x2) * (z1 - z3)
    if (Math.abs(det) < 1e-9) continue

    const l1 = ((z2 - z3) * (x - x3) + (x3 - x2) * (z - z3)) / det
    const l2 = ((z3 - z1) * (x - x3) + (x1 - x3) * (z - z3)) / det
    const l3 = 1 - l1 - l2

    const EPS = 1e-7
    if (l1 >= -EPS && l1 <= 1 + EPS && l2 >= -EPS && l2 <= 1 + EPS && l3 >= -EPS && l3 <= 1 + EPS) {
      const y = l1 * y1 + l2 * y2 + l3 * y3
      const ny = (z2-z1)*(x3-x1) - (x2-x1)*(z3-z1)
      hits.push({ y, ny })
    }
  }
  
  hits.sort((a, b) => a.y - b.y)
  
  const uniqueHits = []
  if (hits.length > 0) {
      uniqueHits.push(hits[0])
      for (let i = 1; i < hits.length; i++) {
          if (hits[i].y - hits[i-1].y > 1e-5) {
              uniqueHits.push(hits[i])
          }
      }
  }
  return uniqueHits
}

export function countFCCGeometry(dims, r, offsets, spatialHash, packMode = 'solid', flipNormals = false) {
  const a = 2 * Math.SQRT2 * r
  const W = dims.width
  const H = dims.height
  const D = dims.depth
  const minX = -W / 2 + r
  const maxX = W / 2 - r
  const minZ = -D / 2 + r
  const maxZ = D / 2 - r
  
  let count = 0
  let maxGap = 0
  let totalRays = 0
  let totalHits = 0
  
  const bases = [
    [0, 0, 0],
    [0, a / 2, a / 2],
    [a / 2, 0, a / 2],
    [a / 2, a / 2, 0]
  ]

  for (const b of bases) {
    const iMin = Math.ceil((minX - (offsets.ox + b[0])) / a)
    const iMax = Math.floor((maxX - (offsets.ox + b[0])) / a)
    const kMin = Math.ceil((minZ - (offsets.oz + b[2])) / a)
    const kMax = Math.floor((maxZ - (offsets.oz + b[2])) / a)
    
    if (count === 0 && offsets.ox === 0 && offsets.oy === 0 && b === bases[0]) {
       console.log(`[Worker] Checking base 0. Range X: ${iMin}..${iMax}, Z: ${kMin}..${kMax}`)
       const centerX = (minX + maxX)/2
       const centerZ = (minZ + maxZ)/2
       const hits = getIntersections(centerX, centerZ, spatialHash.triangles, spatialHash.get(centerX, centerZ))
       console.log(`[Worker] Center Ray (${centerX.toFixed(2)}, ${centerZ.toFixed(2)}) Hits:`, hits)
    }

    for (let i = iMin; i <= iMax; i++) {
      for (let k = kMin; k <= kMax; k++) {
        const x = offsets.ox + i * a + b[0]
        const z = offsets.oz + k * a + b[2]
        
        totalRays++
        const candidates = spatialHash.get(x, z)
        const hits = getIntersections(x, z, spatialHash.triangles, candidates)
        if (hits.length > 0) totalHits++
        
        const boundaries = hits.map(h => h.y)
        let currentY = -Infinity
        
        if (packMode === 'solid') {
             for (let k = 0; k <= boundaries.length; k++) {
                const nextY = k < boundaries.length ? boundaries[k] : Infinity
                
                const isSolidRegion = (k % 2 !== 0)
                
                if (isSolidRegion) {
                     const boxMin = 0
                     const boxMax = H
                     const effBottom = Math.max(currentY, boxMin)
                     const effTop = Math.min(nextY, boxMax)
                     
                     if (effTop > effBottom) {
                          const gap = effTop - effBottom
                          if (gap > maxGap) maxGap = gap
                          
                          const validMinY = effBottom + r
                          const validMaxY = effTop - r
                          
                          const jMin = Math.ceil((validMinY - (offsets.oy + b[1])) / a)
                          const jMax = Math.floor((validMaxY - (offsets.oy + b[1])) / a)
                          
                          if (jMax >= jMin) count += (jMax - jMin + 1)
                     }
                }
                currentY = nextY
            }
        } else {
            let isPacking = false
            for (let k = 0; k <= hits.length; k++) {
                 const startY = k === 0 ? -Infinity : hits[k-1].y
                 const endY = k === hits.length ? Infinity : hits[k].y
                 
                 if (isPacking) {
                     const boxMin = 0
                     const boxMax = H
                     const effBottom = Math.max(startY, boxMin)
                     const effTop = Math.min(endY, boxMax)
                     
                     if (effTop > effBottom) {
                          const gap = effTop - effBottom
                          if (gap > maxGap) maxGap = gap
                          
                          const validMinY = effBottom + r
                          const validMaxY = effTop - r
                          
                          const jMin = Math.ceil((validMinY - (offsets.oy + b[1])) / a)
                          const jMax = Math.floor((validMaxY - (offsets.oy + b[1])) / a)
                          
                          if (jMax >= jMin) count += (jMax - jMin + 1)
                     }
                 }
                 
                 if (k < hits.length) {
                     const hit = hits[k]
                     let ny = hit.ny
                     if (flipNormals) ny = -ny
                     
                     if (ny > 1e-6) isPacking = true
                     else if (ny < -1e-6) isPacking = false
                 }
            }
        }
      }
    }
  }
  
  if (count === 0 && offsets.ox === 0 && offsets.oy === 0) {
      console.log(`[Worker] Stats: ${totalRays} rays, ${totalHits} rays hit geometry. MaxGap: ${maxGap}`)
  }
  
  return { count, maxGap }
}

export function packFCCArrayGeometry(dims, r, offsets, spatialHash, packMode = 'solid', flipNormals = false) {
  const a = 2 * Math.SQRT2 * r
  const W = dims.width
  const H = dims.height
  const D = dims.depth
  const minX = -W / 2 + r
  const maxX = W / 2 - r
  const minZ = -D / 2 + r
  const maxZ = D / 2 - r
  
  const bases = [
    [0, 0, 0],
    [0, a / 2, a / 2],
    [a / 2, 0, a / 2],
    [a / 2, a / 2, 0]
  ]

  const { count: total } = countFCCGeometry(dims, r, offsets, spatialHash, packMode, flipNormals)
  if (total > 100_000_000) {
     throw new Error(`Too many items to pack: ${total}`)
  }
  const arr = new Float32Array(total * 3)
  let idx = 0
  
  for (const b of bases) {
    const iMin = Math.ceil((minX - (offsets.ox + b[0])) / a)
    const iMax = Math.floor((maxX - (offsets.ox + b[0])) / a)
    const kMin = Math.ceil((minZ - (offsets.oz + b[2])) / a)
    const kMax = Math.floor((maxZ - (offsets.oz + b[2])) / a)
    
    for (let i = iMin; i <= iMax; i++) {
      for (let k = kMin; k <= kMax; k++) {
        const x = offsets.ox + i * a + b[0]
        const z = offsets.oz + k * a + b[2]
        
        const candidates = spatialHash.get(x, z)
        const hits = getIntersections(x, z, spatialHash.triangles, candidates)
        
        const boundaries = hits.map(h => h.y)
        let currentY = -Infinity
        
        if (packMode === 'solid') {
             for (let k = 0; k <= boundaries.length; k++) {
                const nextY = k < boundaries.length ? boundaries[k] : Infinity
                
                const isSolidRegion = (k % 2 !== 0)
                
                if (isSolidRegion) {
                     const boxMin = 0
                     const boxMax = H
                     const effBottom = Math.max(currentY, boxMin)
                     const effTop = Math.min(nextY, boxMax)
                     
                     if (effTop > effBottom) {
                          const validMinY = effBottom + r
                          const validMaxY = effTop - r
                          
                          const jMin = Math.ceil((validMinY - (offsets.oy + b[1])) / a)
                          const jMax = Math.floor((validMaxY - (offsets.oy + b[1])) / a)
                          
                          for (let j = jMin; j <= jMax; j++) {
                              if (idx < arr.length) {
                                 arr[idx++] = x
                                 arr[idx++] = offsets.oy + j * a + b[1]
                                 arr[idx++] = z
                              }
                          }
                     }
                }
                currentY = nextY
            }
        } else {
            let isPacking = false
            for (let k = 0; k <= hits.length; k++) {
                 const startY = k === 0 ? -Infinity : hits[k-1].y
                 const endY = k === hits.length ? Infinity : hits[k].y
                 
                 if (isPacking) {
                     const boxMin = 0
                     const boxMax = H
                     const effBottom = Math.max(startY, boxMin)
                     const effTop = Math.min(endY, boxMax)
                     
                     if (effTop > effBottom) {
                          const validMinY = effBottom + r
                          const validMaxY = effTop - r
                          
                          const jMin = Math.ceil((validMinY - (offsets.oy + b[1])) / a)
                          const jMax = Math.floor((validMaxY - (offsets.oy + b[1])) / a)
                          
                          for (let j = jMin; j <= jMax; j++) {
                              if (idx < arr.length) {
                                 arr[idx++] = x
                                 arr[idx++] = offsets.oy + j * a + b[1]
                                 arr[idx++] = z
                              }
                          }
                     }
                 }
                 
                 if (k < hits.length) {
                     const hit = hits[k]
                     let ny = hit.ny
                     if (flipNormals) ny = -ny

                     if (ny > 1e-6) isPacking = true
                     else if (ny < -1e-6) isPacking = false
                 }
            }
        }
      }
    }
  }
  return arr
}
