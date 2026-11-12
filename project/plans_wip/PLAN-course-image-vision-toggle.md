# Optional visual inspection of retrieved course figures

## Goal

Integrate the bounded demo preview path into the existing picture-description
PR (#6309), behind `CHAT_COURSE_IMAGE_VISION_ENABLED=true` (unset means off).
Operators can compare selected chat models before any default-on rollout.

## Scope and boundaries

- Entities: participant, chatbot, scoped KB, READY resource/version, retrieved
  figure occurrence. Existing participant authentication and mode scope apply.
- Chat server only: prompt templates, tool guidance, per-step model messages,
  runtime flag, tests and documentation. No schema, GraphQL, UI, i18n,
  gamification, Hatchet, model-registry or backend descriptor changes.
- Require both explicit opt-in and the selected model's image capability.
  Off preserves existing messages and description-only instructions.
- Read at most three distinct occurrences in retrieval order, from successful
  current-turn searches. Check resource lifecycle before the existing bounded,
  digest/manifest/PNG-validated reader. Failed previews fall back to text.
- Downsize validated PNGs to bounded previews. Attach them only to their
  corresponding model-facing tool result; do not persist binary previews or
  grant display access. Display selection and its three-image budget stay intact.
- Same model and continuation; no separate ranking/vision request. Keep original
  captions and generated descriptions. Never claim unseen figures were inspected.
- Preserve demo dirty work, retained services, and the five-layer native stack.
  Normal pushes for review only; no PR merges, deployment, re-ingestion or paid
  evaluations. Backend MRs receive integration notes, not needless code changes.

## Verification

Synthetic tests: default-off/model gate, scope and lifecycle denial, bounded
reads/dimensions, current-turn-only projection, citation preservation, no binary
persistence, real SDK-to-Responses serialization, and truthful prompts.
Rerun the Azure reader and concurrent-selection regressions, full Chat suite,
type/lint/build checks and hooks where the local environment permits.
Earlier demo evaluations are supporting evidence, not production qualification.

## Progress

- Verified current remote stack and ownership; clean review checkout advanced
  to #6309 head `6dc9e777e8`. Processor !88 is merged; !181/!90 remain open.
- Managed verification bootstrap found an installed devrouter version older
  than this checkout's declared configuration. Used pinned devrouter 0.5.1 and
  a separate Azurite port (11013); no demo services were changed.
- Integrated model-capability gating, current-resource authorization, bounded
  preview projection, prompt templates and documentation. Backend wire contracts
  remain unchanged.
- Focused vision/Azure/selection/compiler tests: 108 pass. Final prompt tests:
  52 pass. Chat type checking and lint pass (pre-existing lint warnings).
- The normal full Chat suite passes 1,769 tests with 33 service-dependent skips.
  Its first run exposed leaked browser globals at next-file import time. Added
  after-test global cleanup to the Node harness without changing assertions.
- A diagnostic isolated-worker run overlapped generated-package builds and hit
  Prisma resolution failures; it is superseded by the final normal-suite pass.
- Repository-wide build/check defaults exhausted local memory in Manage and
  GraphQL. Keep the hooks active, with a checkout-scoped temporary launcher that
  gives child Node processes 4 GiB and schedules root build/check tasks serially.
  Final hook/push evidence and remote CI status are recorded in the PR bodies.
- Host workflow contract tests require `mapfile`, unavailable in macOS Bash 3.
  Installed Bash 5 and selected it only through the hook command's temporary
  PATH; no workflow assertions or hooks were disabled.
- Private experiment fixtures, outputs and retained demo configuration remain
  outside the review diff. Production lifecycle and default-on qualification
  remain separate release gates.
