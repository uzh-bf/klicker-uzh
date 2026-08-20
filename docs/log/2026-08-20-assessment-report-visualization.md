---
title: Assessment comparison visualization
date: 2026-08-20
---

# Assessment comparison visualization

The verified-credential assessment report now presents its privacy-preserving
score groups as equal-width categorical bars. Numeric gaps between ranges no
longer make the grouping look arbitrary. The student's containing range stays
highlighted, and the exact range/count table remains available below the
graphic.

The percentile is shown as a marker on a 0–100 ruler in the verification view
and in the self-contained export SVG. Its meaning remains inclusive: the
percentage of active participants whose score is less than or equal to the
student's score. The ruler communicates position without assuming a normal
distribution.

The comparison data contract and privacy thresholds are unchanged. The final
histogram endpoint still represents the available total points, while the
achieved and available totals remain explicit in the score table.

Validation evidence for this change is recorded in the task plan and commits:
focused comparison semantics tests pass, and the PWA typecheck passes in the
task runtime. Browser screenshot proof and the final repository checks remain
required before delivery.
