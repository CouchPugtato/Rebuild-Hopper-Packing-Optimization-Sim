import { createScene } from './scene.js'
import { state } from './state.js'
import { buildBox, boundsFromDims } from './box.js'
import { packingMetrics, packFCCArray, packFCCArraySlope, SpatialHash, packFCCArrayGeometry } from './packing.js'
import { setupUI } from './ui.js'

const app = document.getElementById('app')
const boxDimsEl = document.getElementById('boxDims')
const ballInfoEl = document.getElementById('ballInfo')

const { scene, camera, renderer, controls, THREE } = createScene(app)

let boxMesh = null
let boxEdges = null
let currentPackId = 0
let activeWorkers = []

function updateHUD(count, metrics) {
  const factor = state.units === 'metric' ? 2.54 : 1
  const unitLabel = state.units === 'metric' ? 'cm' : 'in'
  const w = state.box.width * factor
  const h = state.box.height * factor
  const d = state.box.depth * factor
  boxDimsEl.textContent = `Box: ${w} ${unitLabel} × ${h} ${unitLabel} × ${d} ${unitLabel}`
  const frac = metrics ? metrics.fraction : 0
  const theo = metrics ? metrics.theoreticalMax : 0
  ballInfoEl.textContent = `Balls: ${count}  |  Packing fraction: ${(frac * 100).toFixed(2)}% (max ~ ${(theo * 100).toFixed(2)}%)`
}

function rebuildBox() {
  if (boxMesh) scene.remove(boxMesh)
  if (boxEdges) scene.remove(boxEdges)
  const box = buildBox(scene, { ...state.box, slopeAngleDeg: state.slopeAngleDeg, slopeAxis: state.slopeAxis })
  boxMesh = box.mesh
  boxEdges = box.edges
  const count = state.ballsCount || 0
  const metrics = count ? packingMetrics(state.box, state.ballDiameter / 2, count) : null
  updateHUD(count, metrics)
}

function handleBoundaryChange() {
  rebuildBox()
  packBalls()
}

function packBalls() {
  const overlay = document.getElementById('loading')
  overlay.style.display = 'block'
  setTimeout(() => {
    const myId = ++currentPackId
    for (const w of activeWorkers) try { w.terminate() } catch {}
    activeWorkers = []
    removeCurrentGroup()
    const r = state.ballDiameter / 2
    const slope = { slopeAxis: state.slopeAxis, slopeAngleDeg: state.slopeAngleDeg }
    
    const offsets = []
    if (state.optimizeOffsets) {
      const a = 2 * Math.SQRT2 * r
      const samples = 6
      const xs = Array.from({ length: samples }, (_, i) => (a * i) / samples)
      const ys = xs
      const zs = xs
      for (let i = 0; i < xs.length; i++) {
        for (let j = 0; j < ys.length; j++) {
          for (let k = 0; k < zs.length; k++) {
            offsets.push({
              ox: xs[i] - state.box.width / 2 + r,
              oy: ys[j] + r,
              oz: zs[k] - state.box.depth / 2 + r
            })
          }
        }
      }
    } else {
      offsets.push({ ox: 0, oy: 0, oz: 0 })
    }

    if (state.customMesh && state.triangles) {
      console.log('Packing with custom geometry (Worker)...')
      const worker = new Worker('./pack-worker.js', { type: 'module' })
      activeWorkers.push(worker)
      
      let tMinY = Infinity, tMaxY = -Infinity
      for(let i=1; i<state.triangles.length; i+=3) {
          if(state.triangles[i] < tMinY) tMinY = state.triangles[i]
          if(state.triangles[i] > tMaxY) tMaxY = state.triangles[i]
      }
      console.log(`Sending triangles to worker. Y range: ${tMinY.toFixed(4)} to ${tMaxY.toFixed(4)}. Box Height: ${state.box.height.toFixed(4)}`)

      worker.onmessage = e => {
        if (myId !== currentPackId) {
            try { worker.terminate() } catch {}
            return
        }
        const { bestCount, positions, rotation, offset, maxGap } = e.data
        console.log('Geometry Worker Result', { bestCount, rotation, offset, maxGap })
        
        if (positions && positions.length > 0) {
            finalize(positions, r, myId)
        } else {
            console.warn('No positions returned from worker')
            
            const ballSize = r * 2
            const minDim = Math.min(state.box.width, state.box.height, state.box.depth)
            
            if (minDim < ballSize) {
                alert(`No balls packed. The model dimensions (${state.box.width.toFixed(2)} x ${state.box.height.toFixed(2)} x ${state.box.depth.toFixed(2)}) are smaller than the ball diameter (${ballSize.toFixed(2)}). The ball is too big to fit!`)
            } else {
                 let msg = `No balls packed. The model dimensions (${state.box.width.toFixed(2)} x ${state.box.height.toFixed(2)} x ${state.box.depth.toFixed(2)}) seem large enough.`
                 
                 if (maxGap > 0) {
                    msg += `\n\nDiagnostic: The largest vertical gap found was ${maxGap.toFixed(2)} inches, but the ball diameter is ${ballSize.toFixed(2)} inches.`
                 } else {
                    msg += `\n\nDiagnostic: No valid vertical gaps were found (maxGap=0).`
                 }
                 
                 msg += `\n\nTry reducing the Ball Diameter, or switch 'Pack Mode' to 'void' in the Balls settings if your model is a container.`
                 alert(msg)
            }

            finalize(new Float32Array(0), r, myId)
        }
        worker.terminate()
      }
      
      worker.onerror = err => {
         console.error('Worker error:', err)
         alert('Packing worker failed: ' + err.message)
         worker.terminate()
         document.getElementById('loading').style.display = 'none'
      }
      
      worker.postMessage({
        type: 'geometry',
        dims: state.box,
        r,
        offsetsList: offsets,
        triangles: state.triangles,
        cellSize: state.ballDiameter * 2,
        packMode: state.packMode,
        flipNormals: state.flipNormals,
        optimizeOffsets: state.optimizeOffsets
      })
      return
    }

    const workers = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 4) - 2))
    const chunkSize = Math.ceil(offsets.length / workers)
    console.log('Offset search start', { candidates: offsets.length, workers, chunkSize })
    let globalBest = { idx: -1, count: -1 }
    let resolved = 0
    
    for (let w = 0; w < workers; w++) {
      const start = w * chunkSize
      const end = Math.min(offsets.length, start + chunkSize)
      const list = offsets.slice(start, end)
      const worker = new Worker('./pack-worker.js', { type: 'module' })
      activeWorkers.push(worker)
      
      worker.onmessage = e => {
        const { bestIdx, bestCount } = e.data
        if (myId !== currentPackId) {
          try { worker.terminate() } catch {}
          return
        }
        if (bestCount > globalBest.count) {
          globalBest = { idx: start + bestIdx, count: bestCount }
        }
        resolved++
        worker.terminate()
        
        if (resolved === workers) {
          const bestOff = globalBest.idx !== -1 ? offsets[globalBest.idx] : { ox: 0, oy: 0, oz: 0 }
          try {
            const arr = state.slopeAngleDeg > 0 ? packFCCArraySlope(state.box, r, bestOff, slope) : packFCCArray(state.box, r, bestOff)
            finalize(arr, r, myId)
          } catch (e) {
            console.error(e)
            alert(e.message)
            document.getElementById('loading').style.display = 'none'
          }
        }
      }
      worker.postMessage({ type: 'box', dims: state.box, r, offsetsList: list, slope })
    }
  }, 0)

  function finalize(arr, r, myId) {
    if (myId !== currentPackId) return
    const count = arr.length / 3
    if (!count) {
      console.warn('No positions generated')
    }
    const seg = count > 2000 ? 16 : 32
    console.log('Finalize packing', { count, seg })
    const geo = new THREE.SphereGeometry(r, seg, Math.max(12, Math.floor(seg * 0.66)))
    const mat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.1 })
    const inst = new THREE.InstancedMesh(geo, mat, count)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      const x = arr[i * 3]
      const y = arr[i * 3 + 1]
      const z = arr[i * 3 + 2]
      dummy.position.set(x, y, z)
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    }
    inst.instanceMatrix.needsUpdate = true
    state.ballsGroup = inst
    state.ballsCount = count
    scene.add(inst)
    const metrics = packingMetrics(state.box, r, count)
    updateHUD(count, metrics)
    overlay.style.display = 'none'
  }
}

function removeCurrentGroup() {
  if (!state.ballsGroup) return
  try {
    scene.remove(state.ballsGroup)
    if (state.ballsGroup.geometry) state.ballsGroup.geometry.dispose()
    if (state.ballsGroup.material) state.ballsGroup.material.dispose()
  } catch {}
  state.ballsGroup = null
  state.ballsCount = 0
}
setupUI(state, handleBoundaryChange, handleFileChange, handleClear)

function handleClear() {
  if (state.customMesh) {
    scene.remove(state.customMesh)
    state.customMesh.traverse(c => {
      if (c.isMesh) {
        c.geometry.dispose()
        if (c.material) c.material.dispose()
      }
    })
    state.customMesh = null
  }
  state.triangles = null
  state.spatialHash = null
  state.lastUploadedFile = null
  rebuildBox()
  packBalls()
}

async function handleFileChange(file) {
  state.lastUploadedFile = file
  const overlay = document.getElementById('loading')
  overlay.textContent = 'Loading STEP file...'
  overlay.style.display = 'block'
  try {
    const buffer = await file.arrayBuffer()
    const occt = await window.occtimportjs()
    const fileContent = new Uint8Array(buffer)
    const result = occt.ReadStepFile(fileContent)
    
    if (result && result.meshes.length > 0) {
      if (state.customMesh) {
        scene.remove(state.customMesh)
        state.customMesh.traverse(c => {
            if (c.isMesh) {
                c.geometry.dispose()
                if (c.material) c.material.dispose()
            }
        })
        state.customMesh = null
      }

      const group = new THREE.Group()
      let min = new THREE.Vector3(Infinity, Infinity, Infinity)
      let max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)

      let scaleToInches = 1.0
      
      if (state.importUnit !== 'auto') {
        switch (state.importUnit) {
          case 'mm': scaleToInches = 0.0393701; break 
          case 'cm': scaleToInches = 0.393701; break
          case 'm':  scaleToInches = 39.3701; break
          case 'in': scaleToInches = 1.0; break
          case 'ft': scaleToInches = 12.0; break
        }
        console.log(`Using forced unit: ${state.importUnit} (scale: ${scaleToInches})`)
      } else {
        const textDec = new TextDecoder('utf-8')
        const headerSlice = fileContent.subarray(0, 100000)
        const textHeader = textDec.decode(headerSlice).toUpperCase()
        
        console.log('STEP Header sample:', textHeader.slice(0, 500))
        let fileUnit = 'unknown'
        if (/SI_UNIT\s*\(\s*\.MILLI\.\s*,\s*\.METRE\.\s*\)/.test(textHeader)) fileUnit = 'mm'
        else if (/SI_UNIT\s*\(\s*\.CENTI\.\s*,\s*\.METRE\.\s*\)/.test(textHeader)) fileUnit = 'cm'
        else if (/SI_UNIT\s*\(\s*\$\s*,\s*\.METRE\.\s*\)/.test(textHeader)) fileUnit = 'm'
        else if (/CONVERSION_BASED_UNIT\s*\(\s*'INCH'/.test(textHeader)) fileUnit = 'in'
        else if (/CONVERSION_BASED_UNIT\s*\(\s*'FOOT'/.test(textHeader)) fileUnit = 'ft'
        
        console.log(`Header detection: ${fileUnit}. Assuming OCCT output is Millimeters.`)
        
        scaleToInches = 0.0393701 
      }

      const allTriangles = []

      for (const meshData of result.meshes) {
        const geometry = new THREE.BufferGeometry()
        
        const positions = meshData.attributes.position.array
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] *= scaleToInches
            positions[i+1] *= scaleToInches
            positions[i+2] *= scaleToInches

            if (state.fixOrientation) {
                const y = positions[i+1]
                const z = positions[i+2]
                positions[i+1] = z
                positions[i+2] = -y
            }
        }

        if (meshData.index) {
            const idx = meshData.index.array
            for (let i = 0; i < idx.length; i += 3) {
                const a = idx[i] * 3
                const b = idx[i+1] * 3
                const c = idx[i+2] * 3
                allTriangles.push(positions[a], positions[a+1], positions[a+2])
                allTriangles.push(positions[b], positions[b+1], positions[b+2])
                allTriangles.push(positions[c], positions[c+1], positions[c+2])
            }
        } else {
            for (let i = 0; i < positions.length; i++) {
                allTriangles.push(positions[i])
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        
        if (meshData.attributes.normal && !state.fixOrientation) {
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.attributes.normal.array, 3))
        } else {
            geometry.computeVertexNormals()
        }
        
        if (meshData.index) {
             geometry.setIndex(new THREE.Uint16BufferAttribute(meshData.index.array, 1))
        }

        geometry.computeBoundingBox()
        if (geometry.boundingBox) {
            min.min(geometry.boundingBox.min)
            max.max(geometry.boundingBox.max)
        }
        
        const material = new THREE.MeshStandardMaterial({
            color: 0x808080,
            metalness: 0.1,
            roughness: 0.5,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        })
        const mesh = new THREE.Mesh(geometry, material)
        group.add(mesh)
      }

      const size = new THREE.Vector3().subVectors(max, min)
      
      console.log('Imported STEP dimensions (inches):', size)
      if (size.x > 10000 || size.y > 10000 || size.z > 10000) {
        console.warn('Warning: Imported dimensions seem very large. Please check the file units.')
        alert(`Warning: The imported model is very large (${size.x.toFixed(0)} x ${size.y.toFixed(0)} x ${size.z.toFixed(0)} inches). The system might freeze or fail to pack.`)
      }
      
        if (size.x < 1.0 && size.y < 1.0 && size.z < 1.0) {
           console.warn('Warning: Imported dimensions seem very small. Unit detection might have failed.')
           alert(`Warning: The imported model is very small (${size.x.toFixed(4)} x ${size.y.toFixed(4)} x ${size.z.toFixed(4)} inches). Unit detection might have failed (defaulted to Inches). Please check if the file uses Meters or Millimeters.`)
        }

      state.box.width = size.x
      state.box.height = size.y
      state.box.depth = size.z
      state.customMesh = group
      state.triangles = new Float32Array(allTriangles)

      const centerX = (min.x + max.x) / 2
      const centerZ = (min.z + max.z) / 2
      const minY = min.y

      for (let i = 0; i < state.triangles.length; i += 3) {
        state.triangles[i] -= centerX
        state.triangles[i+1] -= minY
        state.triangles[i+2] -= centerZ
      }

      group.position.set(-centerX, -minY, -centerZ)

      state.spatialHash = null
      scene.add(group)
      
      rebuildBox()
      setupUI(state, handleBoundaryChange, handleFileChange, handleClear)
      packBalls()
    }
  } catch (err) {
    console.error(err)
    alert('Error loading STEP file: ' + err.message)
  } finally {
    overlay.style.display = 'none'
  }
}
rebuildBox()
packBalls()

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', onResize)

function tick() {
  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
const dragPlane = new THREE.Plane()
const dragIntersection = new THREE.Vector3()
const dragOffset = new THREE.Vector3()
const dragDummy = new THREE.Object3D()
let draggingId = -1

function onPointerDown(event) {
  if (event.target !== renderer.domElement) return
  if (!state.ballsGroup) return

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObject(state.ballsGroup)

  if (intersects.length > 0) {
    const intersect = intersects[0]
    draggingId = intersect.instanceId
    controls.enabled = false

    state.ballsGroup.getMatrixAt(draggingId, dragDummy.matrix)
    dragDummy.matrix.decompose(dragDummy.position, dragDummy.quaternion, dragDummy.scale)

    const normal = new THREE.Vector3()
    camera.getWorldDirection(normal)
    dragPlane.setFromNormalAndCoplanarPoint(normal, dragDummy.position)

    if (raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
      dragOffset.subVectors(dragDummy.position, dragIntersection)
    }
  }
}

function onPointerMove(event) {
  if (draggingId === -1 || !state.ballsGroup) return

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)

  if (raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
    dragDummy.position.addVectors(dragIntersection, dragOffset)
    dragDummy.updateMatrix()
    state.ballsGroup.setMatrixAt(draggingId, dragDummy.matrix)
    state.ballsGroup.instanceMatrix.needsUpdate = true
  }
}

function onPointerUp() {
  if (draggingId !== -1) {
    draggingId = -1
    controls.enabled = true
  }
}

window.addEventListener('pointerdown', onPointerDown)
window.addEventListener('pointermove', onPointerMove)
window.addEventListener('pointerup', onPointerUp)

tick()
