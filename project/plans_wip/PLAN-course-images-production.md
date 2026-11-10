# Course-image integration and qualification

Goal: carry manifest-bound original figures, captions and per-page printed labels from document processing through resource ingestion, retrieval and saved Chat answers. Optional generated descriptions retain their provenance; they do not imply pixel inspection or verified numerical facts.

Existing Chatbot, KnowledgeBase, KBResource and participant-owned ChatThread/ChatMessage boundaries apply. Image access additionally requires the current chatbot KB scope and active, non-deleted resource version. `Participation.isActive` is unrelated to access. This package introduces no schema migration, ranking change or automatic backfill.

## Source preparation

Deliver the consolidated [PR #6312](https://github.com/uzh-bf/klicker-uzh/pull/6312) against `v3-ai`. Its five feature components remain:

1. Contracts: validated descriptors, bounded request-local selection, verified Blob/filesystem reader, authenticated image route and opt-in Helm storage configuration.
2. Display: register the tool with configured storage and scoped search; render selected images with verified page labels.
3. Inline captions: resolve placement markers against saved selections and retain original caption metadata.
4. Generated descriptions: preserve bounded multiline text and model/input/asset provenance; drop malformed optional metadata without dropping the image.
5. Viewer: bind citations to the selected figure's source and provide keyboard-accessible zoom and Fit controls.

Blob storage uses the full configured object prefix, defaulting to `projection`. Mounted filesystem fixtures remain root-relative. Every object for one selection comes from the generation resolved by its verified manifest. Retain digest, exact-length and ETag checks.

Local qualification selects staged CPU processing with descriptions off. Ingestion owns the local Azurite service and development account; the processor owns its dedicated `doc-processing` container. The host processor and containerized Chat reader use their respective endpoints for that same account, container and `projection` prefix. Klicker's upload storage and MinIO remain separate. Setup and startup order ingestion before document processing; shutdown reverses that dependency. Processor readiness requires its actual CPU workflow registration and selected Blob-store observation.

Run package tests, type checking, lint and builds after affected integration. Render the enabled and disabled chart with synthetic values. These checks establish source compatibility; browser and pipeline qualification remain separate.

## Dependency-ordered release gates

| Gate | Required evidence |
| --- | --- |
| Processor candidate | Current processing behavior retained; fresh extraction-cache identity; staged manifest, captions, page labels and optional description provenance; installed candidate client and legacy-client compatibility |
| Client publication | Separately approved processor merge/publication; immutable released client version and digest; ingestion dependency and lockfile updated to that release |
| Candidate qualification | Exact locally built consumer commits plus approved processor artifact; bounded synthetic environment and model budget; complete matrix below |
| Merge | Passing required CI and reviews on the exact heads; backend target/promotion policy resolved; explicit approval for target merges and their automatic effects |
| Merged-artifact qualification | Repeat release-critical cases using resulting merged artifact digests; record runtime/configuration provenance and stop the task environment |

Keep the storage configuration disabled until compatible artifacts and qualification are ready. Publishing a client, deploying services, paid processing and reingesting retained resources require separately named authority. Production activation and a bounded real-course backfill follow the merged-artifact gate. Recording playback remains a separate package; if it enters the target first, recheck the overlapping Markdown/tool wiring.

## End-to-end matrix

Use a test-owned corpus with distinct physical/printed page labels, original figures/captions, a native chart, a text-only document and another KB's figure. Use synthetic lecturer/participant accounts and record each service revision, package digest and storage generation.

| Case | Required outcome |
| --- | --- |
| Lecturer upload to answer | Processing uses staged publication; retrieval carries the correct resource/version descriptor; selected authenticated PNG matches the source, page and digest |
| Persistence and viewer | Reload retains the same figure and citation; desktop/mobile and English/German work; zoom, Fit, Escape and focus restoration are actionable |
| Isolation | Foreign KB/user, forged or unselected asset and removed KB binding are denied without storage access |
| Resource lifecycle | Replacement invalidates the old selection and retrieves the new version; withdrawal denies old image requests and new retrieval |
| Fallback and upgrade | Corrupt/missing objects fail clearly; text fallback cannot pass a positive-image case; a synthetic old text-only resource upgrades through an explicit supported reingestion path |
| Selection and descriptions | Text-only requests remain text-only; unsupported figures are not fabricated; multiline provenance round-trips; optional paid generation has its own approved profile and usage cap |

The existing Chat browser suite mocks its response stream. It can verify presentation but cannot establish processing, model selection, retrieval or Blob lifecycle. Test harness behavior stays outside production application code. Live vector payload limits and figure-dense documents also need qualification before rollout.

## Current reconciliation — 2026-11-10

The user approved reconciling local work with Pascal's latest source and preparing the candidate for E2E testing, stopping before merges. The source baseline is `695421f7f642398680d20debf1f74d7014a50c0b`. Preserve Pascal's `useCourseImageUrl` / `loadCourseImageUrl` implementation, the resource-selection validation and citation fixes. Carry the existing repeated-selection marker, structured prompt-contract checks and browser transport regression forward without replacing his loader.

The existing `playwright/util/chat.ts` seed helper now accepts JSON tool results, so the browser regression can store the same structured selection shape as Chat rather than an MCP-only result envelope. It mints a correctly scoped synthetic embed token; image failures remain active until Retry, making the test independent of initial effect replay. This batch includes focused test cleanup and the verified proactive-selection wording clarification. Run container-backed source checks and the host-run browser transport regression against the task's synthetic local application. Zero-product-model-call runtime activation is within this approved candidate-preparation batch. Model-backed connected E2E still requires the exact provider, call/cost/retry envelope. No target merge, release, deployment, real-course backfill or new description/pixel inspection is included.

Backend targets have advanced at relevant processing/retrieval seams. The connected candidate must bind compatible source and artifact identities and settle retrieval's `main` versus `dev` landing policy before claiming full E2E readiness. Existing SDK and staged-source receipts remain reusable only within their recorded scope. The public mocked-Chat suite and transport test do not establish real processing, vector retrieval or resource lifecycle acceptance.

Verification: the reconciled candidate passes all 1,891 Chat tests with 33 existing service-dependent skips, 124 focused checks, Chat typechecking and lint (warnings only), plus 62 local-KB contract tests and the focused source scan. All 42 root check tasks, seven lint tasks, formatting and 99 local-KB contract checks pass; all 27 production build tasks pass. Independent scoped source review and its focused correction pass with no remaining findings. New-head CI remains pending publication. Actual-app browser verification is blocked by the branch lacking the fresh-bootstrap provider contract; no retained database was reset. The initial `695421f7f6` required CI does not cover these new corrections.

## Authenticated figure-loading correction

The protected image route already accepts scoped bearer authentication. Cookie-unavailable LMS sessions keep that token in sessionStorage, which direct browser image requests cannot read. Load each card through `authedFetch` and share one temporary object URL with the viewer. Keep the original source URL and retry attempt in state so stale responses cannot replace a newer resource. Abort unfinished requests and revoke created object URLs on cleanup. HTTP failure retains the existing unavailable/retry UI; retry makes a new authenticated request. URLs and tokens remain transient and never enter persisted message content or query strings. Server ownership, current KB/resource-version checks and immutable artifact validation remain intact.

Return `placement_marker` consistently on repeated successful selection and replace prompt-prose assertions with structured behavior checks in the existing suites. Add focused browser transport coverage to the existing Chat E2E spec; test-owned responses isolate missing bearer authentication, retry, shared card/viewer URLs and reload. Actual Blob upload through the complete pipeline remains a separate acceptance requirement.

Progress — 2026-11-10: the viewer checkout is fast-forwarded to `695421f7f6`. Five non-overlapping local paths applied cleanly; the old component implementation remains in a verified local backup. Candidate preparation is active under the user's explicit stop-before-merge instruction. Focused source checks pass; actual-application browser checks remain pending. No merged-artifact or connected lifecycle success is claimed.

The retained viewer runtime refused startup because its stored schema differs from the candidate. Its database is preserved. Verification now uses a fresh isolated checkout at `trees/rs/course-images-e2e-candidate`, branch `rs/course-images-e2e-candidate`, based on `695421f7f6`; ordinary non-force delivery still targets the existing PR branch. The original viewer worktree and patch backups remain intact. This is a local verification checkout, not a new PR or stack layer.

The installed provider rejects guarded initialization with `--initialize-new requires managedRuntime.devcontainer.freshBootstrap`. Related fresh-initialization support exists in separate [PR #6773](https://github.com/uzh-bf/klicker-uzh/pull/6773), which is still open; it is not silently folded into the course-image PR. Browser execution must use a qualified isolated runtime or current-head CI. The test container remains usable for source checks. Full upload-to-Chat E2E still requires compatible backend artifacts and the approved model-call envelope.

Candidate source is reconciled and verified locally but remains uncommitted. The native commit scanner flags an unchanged synthetic custom-mode fixture that is already allowlisted by the repository scanner. The repository-configured scan passes; the user explicitly approved a one-commit native-hook exception after verification. Normal repository hooks still apply. Branch publication, new-head CI, target merge and live E2E success remain pending. The complete feature still needs its integrated delivery review; the current Opus review covers this reconciliation and supplied surrounding context.

Publication checkpoint: the user approved the native-scanner exception and a non-destructive Devrouter repair. The task-local repair recovers the original ensure profile after completed same-profile commands, preserving all existing ownership and container checks. Focused lifecycle tests, full unit tests and independent review pass. Canonical stop succeeded and the provider reported stopped; the same containers and mount bindings were retained when reopened. No global CLI replacement or data deletion occurred. Normal commit/push hooks and new-head CI remain pending. Local browser startup still requires qualified fresh-bootstrap support; no connected E2E success is claimed.
