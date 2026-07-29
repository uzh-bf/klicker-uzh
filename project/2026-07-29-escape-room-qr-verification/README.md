# QR scan browser verification

- Date: 2026-07-29
- Branch: `codex/escape-room-qr`
- Environment: isolated `codex-escape-room-qr` DevPod
- Manage URL: `https://manage.klicker.codex-escape-room-qr.localhost`
- Browser: `agent-browser` 0.32.2 with delegated local development login

The verification used the synthetic element “QR verification station” in the
isolated development database. No production or personal data was used.

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
