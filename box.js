import * as THREE from 'three'

export function buildBox(scene, dims) {
  const w = dims.width
  const h = dims.height
  const d = dims.depth
  if (scene.userData.slopePlane) {
    try {
      scene.remove(scene.userData.slopePlane)
      scene.userData.slopePlane.geometry.dispose()
      scene.userData.slopePlane.material.dispose()
    } catch {}
    scene.userData.slopePlane = null
  }
  const geo = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshStandardMaterial({ color: 0x134e4a, transparent: true, opacity: 0.15, side: THREE.BackSide })
  const mesh = new THREE.Mesh(geo, mat)
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x7dd3fc }))
  mesh.position.set(0, h / 2, 0)
  edges.position.copy(mesh.position)
  scene.add(mesh)
  scene.add(edges)
  if (dims.slopeAngleDeg && dims.slopeAngleDeg > 0) {
    const angle = (dims.slopeAngleDeg * Math.PI) / 180
    const t = Math.tan(angle)
    let positions
    if (dims.slopeAxis === 'x') {
      positions = new Float32Array([
        -w / 2, 0, -d / 2,
        w / 2, t * w, -d / 2,
        w / 2, t * w, d / 2,
        -w / 2, 0, d / 2
      ])
    } else {
      positions = new Float32Array([
        -w / 2, 0, -d / 2,
        w / 2, 0, -d / 2,
        w / 2, t * d, d / 2,
        -w / 2, t * d, d / 2
      ])
    }
    const idx = new Uint16Array([0, 1, 2, 0, 2, 3])
    const pg = new THREE.BufferGeometry()
    pg.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    pg.setIndex(new THREE.BufferAttribute(idx, 1))
    pg.computeVertexNormals()
    const plane = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.2, side: THREE.DoubleSide }))
    plane.position.set(0, 0, 0)
    scene.add(plane)
    scene.userData.slopePlane = plane
  }
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
