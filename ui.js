import GUI from 'https://unpkg.com/lil-gui@0.18/dist/lil-gui.esm.js'

export function setupUI(state, onChange) {
  const gui = new GUI({ title: 'Rebuild-Hopper-Packing-Optimization-Sim' })
  const boxFolder = gui.addFolder('Box (inches)')
  boxFolder.add(state.box, 'width', 1, 30, 1).name('Width').onChange(onChange)
  boxFolder.add(state.box, 'height', 1, 30, 1).name('Height').onChange(onChange)
  boxFolder.add(state.box, 'depth', 1, 30, 1).name('Depth').onChange(onChange)
  boxFolder.open()
  const ballsFolder = gui.addFolder('Balls')
  ballsFolder.add(state, 'ballDiameter', 2, 48, 0.5).name('Diameter (in)').onChange(onChange)
  ballsFolder.open()
  return gui
}
