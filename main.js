import { createScene } from './scene.js'
import { state } from './state.js'
import { buildBox, boundsFromDims } from './box.js'
import { packBestFCC, packingMetrics, packFCCArray } from './packing.js'
import { setupUI } from './ui.js'

const app = document.getElementById('app')
const boxDimsEl = document.getElementById('boxDims')
const ballInfoEl = document.getElementById('ballInfo')

const { scene, camera, renderer, controls, THREE } = createScene(app)

let boxMesh = null
let boxEdges = null
let currentPackId = 0
let activeWorkers = []
async function fileExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

async function initGoWasm() {
  try {
    const params = new URLSearchParams(location.search)
    if (!params.has('go') || params.get('go') !== '1') return
    const hasExec = await fileExists('./go/wasm_exec.js')
    const hasWasm = await fileExists('./go/pack_go.wasm')
    if (!hasExec || !hasWasm) return
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = './go/wasm_exec.js'
      s.onload = () => resolve()
      s.onerror = reject
      document.head.appendChild(s)
    })
    const go = new Go()
    const resp = await fetch('./go/pack_go.wasm')
    const result = await WebAssembly.instantiateStreaming(resp, go.importObject)
    go.run(result.instance)
  } catch (e) {
    console.warn('Go WASM init failed', e)
  }
}
initGoWasm()

function updateHUD(count, metrics) {
  const w = state.box.width
  const h = state.box.height
  const d = state.box.depth
  boxDimsEl.textContent = `Box: ${w} in × ${h} in × ${d} in`
  const frac = metrics ? metrics.fraction : 0
  const theo = metrics ? metrics.theoreticalMax : 0
  ballInfoEl.textContent = `Balls: ${count}  |  Packing fraction: ${(frac * 100).toFixed(2)}% (max ~ ${(theo * 100).toFixed(2)}%)`
}

function rebuildBox() {
  if (boxMesh) scene.remove(boxMesh)
  if (boxEdges) scene.remove(boxEdges)
  const box = buildBox(scene, state.box)
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
    const goPack = typeof window !== 'undefined' && window.pack_fcc_best_go
    let arr
    if (goPack) {
      console.log('Using Go WASM packer')
      arr = goPack(state.box.width, state.box.height, state.box.depth, r, state.optimizeOffsets, 6)
    } else if (state.optimizeOffsets) {
      const a = 2 * Math.SQRT2 * r
      const samples = 6
      const xs = Array.from({ length: samples }, (_, i) => (a * i) / samples)
      const ys = xs
      const zs = xs
      const offsets = []
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
      const workers = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 4) - 2))
      const chunkSize = Math.ceil(offsets.length / workers)
      console.log('Offset search start', { candidates: offsets.length, workers, chunkSize })
      let globalBest = { idx: -1, count: -1 }
      let resolved = 0
      for (let w = 0; w < workers; w++) {
        const start = w * chunkSize
        const end = Math.min(offsets.length, start + chunkSize)
        const list = offsets.slice(start, end)
        const worker = new Worker('./pack-worker.js')
        activeWorkers.push(worker)
        worker.onmessage = e => {
          const { bestIdx, bestCount } = e.data
          if (myId !== currentPackId) {
            try { worker.terminate() } catch {}
            return
          }
          console.log('Worker result', { worker: w, localBestIdx: bestIdx, localBestCount: bestCount })
          if (bestCount > globalBest.count) {
            globalBest = { idx: start + bestIdx, count: bestCount }
          }
          resolved++
          worker.terminate()
          if (resolved === workers) {
            if (globalBest.idx === -1) {
              console.warn('No best offset found; falling back to zero offset')
            }
            const bestOff = globalBest.idx !== -1 ? offsets[globalBest.idx] : { ox: 0, oy: 0, oz: 0 }
            arr = packFCCArray(state.box, r, bestOff)
            finalize(arr, r, myId)
          }
        }
        worker.postMessage({ dims: state.box, r, offsetsList: list })
      }
      return
    } else {
      console.log('Optimize offsets disabled; using zero offset')
      arr = packFCCArray(state.box, r, { ox: 0, oy: 0, oz: 0 })
    }
    finalize(arr, r, myId)
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
setupUI(state, handleBoundaryChange)
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
tick()
