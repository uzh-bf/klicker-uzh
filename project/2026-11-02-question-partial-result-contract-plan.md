# Validate partial question results before draft storage

## Approval summary

A partial question-generation result can currently pass the application reader
with inconsistent counts or missing-slot reasons. The finalization caller can
then send those questions to draft storage and retain misleading attention
metadata. A source-bound reproduction exercises the actual parsers, evidence
validators, build loader and completion caller with synthetic external adapters.

The user approved one companion application batch on 2 November 2026: validate
partial manifest counts and schema/provenance pairing, then require retained
questions and missing-slot reasons to partition the approved Design slots.
Question IDs and Design-slot IDs remain distinct. Valid complete,
review-required and partial results retain their existing meaning; complete
legacy results remain supported. Historical partial artifacts lacking current
metadata, required provenance or verified slot identities fail before drafts.

The batch includes maintained regressions, required source checks, independent
final review, an ordinary task-branch push and a draft PR to `v3-ai`. It includes
no paid inference, real database or cloud-store write, merge, ready action,
deployment, flag change, reviewer request or comment. The source correction is
reversible by an ordinary revert. Native generation quality, real persistence,
lecturer review/save, credits, browser behavior and release remain separate
acceptance boundaries.

## Execution details

### Source and ownership

- Branch: `fix/question-partial-result-contract`, based on `v3-ai` at
  `3982d84e2baf5c01510f70930e67e042e8e52c26`.
- Artifacts root: the existing `project/` directory. PR: none yet.
- The main session owns this finite final-result-validation batch.
- [The existing library PR](https://github.com/uzh-bf/klicker-uzh/pull/6317)
  retains its owner and work. Both batches touch `synchronizeLeasedBuild` in
  separate regions; this batch does not rebase or change that PR. A genuine
  concurrent semantic conflict returns to the user.

Implementation is confined to `questionGenerationArtifacts.ts`,
`questionGeneration.ts` and their existing artifact/lifecycle tests. There is
no new production module, dependency, migration, UI content or configuration.
The existing result, question draft, Design and Plan primitives are reused.
No new domain or architecture decision requires an ADR.

### Primitive impact

| Product primitive | Disposition | Contract delta | Consumers and evidence |
| --- | --- | --- | --- |
| Approved Design | Reuse | Its slot identities remain the authority for retained and missing slots. | Design summary, worker slot contracts and final-bank parser. |
| Generation build | Extend validation | Partial success requires consistent counts, current evidence and an exact Design partition before draft admission. Incompatible historical partials fail closed, as approved. | Result parser and existing finalization caller. |
| Question draft | Reuse | Valid questions retain Plan identities and review flags; invalid partial artifacts cannot invoke completion. | Existing completion adapter and synthetic lifecycle regressions. |

### Contracts

Partial manifests must report the expected requested count, a nonempty strict
subset, matching generated and missing counts, unique missing-slot reasons and
the required schema/provenance pair. The bank must match the generated count.
Its retained `design_slot_id` values and missing-slot IDs must partition the
existing approved Design universe exactly. The existing Plan question-ID check
remains separate.

The current Design summary records Design-slot IDs in
`slots[].sourceQuestionId`; the Plan summary uses that property for question
IDs. The worker derives its slot contracts from the same approved
`resolved_slots` array. The application review event uses the existing artifact
rather than supplying replacement Design bytes. Preserve these identities and
verify them when integrating concurrent changes.

Missing or malformed historical partial metadata is an artifact-validation
failure. It must not create drafts, guess identities or trigger generation.
Complete historical results keep their existing handling. This changes neither
question-quality judgments nor credit, model, repair or spending policies.

Failed-result reason enrichment is outside this correction. A fresh invalid
finalization does not store a result reference in the tested path. An already
present reference can still permit failed-reason enrichment; do not describe
all attention-card integrity as fixed.

### Sequence and verification

1. Reconcile current source and preserve unrelated work. Reuse the completed
   proposal critique and baseline reproduction where their source is unchanged.
2. Apply the manifest and bank checks, passing Design identity through the
   existing finalization caller. Extend existing synthetic fixtures and tests.
3. Run the actual GraphQL package type check, focused serialized tests,
   formatting/lint and mandatory scans before committing. These gates cannot
   be waived by documenting an unavailable tool. Run container-dependent checks
   in the isolated check environment and Git operations on the host.
4. Commit the coherent candidate, obtain one independent final review of that
   exact scope, and resolve findings with one focused correction. Recheck only
   affected evidence after corrections. Required repository checks and the
   pre-push build remain part of delivery.
5. Push the ordinary task branch, create one draft PR to `v3-ai`, and read back
   its exact head, body, base and draft status. Preserve existing owners and
   stop the task-owned check container after its last check. No merge or
   rollout follows.

If mandatory type checks or scans cannot run and pass, stop before commit,
push or draft creation with a concrete tooling blocker. Ordinary in-scope test
and review corrections continue without another approval. SQL, browser and
release checks remain outside this source batch and cannot be represented as
passing by the synthetic tests.

### Test portfolio

| Risk | Existing seam and obligation | Observable failure |
| --- | --- | --- |
| Partial counts or schema disagree | Extend artifact-parser tests | Malformed counts or legacy schema bypasses required current provenance. |
| Missing-slot partition is false | Extend final-bank and lifecycle tests with distinct question/slot IDs | Duplicate, foreign, overlapping or absent identities reach draft admission. |
| Valid compatibility regresses | Reuse and extend SC/MC/KPRIM and complete-legacy controls | A valid format is rejected or review flags are lost. |
| Validation occurs after writes | Existing lifecycle completion adapter | Invalid artifacts invoke completion before rejection. Real SQL concurrency is untested. |

Tests assert structured contracts, machine error codes and write admission.
They do not pin question prose, fixture wording or error-message text. External
storage and database effects remain synthetic; no service or provider call is
needed for these focused tests.

## Progress

The actual user approval is recovered. The target matches the reviewed source;
an isolated task worktree is created and other owners' work is preserved.
The proposal critique and its focused correction are complete and reused.
Private candidate probes reproduce the defect and demonstrate the intended
correction. The pinned Node/pnpm container and frozen dependencies are ready;
the unchanged baseline passes 114 focused tests. Maintained regressions expose
33 failures against that source, including invalid draft admission.

The approved source correction is implemented. All 151 focused parser and
caller checks pass, along with GraphQL and workspace type checks, formatting,
lint, dependency consistency, host contracts and scoped scans. The production
build passes all 27 tasks. Hook-equivalent checks ran with Git on the host and
compiler checks in the container; no managed application runtime was started.
Independent source review and draft delivery remain pending. The check
container has no network access, database or provider credentials. Broader
product delivery and native question quality remain incomplete.
