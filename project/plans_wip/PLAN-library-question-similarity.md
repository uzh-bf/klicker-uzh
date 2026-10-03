# Generated-question similarity against the lecturer library

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
  owner identity, and participant data.
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
