# Course-image integration and qualification

Goal: carry manifest-bound original figures, captions and per-page printed labels from document processing through resource ingestion, retrieval and saved Chat answers. Optional generated descriptions retain their provenance; they do not imply pixel inspection or verified numerical facts.

Existing Chatbot, KnowledgeBase, KBResource and participant-owned ChatThread/ChatMessage boundaries apply. Image access additionally requires the current chatbot KB scope and active, non-deleted resource version. `Participation.isActive` is unrelated to access. This package introduces no schema migration, ranking change or automatic backfill.

## Source preparation

Preserve the five existing Chat layers on `v3-ai`, integrating parents upward with ordinary merges:

1. Contracts: validated descriptors, bounded request-local selection, verified Blob/filesystem reader, authenticated image route and opt-in Helm storage configuration.
2. Display: register the tool with configured storage and scoped search; render selected images with verified page labels.
3. Inline captions: resolve placement markers against saved selections and retain original caption metadata.
4. Generated descriptions: preserve bounded multiline text and model/input/asset provenance; drop malformed optional metadata without dropping the image.
5. Viewer: bind citations to the selected figure's source and provide keyboard-accessible zoom and Fit controls.

Blob storage uses the full configured object prefix, defaulting to `projection`. Mounted filesystem fixtures remain root-relative. Every object for one selection comes from the generation resolved by its verified manifest. Retain digest, exact-length and ETag checks.

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

## Current preparation evidence

Source preparation repairs the Blob prefix and chart wiring, preserves multiline description metadata, and reconciles the stack with current Chat behavior. Local deterministic tests and builds are recorded in the PR descriptions. Browser qualification is pending because the task's managed Docker runtime could not allocate a network. No deployment, publication, backfill or full pipeline E2E is claimed.
