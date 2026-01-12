import { createScene } from './scene.js'
import { state } from './state.js'
import { buildBox, boundsFromDims } from './box.js'
import { packHCP } from './packing.js'
import { setupUI } from './ui.js'

const app = document.getElementById('app')
const boxDimsEl = document.getElementById('boxDims')
const ballInfoEl = document.getElementById('ballInfo')

const { scene, camera, renderer, controls, THREE } = createScene(app)

let boxMesh = null
let boxEdges = null

function updateHUD(count) {
  const w = state.box.width
  const h = state.box.height
  const d = state.box.depth
  boxDimsEl.textContent = `Box: ${w} in × ${h} in × ${d} in`
  ballInfoEl.textContent = `Balls: ${count}`
}

function rebuild() {
  if (boxMesh) scene.remove(boxMesh)
  if (boxEdges) scene.remove(boxEdges)
  const box = buildBox(scene, state.box)
  boxMesh = box.mesh
  boxEdges = box.edges
  if (state.ballsGroup) scene.remove(state.ballsGroup)
  const group = new THREE.Group()
  const r = state.ballDiameter / 2
  const positions = packHCP(state.box, r)
  for (const p of positions) {
    const geo = new THREE.SphereGeometry(r, 48, 32)
    const mat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.1 })
    const m = new THREE.Mesh(geo, mat)
    m.position.set(p.x, p.y, p.z)
    group.add(m)
  }
  state.ballsGroup = group
  scene.add(group)
  updateHUD(positions.length)
}

setupUI(state, rebuild)
rebuild()

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
