# Synthetic figure descriptions

These descriptions are reviewer-only human-readable equivalents of the three
core SVG teaching schematics. Never send these descriptions, or any reviewer
observation from `cases.json`, to the model. The SVG files are static vector
diagrams, not screenshots from actual tools and not real protein, alignment,
paper, or experimental evidence.

## `pymol-structure-schematic.svg`

A fictional blue backbone path contains a highlighted orange segment labelled
`S3`. Orange circular markers indicate a display style for the selected
segment. A legend distinguishes the schematic backbone from the selected
display markers, and a note says that distances are not to scale. The drawing
supports discussion of selection and representation only; it does not show a
real structure or establish contact or function.

## `clc-synthetic-alignment.svg`

Three rows named `S1`, `S2`, and `Ref` contain made-up symbol strings with
colored matching cells and visible gaps. The rows are `ACGT-G`, `AC-TTG`, and
`ACGTAG`. A caption calls the drawing a synthetic teaching schematic. The fictional paper claim is supplied separately in the case context, keeping
it distinct from the visual observation that symbols and gaps line up.

## `prism-kinetics-schematic.svg`

The plot uses six synthetic substrate-concentration positions for two series
on a linear x-axis. Series A has displayed rates `0.3, 0.9, 1.6, 2.2, 2.6,
2.8`; Series B has `0.2, 0.6, 1.1, 1.6, 1.9, 2.0`. Both rise, and A appears
to level off higher. The lines are labelled as guides to the eye; there is no
fit, uncertainty, or statistical output. The axes use synthetic units.
