import GUI from 'https://unpkg.com/lil-gui@0.18/dist/lil-gui.esm.js'

export function setupUI(state, onBoxChange) {
  if (window.__sim_gui) window.__sim_gui.destroy()
  const gui = new GUI({ title: 'Rebuild-Hopper-Packing-Optimization-Sim' })
  window.__sim_gui = gui
  const unitsFolder = gui.addFolder('Units')
  unitsFolder.add(state, 'units', ['imperial', 'metric']).name('Units').onChange(() => {
    onBoxChange()
    try { window.__sim_gui.destroy() } catch {}
    setupUI(state, onBoxChange)
  })
  unitsFolder.open()
  const factor = state.units === 'metric' ? 2.54 : 1
  const unitLabel = state.units === 'metric' ? 'cm' : 'in'
  const boxFolder = gui.addFolder(`Box (${unitLabel})`)
  const boxUI = {
    width: state.box.width * factor,
    height: state.box.height * factor,
    depth: state.box.depth * factor
  }
  boxFolder.add(boxUI, 'width', 1 * factor, 30 * factor, 1 * factor).name('Width').onChange(v => {
    state.box.width = v / factor
    onBoxChange()
  })
  boxFolder.add(boxUI, 'height', 1 * factor, 30 * factor, 1 * factor).name('Height').onChange(v => {
    state.box.height = v / factor
    onBoxChange()
  })
  boxFolder.add(boxUI, 'depth', 1 * factor, 30 * factor, 1 * factor).name('Depth').onChange(v => {
    state.box.depth = v / factor
    onBoxChange()
  })
  boxFolder.open()
  const ballsFolder = gui.addFolder('Balls')
  const ballsUI = { diameter: state.ballDiameter * factor }
  ballsFolder.add(ballsUI, 'diameter', 5 * factor, 7 * factor, 0.5 * factor).name(`Diameter (${unitLabel})`).onChange(v => {
    state.ballDiameter = v / factor
    onBoxChange()
  })
  ballsFolder.add(state, 'optimizeOffsets').name('Optimize Offsets').onChange(onBoxChange)
  ballsFolder.open()
  return gui
}
