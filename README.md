# Rebuild-Hopper-Packing-Optimization-Sim

A lightweight, static web app for visualizing optimized ball packing in a hopper using a FCC lattice, built for the 2026 FRC Rebuild season.

## Features
- Length, width, and heigh sliders
- FCC packing with optional offset optimization
- Sloped base support
- Units toggle (imperial/inches or metric/centimeters)
- Variable ball diameter

## Contributing
Contributions are welcome! Please open a pull request. Keep changes focused and include a short description of the problem or improvement, plus screenshots when relevant. Match the existing code style and keep imports and asset paths relative so the app remains deployable on GitHub Pages. If you modify packing logic (FCC or slope handling), describe the mathematical reasoning and any assumptions.
## Math: FCC Packing (and Slope)
The packing routine treats sphere centers as points on an FCC lattice. If the sphere radius is $r$, the lattice spacing is $a = 2\sqrt{2}\,r$. Each cell uses four basis points,

$$(0,0,0) , (0,\frac{a}{2},\frac{a}{2}),(\frac{a}{2},0,\frac{a}{2}),(\frac{a}{2},\frac{a}{2},0)$$

For a box with width $W$, height $H$, and depth $D$, centers must satisfy 

$$x \in \left[-\frac{W}{2}+r,\ \frac{W}{2}-r\right]$$
$$y \in [r,\ H-r]$$
$$z \in \left[-\frac{D}{2}+r,\ \frac{D}{2}-r\right]$$

When a slope is enabled along axis $x$ or $z$ with angle $\theta$ (degrees), we compute $\tan\theta = \tan(\theta \pi / 180)$ and set $\text{minAxis} = -\frac{W}{2}$ for $x$ or $-\frac{D}{2}$ for $z$. The minimum allowed center height becomes:

$$
y_{\text{localMin}} = r + \tan\theta * ( \text{axisCoord} - \text{minAxis} )
$$

where $\text{axisCoord}=x$ for an $x$-slope or $z$ otherwise. Packing proceeds by iterating integer lattice indices $(i,j,k)$ for each basis, forming centers given by:

$$
(x,y,z) = \text{offset} + (i * a,j * a,k * a) + \text{basis}
$$

For each candidate center, we apply the box bounds and the slope rule above; if it passes, that sphere is included. Optionally, we sample several phase offsets of the lattice and choose the offset that yields the most valid centers. Finally, all accepted centers are rendered as a single instanced mesh for efficiency, and previous computations are cancelled and cleaned up when inputs change.
