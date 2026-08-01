# QR scan browser verification

- Date: 2026-07-29
- Branch: `codex/escape-room-qr`
- Environment: isolated `codex-escape-room-qr` DevPod
- Manage URL: `https://manage.klicker.codex-escape-room-qr.localhost`
- Browser: `agent-browser` 0.32.2 with delegated local development login

The verification used the synthetic element “QR verification station” in the
isolated development database. No production or personal data was used.

## Evidence provenance

The screenshots were captured on the earlier QR foundation commits
`fcba60802` and `70ac45ec1`; they are historical evidence for authoring,
printing, ownership, and decoy rendering, not proof of the Layer 1 corrective
changes currently under review.

The current-tip browser recheck on 2026-08-01 is blocked on this host. The
managed runtime could not start because `devrouter ensure` could not determine
the process identity for the workspace lifecycle lock, and `devrouter ls`
could not access `/Users/rschlae/.orbstack/run/docker.sock` (`EPERM`). The
primary and linked Manage URLs therefore returned no HTTP response. A fresh
`agent-browser` run against the corrective commit is still required once the
DevPod/Docker runtime is available.

## Evidence

| File | Verified state |
| --- | --- |
| `01-qr-authoring-en-desktop.png` | QR Scan can be selected and authored in the English Manage UI at 1440×1000. |
| `02-qr-edit-owner-print-en-desktop.png` | The exact owner sees the print-sheet launcher and scoring controls, without the unsupported sample-solution toggle. |
| `03-qr-print-en-desktop.png` | The English print view renders the correct sheet plus three shuffled decoys. |
| `04-qr-print-de-mobile.png` | The German print view renders at 390×844 with localized controls and stacked cards. |

The decoy control was also changed from three to five in the browser. The page
then rendered six stations, confirming that the requested decoy count controls
the final card count.

Authorization and placement boundaries are covered by focused GraphQL service
tests: only the exact owner may query answer-bearing print data, and QR elements
are rejected from practice quizzes, microlearnings, group activities, live
quizzes, and live-quiz templates until the escape-room runtime layer lands.
