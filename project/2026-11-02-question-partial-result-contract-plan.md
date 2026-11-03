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
- Artifacts root: the existing `project/` directory.
  [Draft PR #6804](https://github.com/uzh-bf/klicker-uzh/pull/6804) targets `v3-ai`.
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

Retained slot IDs use the existing Design and failure-ID whitespace
normalization before partition checks. Normalization must still reject duplicate
slots, non-string IDs and IDs outside the approved universe.

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

### Approved local SQL and browser qualification

On 3 November 2026 the user approved extending this same draft with the reviewed
local qualification proposal. Approval mode is `executable batch`. The main
session remains the only writer. The source baseline is
`d3c7fd948fc86fe303e57bc165168403b46c7bdf`; its 144 focused tests, fail-fast
GraphQL type checks and production build passed. Existing review evidence is
reused outside the test/configuration extension below.

This extension qualifies the actual result-reader/finalization caller through
real local PostgreSQL, then lecturer review/save and existing quota settlement.
The provider allowance is zero. It preserves the broader shared-generator,
Klicker delivery and complete accepted exam/local-package outcomes, Q24,
historical judgments, reservations and native recovery limits.

1. Prepare the repository-local Devrouter 0.6.6 minimum and supported
   `freshBootstrap` declaration for local qualification. Publishing that change
   depends on the trusted CI toolchain reaching the same version first; keep
   the patch private until its separate delivery boundary is resolved.
   Extend the existing completion integration
   test with a current provenance-bound partial result through the actual
   caller and a malformed partition that must produce no drafts or elements.
   Guard the accounting suite's actual client before setup and cleanup.
   Reuse persistence and browser tests; extend those only for a demonstrated
   missing partial-review/save invariant.
2. Commit and independently review the exact test/configuration candidate
   before managed startup or SQL effects. Preserve the completed plan critique;
   allow the same implementation reviewer one focused correction.
3. Recheck exact source ownership, absence of a retained provider runtime and
   routes, and values-free provider-key/optional-overlay status. Start only
   this checkout's canonical `manage` profile: api/auth/blob/manage, postgres,
   hatchet, azurite, three Redis roles and managed `klicker-dev`. Use
   `devrouter ensure <this-checkout> --profile manage --initialize-new --json`.
   No LLM proxy, generation worker, Chat app, real credentials or global setup.
4. The one-shot managed bootstrap must prove new checkout-owned data resources
   and empty newly created `klicker_test` and `klicker_test_shadow` databases,
   restricted login and disposable markers before schema initialization and
   synthetic seeding. Existing initialization rejects pre-existing test roles
   and databases. A failed or unknown initialization preserves partial state
   and its durable attempt fence; it cannot be replayed or reset.
5. Run the existing completion, persistence, accounting and start-failure
   suites serially in the managed container. External artifacts stay synthetic;
   the parser, provenance checks, finalization, transaction and save are real.
   Preserve distinct Plan question IDs and Design slot IDs. App fixed-price
   quota/spend evidence is separate from native provider USD accounting.
6. Capture SQL evidence before the single authorized initial browser
   cleanup/reseed. Run `pnpm playwright:host --runtime-profile manage
   playwright/tests/Y-question-generation-review.spec.ts --project chromium
   --workers 1 --retries 0 --max-failures 1 --grep 'reviews synthetic generated
   elements through the canonical editor|explains quality flags and a pending
   save through reason nodes|keeps review, completion, partial, and failure
   outcomes distinct'`. Later invocations require `--preserve-database` before
   Playwright arguments and verified known synthetic fixtures. A server-mode
   recovery may add `--ci-runtime`, retaining that preservation option.
7. Publish normal task commits and update the existing draft with verified
   evidence and limitations. CI waiting stays skipped. Stop the exact managed
   owner and verify stopped provider state plus zero source-path routes.
   Preserve data, volumes, caches and all other owners' work.

The only additional mutable source paths are `.devrouter.yml`, this plan,
`elementGenerationCompletion.integration.test.ts`,
`elementGenerationAccounting.test.ts`, and, only if needed,
`elementGenerationPersistence.integration.test.ts`,
`Y-question-generation-review.spec.ts` and its existing fixture. There is no
production behavior, model/price/finance-policy, schema or migration change.
Verified production defects stop their dependent branch and return a minimum
correction proposal; independent authorized checks continue.

The whole batch has four hours, then twenty minutes for graceful shutdown.
After the non-replayable initialization, allow one same-source harness/setup
correction and affected rerun per reproduced fault, at most three material
corrections total. Ownership, data-guard, provider-boundary or exhausted-recovery
failures stop that branch. No new runtime profile, permission change or global
tool repair follows. No paid calls, real cloud/production writes, merge, ready,
deployment, reviewer request, comments or deletion are approved.

The terminal is verified local caller-to-SQL, save/quota and browser evidence,
or explicit failed/incomplete requirements with minimum corrections, reviewed
draft delivery and verified runtime shutdown. Synthetic compatibility does not
prove native generation quality, semantic goal coverage or release. Those and
the complete Finance I exam/local package remain incomplete.

The qualification candidate adds the two caller-to-SQL cases and guards the
accounting suite. The existing idempotent concurrent-save check now also covers
an incomplete build. Both actual GraphQL type checks, touched-file formatting and
lint, installed profile-schema resolution, host runtime/launcher contracts and
scoped scans pass. The source review verified the test logic and identified that
publishing the new Devrouter minimum would conflict with the trusted CI
toolchain. The configuration change is therefore excluded from the published
diff and retained as a private local qualification patch. Updating the trusted
CI toolchain and promoting it remain outside this batch. SQL and browser
execution are unexecuted: fresh initialization also refuses an existing compiler
container bound to this checkout, even when stopped. The approved retain-and-stop
lifecycle does not authorize removing that container. No initialization attempt
or database write has occurred. Existing unchanged source/build checks remain
reusable, and no other owner's source is modified.
An actual no-database parser probe verifies the synthetic manifest, provenance
streams, final bank and index, accepting the valid partition and rejecting the
overlap. This corrects the fixture's canonical graph filename and establishes
artifact compatibility only; it does not substitute for the unexecuted SQL test.

### Source-only delivery history

The actual user approval is recovered. The target matches the reviewed source;
an isolated task worktree is created and other owners' work is preserved.
The proposal critique and its focused correction are complete and reused.
Private candidate probes reproduce the defect and demonstrate the intended
correction. The pinned Node/pnpm container and frozen dependencies are ready;
the unchanged baseline passes 114 focused tests. Maintained regressions expose
33 failures against that source, including invalid draft admission.

The approved source correction and its independent review are delivered in the
draft. A later forge review identified inconsistent whitespace handling of
retained Design-slot IDs. A padded-ID regression fails on that candidate; the
minimum normalization correction passes while padded duplicates stay blocked.
The optional fixture-field type is corrected: the earlier combined
check reported its later successful command without propagating the GraphQL
type failure. Earlier GraphQL type-pass claims are superseded. The affected
tests and type checks now use fail-fast execution. All 144 focused tests and
both GraphQL type checks pass; unchanged passing evidence is retained at its
actual boundary. Formatting and scoped scans pass. The correction follows the
forge review's exact normalization recommendation and is main-verified; the
earlier independent review remains applicable outside that narrow change.
Final build verification and ordinary draft update completed. No managed
application runtime or database has started. Broader product delivery and
native quality remain incomplete.
