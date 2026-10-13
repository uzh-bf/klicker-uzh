# Generated-question similarity against the lecturer library


## Shared quiz-pool contract — 12 October 2026

QP1 extends the existing snapshot producer with explicit `{ schemaVersion: 2 }`
opt-in. Existing callers still emit schema 1. Schema 2 preserves opaque source
identity (`klicker`, element ID, version), nullable correctness and per-choice
feedback, and declares `owned_active_library` scope and comparison-only use.
It uses the existing authorized query, bounds, canonical serialization and
immutable artifact transport. A lecturer-wide library is not a same-course
exemplar pool. No new database access path or runtime toggle is introduced.

The paired worker change in !35 validates this representation and normalizes
existing file-import records into the same content contract. It reuses !34/!35's
semantic scorer. Examples, empirical calibration, reuse and update remain the
subsequent QP2/QP3 work; format-adapter qualification remains QP4. Legacy hashes
and no-pool behavior retain compatibility. Deploy a compatible worker before
activating schema 2 at a caller; this slice does not activate it.

Validation: 12 producer tests pass in an isolated container harness with real
Prisma enums and a stub for unrelated graph access. Both schemas retain the
artifact byte cap. A synthetic snapshot emitted by the actual TypeScript
producer passes the Python worker model and existing comparison-record builder.
Biome passes for the changed source and tests. Full monorepo type/build checks
remain the PR CI obligation; these focused checks do not replace them.


## Goal

Warn a lecturer during question-generation review when a newly planned SC, MC,
or KPRIM question is semantically similar to an existing question owned by that
lecturer. Detect meaning-level overlap even when wording and distractors differ,
while keeping the result advisory and reviewable.

This follows the same-build semantic comparison introduced by worker MR !34.
It extends that mechanism with an immutable, permission-scoped reference
snapshot supplied by Klicker.

## Recommended first slice

- Compare against non-deleted, non-archived `Element` records owned by the
  authenticated `User`.
- Include `DRAFT`, `REVIEW`, and `READY` elements of type `SC`, `MC`, or `KPRIM`.
- Compare across those three supported question types, not only the generated
  type, because equivalent questions can use different response formats.
- Exclude shared and dependency-derived elements. Sending another lecturer's
  content to the generation worker is a separate product and data-boundary
  decision.
- Do not infer a course scope. `Element` is the reusable library source;
  `ElementInstance` is a placement snapshot in an activity, not a course-owned
  question.
- Emit warnings only. Do not block, discard, regenerate, or rewrite questions.
- Reuse the existing plan-review warning and acknowledgement UI.

## Non-goals

- Comparing with shared elements or questions owned by another lecturer.
- A course selector or activity-specific comparison scope.
- Automatic deduplication, deletion, rewriting, or acceptance decisions.
- Comparing against generated drafts that have not been kept as `Element`
  records.
- Building a persistent vector index in the first slice.
- Deploying, changing staging data, or calibrating a production threshold in
  this plan.

## Domain and authorization

- The actor is the authenticated lecturer `User`; generation retains the
  existing `asUserFullAccess` and AI-preview capability checks.
- The comparison corpus contains owned `Element` records only
  (`ownerId = ctx.user.sub`). It does not use `DerivedPermission`, so readable
  shared content cannot enter the snapshot accidentally.
- `ElementInstance` is out of scope. It contains an activity-time copy and
  would create duplicate and stale comparison records.
- The snapshot contains the minimum useful semantic representation: element
  id, version, type, name, stem/content, and normalized choices including which
  choices are correct. Exclude feedback, tags, statistics, activity placement,
  owner identity, and participant data. This describes schema 1; the optional
  schema-2 contract above additionally preserves choice feedback.
- Gamification is unaffected: no points, XP, responses, or leaderboards change.

## Cross-repository contract

Klicker owns authorization and snapshot creation. The content-generation worker
owns embeddings, similarity scoring, and warning production.

1. At build preparation, Klicker queries the eligible owned `Element` records
   in deterministic order and serializes a versioned
   `question_library_snapshot` artifact.
2. Klicker uploads the artifact create-only, stores its artifact reference on
   `ElementGenerationBuild`, and includes the reference in a new version of the
   Hatchet start payload. Retries reuse the same pinned snapshot even if the
   live library changes.
3. The worker validates the artifact hash, schema, row count, text lengths, and
   supported element types before use.
4. The worker embeds the external references once, compares each planned
   question with the references, and does not perform library-to-library
   comparisons.
5. A score at or above
   `QUESTION_LIBRARY_SEMANTIC_REVIEW_THRESHOLD` produces a structured
   `LIBRARY_SEMANTIC_OVERLAP` warning containing the generated question id,
   matched element id/version, and score. The default starts at `0.79`, matching
   the synthetic pilot for MR !34, but remains independently configurable.
6. Klicker maps the structured warning into the existing
   `QuestionGenerationWarning { code, message }` review model. Approval still
   requires explicit warning acknowledgement.

The snapshot size has a configurable hard safety limit,
`KB_QUESTION_LIBRARY_COMPARISON_MAX_ELEMENTS`, initially `500`. Selection is by
`updatedAt DESC, id DESC`. If eligible elements exceed the limit, the plan must
also show `LIBRARY_COMPARISON_TRUNCATED`; the feature must not imply that the
entire library was checked. Synthetic benchmarks at 100, 500, and 2,000
references decide whether to raise the default or proceed to a persistent
embedding index.

## Layer footprint

### KlickerUZH

- `packages/prisma`: add the immutable library-snapshot artifact reference to
  `ElementGenerationBuild`; create a migration and sync the analytics schema.
- `packages/types`: define the snapshot and structured warning contracts.
- `packages/graphql`: create/validate/upload the snapshot, extend start-payload
  schema and fingerprinting, parse worker warnings, and test authorization,
  filtering, deterministic truncation, and retry reuse.
- `apps/frontend-manage`: no new component is expected. Confirm that the
  existing plan-review warning list renders the message and requires
  acknowledgement. Add translations only if frontend-owned explanatory copy is
  introduced.
- GraphQL schema/operations are unchanged unless implementation reveals a need
  for structured link metadata in the UI. If changed, run codegen and commit the
  public SDL update.

### kg-content-generation worker

- Add the optional external-reference artifact to the strict Hatchet input
  contract and bump its supported schema version.
- Extend MR !34's semantic-distinctness module with generated-vs-reference
  comparison rather than another all-pairs implementation.
- Add a separate adjustable library threshold and bounded batch processing.
- Emit stable code-prefixed overlap and truncation warnings without modifying
  questions.

## Review and PR structure

1. Keep worker MR !34 unchanged as the same-build comparison foundation.
2. Create a worker MR stacked on !34 for the external-reference contract and
   cross-set scoring. It can retarget `main` after !34 merges.
3. Create a separate KlickerUZH PR from current `origin/v3-ai` to `v3-ai` for
   authorization, snapshot persistence, Hatchet payload v4, parsing, and UI
   verification.
4. Promote through the normal `v3-ai -> v3-audit` staging path only after both
   repositories' compatible revisions are available. Worker and Klicker rollout
   order must be documented; no payload v4 dispatch before the compatible
   worker is deployed.

Do not combine this scope into MR !34. The follow-up adds authorization,
cross-repository compatibility, storage, and deployment concerns that deserve
independent review and rollback.

## Implementation slices

1. **Contract fixtures:** freeze snapshot v1, Hatchet payload v4, warning shape,
   limits, and representative SC/MC/KPRIM fixtures in both repositories.
2. **Worker cross-set scoring:** implement artifact validation, reference
   embedding, nearest-match scoring, warning output, configuration, and
   synthetic performance measurements.
3. **Klicker snapshot producer:** query only owned eligible elements, normalize
   their options, create and persist the immutable artifact, and preserve it
   across retries.
4. **Klicker integration:** dispatch payload v4 behind a rollout gate, parse
   structured warnings, and retain existing review acknowledgement behavior.
5. **Verification and rollout notes:** complete package checks, local worker
   integration, mandatory browser verification, and an exact compatibility and
   rollback sequence. Keep deployment separately authorized.

## Test level and evidence

- Worker unit tests:
  - a paraphrased generated question matches the correct library reference;
  - a related but meaningfully distinct question stays below the threshold;
  - two generated questions retain their own results;
  - library references are not compared with one another;
  - malformed, oversized, or hash-mismatched snapshots fail closed;
  - changing the threshold changes warning behavior without rebuilding code.
- GraphQL/service tests:
  - owned active SC/MC/KPRIM elements are included;
  - shared, dependency-derived, archived, deleted, and unsupported elements are
    excluded;
  - selection and truncation are deterministic;
  - the snapshot hash changes when an included element version/content changes;
  - retries reuse the persisted artifact and payload fingerprint;
  - a worker overlap warning survives parsing into the plan summary.
- Cross-repository fixture test: two generated questions plus two library
  references; exactly one generated question receives the expected library
  warning with the correct element id/version.
- Focused checks for every affected package, Prisma migration validation and
  sync, plus GraphQL codegen if the schema or operations change.
- Mandatory `agent-browser` verification with synthetic local data: create an
  existing owned question, generate a paraphrase and a distinct question,
  observe exactly one warning in plan review, verify acknowledgement gating,
  and confirm a shared question's text never appears. Capture before/after and
  reload evidence.
- Staging verification remains separate from code-level proof and requires an
  explicitly authorized deployment of compatible worker and Klicker revisions.

## Risks and follow-ups

- Re-embedding up to 500 references adds latency and usage. Measure it before
  rollout; a persistent model-versioned embedding index is the likely follow-up
  if the cap is too restrictive or latency is material.
- The 0.79 default is supported only by the current synthetic pilot. Keep
  warnings advisory, record de-identified score distributions, and adjust the
  library threshold independently after supervised staging evidence.
- Recent-first truncation can miss older duplicates. The UI warning must state
  this when truncation occurs.
- Supporting shared or course-scoped questions requires a separate decision on
  permissions, data transfer, and what "course library" means.

## Progress

- 2026-09-28: Created the design from current `origin/v3-ai` in an isolated
  worktree. Confirmed `Element` ownership, `ElementInstance` placement semantics,
  the existing warning UI, immutable artifact flow, and the strict Hatchet
  payload boundary.
- 2026-09-28: Implemented the worker follow-up on top of MR !34 and the separate
  Klicker producer on `codex/library-question-similarity-plan`. The fixed
  contract is payload v4 plus snapshot v1. Worker comparison is warning-only,
  uses one shared embedding batch, reports strongest generated-to-library
  matches, and surfaces snapshot truncation once. Klicker pins the owned,
  recent-first snapshot before dispatch and maps the stable warning codes into
  the existing acknowledgement gate.
- Verification completed so far: worker focused suite `172 passed` (with an
  earlier full `621 passed` run), Klicker focused suite `128 passed`, GraphQL
  codegen/schema and TypeScript checks, shared-types and Prisma checks, and a
  clean replay of the additive migration. Local delegated browser login and
  `/elements/generate` reload passed; end-to-end semantic warning generation is
  not locally proven because the seeded lecturer has AI generation disabled and
  the companion worker is not deployed into the local runtime.
- Next: commit both reviewable branches, open a worker MR stacked on !34 and a
  separate Klicker PR to `v3-ai`, then obtain supervisor approval for compatible
  staging deployment. Keep both rollout gates disabled until both revisions are
  available.

## QP2–QP4 shared-core integration — 12 October 2026

The generator's existing !33 integration branch now combines !34/!35 snapshots
and similarity with source-aware identity, frozen empirical calibration and
purpose-specific generation references. This consumer adds only optional wire
metadata for module, selection rule and calibration context; the producer still
emits comparison-only snapshots and defaults to schema 1. No observation or
permission is inferred from the Klicker database.

Twelve producer tests, focused wire-type checking and Biome pass in an isolated
container. The verified alias-import review finding is fixed. Full branch CI
remains separate from these focused results. No feature activation, database
access or deployment occurred; compatible worker rollout precedes schema-2 use.

### Code-generation compatibility correction

CI job 115004867694 at `3360ab47db` failed when graphql-codegen's Jiti loader
resolved the new runtime path aliases. Restore relative imports for executable
service dependencies; retain the type-only and test aliases. The package's
TypeScript path mapping and isolated Vitest resolver do not establish runtime
alias support. This corrects the accepted review suggestion without changing
code-generation configuration or adding dependencies. Hosted build verification
remains required for the correction.


## Lecturer STG end-to-end preparation — 13 October 2026

This section supersedes the earlier environment-toggle and staging-branch rollout
instructions. The requested outcome is a real synthetic lecturer journey through
Manage, the backend, Hatchet, the worker, review and keeping generated questions.
Offline schema qualification and general Playwright CI do not establish this.

### Prepared source

The producer now uses the existing fail-closed GrowthBook evaluator with
`question-library-comparison`, default false, evaluated for the authenticated
lecturer. Remove the old global enable environment variable; retain the 500-item
size setting. Enabled new preparations emit snapshot schema 2. Persisted schema-1
and schema-2 artifacts remain authoritative on recovery, including after flag
disablement. No-pool builds still emit workflow schema 3. Comparison builds use
workflow schema 4; snapshot schema and workflow schema are separate contracts.
Neither this preparation nor a merge enables the flag or dispatches inference.

### Live prerequisites and landing order

The repository setting currently selects `v3-adaptive-learning` for STG.
The healthy serving backend is `e8b0b3619200ff420a29ebbfe20c23e574457087`
(the existing v3-ai sync). This PR is not in that branch. The STG question worker
is healthy at its existing embedding-receipt image; the shared-pool stack is not
deployed. GitOps main and the running worker agree on its image digest.

1. Generator [!27](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/27)
   through [!33](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/33)
   all have passing exact-head pipelines and are ready/mergeable at inspection.
   Land bottom-up into main, retargeting the next layer only after its predecessor
   lands and rechecking the resulting diff, required CI and approvals. Preserve
   branches. Current main adds the embedding-timeout fix after the reviewed tip;
   a tree-only merge preview is clean. The merged result must retain that fix.
2. The !33 tip already contains both comparison
   [!34](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/34)
   and external-pool
   [!35](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/35)
   commits. Standalone !34 conflicts with main. Do not merge a duplicate comparison
   path: verify ancestry in the landed main, then close those superseded MRs only
   with named authorization. Their branch deletion is unnecessary.
3. Verify the final main worker image build and immutable digest. Prepare the
   single-image change in the existing Helm repository path
   `kg-question-generation/stg/kustomization.yaml`, validate the render and CI,
   merge the pin and verify Argo synchronization, ready replicas, running digest
   and workflow registration. Leave the graph worker and PRD unchanged. An exact
   pin cannot be selected before the approved main merge/build produces it.
4. Finish current-head checks and the authorized solo review of
   [#6317](https://github.com/uzh-bf/klicker-uzh/pull/6317), mark it ready and merge
   into `v3-ai`. The platform AI-review status is distinct from the user's accepted
   self-review; do not forge it. Current branch rules do not list that status as a
   required check. The additive snapshot JSONB migration must run before serving
   the new backend.
5. Create and verify a `v3-ai` to `v3-adaptive-learning` sync PR. Merge only after
   CI, then let the existing staging promoter/GitOps path advance the deployment.
   Verify the backend and Manage serving revision and migration completion.
6. Create the disabled GrowthBook flag, then target only the synthetic lecturer
   in staging. Verify evaluation for that actor and denial for a second synthetic
   actor. Keep production disabled. Existing AI-access and focus-topic gates must
   also be evaluated for the test actor, without changing other actors' access.

No merge, retarget, closure, flag write, deployment or cluster mutation occurred
during preparation. Named approval is required for the exact landing/deployment
sequence above under the repository authority rules.

### Synthetic acceptance protocol

- Use the existing synthetic lecturer and graph after verifying ownership and
  graph readiness. Seed only synthetic owned SC/MC/KPRIM references through the
  supported UI/API. Include known related content, an unrelated control and an
  archived reference. No real library or participant data is needed.
- With comparison disabled, confirm the ordinary generation configuration and
  no-pool admission path. Enable only the synthetic actor and submit a two-question
  batch with a chosen focus topic. Record the build, graph and snapshot hashes;
  verify snapshot schema 2, comparison-only permission and workflow schema 4.
- Review the design, generate questions, inspect overlap and truncation warnings,
  confirm explicit acknowledgement is needed, then finalize and keep the two
  drafts. Verify their saved content, provenance and warning state after reload.
  A live semantic score is probabilistic: record a missing overlap warning as an
  unmet acceptance check, not permission to lower the threshold or regenerate.
- If truncation needs a reduced selection cap, use a separately reviewed STG-only
  configuration change with its previous value recorded and restored. Verify
  archived/other-owner exclusions. Do not broaden database discovery.
- Validate pinned-snapshot reuse with a bounded, explicitly authorized recovery
  only; changing the live pool must not change the pinned digest. Do not manufacture
  a failure or replay paid work just to exercise this case. Offline recovery tests
  remain supporting evidence until the live path is actually observed.
- Restore flag rules and temporary settings, retain the synthetic test records
  and receipts, and summarize each acceptance result independently. Deletion of
  synthetic records and publishing beyond the synthetic lecturer remain separate.

### Cost and remaining acceptance gates

The original USD 2 experiment and unresolved reservations remain intact. Its
prior ledger report accounted for USD 1.23866106; that is historical evidence,
not new spend authority or proof of current remaining balance. The previous
focused/unfocused comparison completed before the combined quality changes;
repeating it after rollout is a separate quality qualification.

Generator [!39](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/39)
contains an isolated stage driver. It does not intercept the browser-to-Hatchet
worker path and is not a prerequisite merge or an enforceable budget for this
lecturer test. Before paid UI dispatch, qualify a finite test-specific admission
bound covering generation, embeddings, validation, automatic repairs and provider
retries, and obtain the corresponding fresh allowance. Do not reuse the old
ledger's nominal remainder or claim that attribution alone enforces a ceiling.

On failed checks or an unhealthy rollout, hold dependent actions. Disable new
comparison admission before reverting the producer; let accepted builds finish
on a compatible worker. Retain the nullable database column and pinned artifacts.
Rollback the STG worker pin only after draining incompatible accepted workflows.


Preparation verification: 20 producer tests and 27 feature-flag contract tests
pass in the isolated container harness. All 26 preparation/recovery lifecycle
tests pass with current-schema enums, real Prisma error classes and unrelated
publication calls stubbed to fail if invoked. The harness uses the repository's
pinned saxes and stream-json versions; no repository dependency was added.
Biome and diff checks pass. Hosted CI remains required for the complete package
build and types; these focused harness checks are not live STG proof.
