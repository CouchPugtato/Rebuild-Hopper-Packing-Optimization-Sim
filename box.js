import * as THREE from 'three'

export function buildBox(scene, dims) {
  const w = dims.width
  const h = dims.height
  const d = dims.depth
  const geo = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshStandardMaterial({ color: 0x134e4a, transparent: true, opacity: 0.15, side: THREE.BackSide })
  const mesh = new THREE.Mesh(geo, mat)
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x7dd3fc }))
  mesh.position.set(0, h / 2, 0)
  edges.position.copy(mesh.position)
  scene.add(mesh)
  scene.add(edges)
  return { mesh, edges }
}

export function boundsFromDims(dims) {
  const w = dims.width
  const h = dims.height
  const d = dims.depth
  return {
    minX: -w / 2,
    maxX: w / 2,
    minY: 0,
    maxY: h,
    minZ: -d / 2,
    maxZ: d / 2
  }
}
