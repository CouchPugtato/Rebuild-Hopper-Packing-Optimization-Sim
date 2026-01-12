package main

import (
	"math"
	"syscall/js"
)

func sampleOffsets(period float64, samples int) []float64 {
	out := make([]float64, samples)
	for i := 0; i < samples; i++ {
		out[i] = period * float64(i) / float64(samples)
	}
	return out
}

func packFCCBest(this js.Value, args []js.Value) interface{} {
	width := args[0].Float()
	height := args[1].Float()
	depth := args[2].Float()
	radius := args[3].Float()
	optimize := args[4].Bool()
	samples := args[5].Int()

	a := 2.0 * math.Sqrt2 * radius
	minX := -width/2.0 + radius
	maxX := width/2.0 - radius
	minY := radius
	maxY := height - radius
	minZ := -depth/2.0 + radius
	maxZ := depth/2.0 - radius

	bases := [4][3]float64{
		{0, 0, 0},
		{0, a / 2, a / 2},
		{a / 2, 0, a / 2},
		{a / 2, a / 2, 0},
	}

	phasesX := []float64{0}
	phasesY := []float64{0}
	phasesZ := []float64{0}
	if optimize {
		phasesX = sampleOffsets(a, samples)
		phasesY = sampleOffsets(a, samples)
		phasesZ = sampleOffsets(a, samples)
	}

	var best [][3]float32
	for _, oxPhase := range phasesX {
		for _, oyPhase := range phasesY {
			for _, ozPhase := range phasesZ {
				ox := oxPhase - width/2.0 + radius
				oy := oyPhase + radius
				oz := ozPhase - depth/2.0 + radius
				var positions [][3]float32
				for _, b := range bases {
					iMin := int(math.Ceil((minX - (ox + b[0])) / a))
					iMax := int(math.Floor((maxX - (ox + b[0])) / a))
					jMin := int(math.Ceil((minY - (oy + b[1])) / a))
					jMax := int(math.Floor((maxY - (oy + b[1])) / a))
					kMin := int(math.Ceil((minZ - (oz + b[2])) / a))
					kMax := int(math.Floor((maxZ - (oz + b[2])) / a))
					for i := iMin; i <= iMax; i++ {
						for j := jMin; j <= jMax; j++ {
							for k := kMin; k <= kMax; k++ {
								x := ox + float64(i)*a + b[0]
								y := oy + float64(j)*a + b[1]
								z := oz + float64(k)*a + b[2]
								positions = append(positions, [3]float32{float32(x), float32(y), float32(z)})
							}
						}
					}
				}
				if len(positions) > len(best) {
					best = positions
				}
			}
		}
	}

	arr := js.Global().Get("Float32Array").New(len(best) * 3)
	idx := 0
	for _, p := range best {
		arr.SetIndex(idx, p[0])
		arr.SetIndex(idx+1, p[1])
		arr.SetIndex(idx+2, p[2])
		idx += 3
	}
	return arr
}

func main() {
	js.Global().Set("pack_fcc_best_go", js.FuncOf(packFCCBest))
	select {}
}
