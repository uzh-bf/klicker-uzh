# Exam Studio proposal: architecture and lecturer journey

These diagrams explain the [proposed integration](../PLAN-internal-librechat-exam-studio.md).
**Existing** means a capability observed in the plan's public Klicker source
baseline; it does not mean that a live LibreChat integration has been verified.
**Proposed** means work still to implement and qualify. The boundaries are
conceptual, with no real deployment addresses or topology.

## Architecture and trust boundaries

[Open full-size architecture image](./architecture.png) ·
[Download interactive HTML](./architecture.html) · [Editable specification](./architecture.json)

![Proposed internal path from LibreChat through per-user delegation and lecturer MCP to Klicker authoring and the question bank; browser login and consent are a separate boundary.](./architecture.png)

The lecturer uses browser-reachable Klicker login and the **proposed** account-link
and consent bridge. The trusted backend exchanges a server-side grant for a
short-lived, resource-bound per-user Klicker token. The browser and model never
receive a reusable MCP credential. MCP checks identity, scope and each object;
internal reachability alone grants no authority. Grant revocation and bounded
expiry are required additions.

LibreChat presents the interaction. The internal lecturer MCP delegates to
Klicker's canonical authoring services. Existing persistent generation, review
gates, cost accounting and atomic Keep are reused; the Exam tool surface,
strict delegation, immutable revision history and durable action receipts are
proposed extensions. The existing Element bank remains the source of truth.
Browser login/consent does not require public MCP data ingress.

## Lecturer journey and revision-safe Keep

[Open full-size lecturer journey](./lecturer-flow.png) ·
[Download interactive HTML](./lecturer-flow.html) · [Editable specification](./lecturer-flow.json)

![Lecturer selects an authorized KB, approves cost, runs KG generation with review gates, inspects and optionally edits a draft, keeps an exact revision, and reopens it with persistent AI origin and separate review status.](./lecturer-flow.png)

Read the flow left to right on the top row, right to left on the middle row,
then left to right on the bottom row. KB means knowledge base; KG means
knowledge graph. Initial authoring is owner-scoped, with SC, MC and KPRIM
formats. Selecting a course or tag does not grant source access.

1. Select an authorized KB and pin the source/graph version, objectives,
   language, format, count and target difficulty.
2. Confirm the estimate and maximum spend through a trusted human action.
   Reuse durable jobs, quota reservations and the design/plan review gates.
   A dispatch timeout requires status reconciliation before any new paid run.
3. Inspect the full question, answer key, explanation, authorized evidence
   and flags. Compare and edit if needed; editing is optional.
4. Keep the exact displayed revision. Existing Keep verifies owner, terminal
   build state, expected revision and full payload in one transaction. Extend
   that same transaction to include origin, immutable revision and review/action
   receipts. A stale revision requires reload/compare and fresh confirmation.
   An identical consumed-revision retry returns the saved Element; a changed
   payload conflicts. This is a per-item guarantee, not atomic batch saving.
5. Reopen the saved Element in the normal bank. The proposed AI-origin label
   remains visible independently of review status.
6. Optional later edits/copies retain origin. Export can also proceed without
   an edit: only exact currently accepted revisions qualify, with visible
   origin and a manifest. No automatic publication or student-data flow is implied.

| Example after implementation | Persistent origin | Review applicability |
| --- | --- | --- |
| Generated draft, revision 1 | AI-generated | Unreviewed |
| Human accepts revision 3 | AI-generated | Accepted for revision 3 |
| Human changes content, creating revision 4 | AI-generated; optionally Human-edited | Needs review for revision 4 |
| Copy, activity snapshot or supported export | Retain AI origin | Preserve the applicable exact-version evidence; do not infer new approval |

The bank already exists. The first-class origin badge, its inheritance, exact-version
history/review and export manifest are **proposed**, including where the diagram
shows them on existing surfaces. Human acceptance never changes AI origin.
Unknown legacy origin remains UNKNOWN unless deterministic evidence supports a
backfill. Private source details are not required to display the origin label.

## Evidence and reproduction

Facts come only from the public plan, especially sections 2–8 and 14–16.
No private repository, producer compatibility detail, runtime inventory or real
course/student data was used. Host and worker qualification remain future work.

Both views use the local Archify 2.16 architecture renderer; the second is a
user-flow composition. Each passes all **9/9 showcase checks, zero errors and
zero warnings**. Local Chrome containment/readability checks passed at
1440×900, 1600×1000, 1920×1080 and 2048×1320. Light and dark captures were
visually inspected after one visual correction round. The PNGs are unmodified
2048×1320 light screenshots of the delivered HTML.

Portable receipts record the exact specification/HTML SHA-256 hashes and
viewport results: [architecture](./architecture.receipt.json) and
[lecturer journey](./lecturer-flow.receipt.json).

Download the HTML and open it locally for zoom, search and theme controls;
GitHub displays the PNGs but does not execute repository HTML. All diagram
content, scripts and SVG are inline. The viewer may load an optional Google
font; system monospace fallback is available offline. No external rendering
or AI service is used.

From this directory, with `ARCHIFY_DIR` pointing to the local skill:

```sh
node "$ARCHIFY_DIR/bin/archify.mjs" validate architecture architecture.json --quality showcase --json
node "$ARCHIFY_DIR/bin/archify.mjs" deliver architecture architecture.json architecture.html --quality showcase --json
node "$ARCHIFY_DIR/bin/archify.mjs" visual-check architecture.html --json
node "$ARCHIFY_DIR/bin/archify.mjs" validate architecture lecturer-flow.json --quality showcase --json
node "$ARCHIFY_DIR/bin/archify.mjs" deliver architecture lecturer-flow.json lecturer-flow.html --quality showcase --json
node "$ARCHIFY_DIR/bin/archify.mjs" visual-check lecturer-flow.html --json
```

No application tests, deployment verification, token exchange or live generation
were run for this documentation-only visualization change.
