import GUI from 'https://unpkg.com/lil-gui@0.18/dist/lil-gui.esm.js'

export function setupUI(state, onBoxChange, onPack) {
  const gui = new GUI({ title: 'Rebuild-Hopper-Packing-Optimization-Sim' })
  const boxFolder = gui.addFolder('Box (inches)')
  boxFolder.add(state.box, 'width', 1, 30, 1).name('Width').onChange(onBoxChange)
  boxFolder.add(state.box, 'height', 1, 30, 1).name('Height').onChange(onBoxChange)
  boxFolder.add(state.box, 'depth', 1, 30, 1).name('Depth').onChange(onBoxChange)
  boxFolder.open()
  const ballsFolder = gui.addFolder('Balls')
  ballsFolder.add(state, 'ballDiameter', 2, 48, 0.5).name('Diameter (in)').onChange(onBoxChange)
  ballsFolder.add(state, 'optimizeOffsets').name('Optimize Offsets').onChange(onBoxChange)
  ballsFolder.add({ pack: () => onPack() }, 'pack').name('Pack Balls')
  ballsFolder.open()
  return gui
}
