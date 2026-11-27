# Artifact starter styling

`styles.css` is generated from Tailwind CSS 4.3.3. Run
`pnpm --filter @klicker-uzh/artifact-pilot styles` after changing the supported
classes, then check parity with `pnpm --filter @klicker-uzh/artifact-pilot
styles:check`.

The generator reads the UZH blue/grey, primary, background and foreground values
from `apps/frontend-manage/src/globals.css`. It uses Source Sans 3 when installed
locally, then the browser's accessible system sans-serif stack. The generated
stylesheet has no font download or data URL. Generated rules are scoped under
`.uzh-artifact`, so the artifact does not load a stylesheet, font or other
resource from the network.

Supported starter utilities cover surface and text colors, responsive padding,
a centered constrained card, blue headings, form typography, rounded borders,
numeric results and visible keyboard focus. The exact candidates come from
`starter-style.mjs`; add a class there before using it in the renderer.

The canonical standalone document and `frame()` both inline the same
`styles.css`. The frame policy allows only that stylesheet's SHA-256 hash while
retaining `default-src 'none'`. The standalone starter source stays below
16 KiB.
