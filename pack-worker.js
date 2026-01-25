import { countFCC, countFCCSlope, countFCCGeometry, SpatialHash, packFCCArrayGeometry } from './packing.js'

self.onmessage = function (e) {
  const { type, dims, r, offsetsList, slope, triangles, cellSize, packMode, flipNormals, optimizationMethod, annealingSteps, optimizeOffsets } = e.data

  if (type === 'geometry') {
    handleGeometry(dims, r, offsetsList, triangles, cellSize, packMode, flipNormals, optimizationMethod, annealingSteps, optimizeOffsets)
  } else {
    handleBox(dims, r, offsetsList, slope)
  }
}

function handleBox(dims, r, offsetsList, slope) {
  let bestIdx = -1
  let bestCount = -1
  
  const list = offsetsList && offsetsList.length > 0 ? offsetsList : [{ ox: 0, oy: 0, oz: 0 }]

  for (let idx = 0; idx < list.length; idx++) {
    const off = list[idx]
    let count = 0
    if (slope && slope.slopeAngleDeg > 0) {
      count = countFCCSlope(dims, r, off, slope)
    } else {
      count = countFCC(dims, r, off)
    }

    if (count > bestCount) {
      bestCount = count
      bestIdx = idx
    }
  }
  
  self.postMessage({ bestIdx, bestCount })
}

function handleGeometry(dims, r, offsetsList, triangles, cellSize, packMode, flipNormals, optimizationMethod, annealingSteps, optimizeOffsets) {
  console.log('[Worker] Geometry mode started', { packMode, flipNormals, triangleCount: triangles.length/9 })
  
  if (optimizeOffsets === false) {
     const sh = new SpatialHash(triangles, cellSize)
     const off = { ox: 0, oy: 0, oz: 0 }
     const { count, maxGap } = countFCCGeometry(dims, r, off, sh, packMode, flipNormals)
     let positions = null
     if (count > 0) positions = packFCCArrayGeometry(dims, r, off, sh, packMode, flipNormals)
     
     self.postMessage({ 
        bestCount: count, 
        positions, 
        rotation: 0, 
        offset: off, 
        maxGap 
     })
     return
  }

  const sh = new SpatialHash(triangles, cellSize)

  let globalBest = {
    count: -1,
    offset: { ox: 0, oy: 0, oz: 0 },
    maxGap: 0
  }

  const list = offsetsList && offsetsList.length > 0 ? offsetsList : [{ ox: 0, oy: 0, oz: 0 }]
  
  for (const off of list) {
     const { count, maxGap } = countFCCGeometry(dims, r, off, sh, packMode, flipNormals)
     
     if (maxGap > globalBest.maxGap) globalBest.maxGap = maxGap

     if (count > globalBest.count) {
       globalBest.count = count
       globalBest.offset = off
     }
  }

  let positions = null
  if (globalBest.count > 0) {
    positions = packFCCArrayGeometry(dims, r, globalBest.offset, sh, packMode, flipNormals)
  }

  self.postMessage({ 
    bestCount: globalBest.count, 
    positions: positions,
    rotation: 0,
    offset: globalBest.offset,
    maxGap: globalBest.maxGap
  })
}
