# 6. Finalize correlated identities after settlement

- **Status:** Accepted — 2026-08-12
- **Context:** [PR #5134](https://github.com/uzh-bf/klicker-uzh/pull/5134), [ADR-0005](./0005-separate-live-quiz-response-identity-policies.md)

## Context

Participant-account mappings and anonymous credential hashes are needed only while a correlated quiz accepts and settles responses. Retaining them after the quiz has ended would preserve a re-identification path without improving the teaching export. Deleting the respondent parent itself is also wrong: it either cascades to the response rows or leaves an unenforced scalar identifier. The retained grouping key and the temporary identity binding therefore need separate lifecycles.

## Decision

A correlated quiz crosses an irreversible identity-finalization boundary for one `publicationGeneration` after it is `ENDED` and every admitted response receipt for that generation has settled.

Receipt settlement uses the persisted outbox state, not queue delivery status:

- **pending/retryable:** `settledAt IS NULL`; the encrypted payload remains available and `nextDeliveryAt` may schedule another delivery;
- **settled:** the response was durably applied or durably rejected as non-retryable, `settledAt IS NOT NULL`, `eventPayload IS NULL`, and `nextDeliveryAt IS NULL`.

Transient infrastructure or processing errors remain pending. They block finalization until a retry succeeds or an operator deliberately resolves the receipt through a separately audited recovery path; there is no implicit terminal-failure timeout.

Admission holds a shared lock on the `LiveQuiz` row from its status-and-generation check through receipt insertion. Ending and finalization take an exclusive lock on the same row. The exclusive lock waits for in-flight admissions, the `ENDED` transition prevents new admissions, and the finalizer then evaluates the settled predicate without a race.

Under that lock, finalization:

1. verifies that no pending response can still settle;
2. allocates an immutable `exportLabel` on every retained respondent by sorting the generation's respondent ids with `HMAC(exportSalt, respondentId)`;
3. deletes all participant-account and anonymous-credential bindings;
4. deletes the settled receipt rows and removes the export salt; and
5. marks the generation's pseudonymous respondent dataset finalized.

The retained dataset consists of the minimal generation-scoped respondent key, its immutable export label, and the response rows needed by the approved teaching export. Label persistence is part of the domain schema; A5 allocates labels transactionally during finalization, while B1 only renders the CSV from finalized labels. A browser cookie may remain client-side until expiry, but deleting its server-side binding makes it unusable. Finalization happens for the whole ended generation, not when an individual block closes.

Assessment responses never cross this boundary. Their participant association and correction history remain intact. Reopening a finalized correlated quiz cannot restore deleted associations. A later run increments `LiveQuiz.publicationGeneration`, creates a new export salt, and uses new respondents, bindings, generation-bearing anonymous tokens, receipts, and labels. Correlated responses reference that generation through their respondent; export and finalization always filter one generation.

The correlated dataset remains pseudonymous rather than anonymous and therefore
uses a finite retention policy. The finalized respondent dataset is retained
for 90 days after `finalizedAt` so lecturers can complete a normal
teaching and re-export window. The existing minute-level
`reconcile-live-quiz-publications` task, handled by the general worker, owns
expiry reconciliation in bounded batches. It deletes only finalized rows with
no active binding or pending receipt; the respondent delete cascades to
`LiveQuizResponse`, applied corrections, and the immutable export label as one
referentially-integrity-preserving operation.

Export access ends at the retention boundary itself, even while physical
deletion is still progressing, so a delayed or partial cleanup batch can never
re-expose expired data. Soft-deleting an ended correlated quiz removes
lecturer access but does not bypass this lifecycle: finalization and expiry
continue to process soft-deleted quizzes until their dataset is deleted.

Correlated admission rejects free-text questions before identity admission or
outbox creation. Correlated durable rows retain only the approved response and
grading fields. The shared response table's required legacy timestamp and
time-spent columns receive non-information sentinels (`1970-01-01T00:00:00Z`
and `-1`); the event timestamp remains transient for grading and is never
retained or exported.

## Consequences

- Referential integrity remains enforceable without retaining an account or credential mapping.
- Stable re-exports remain possible during the retention period.
- Finalization must be idempotent, transactional, and blocked by unsettled outbox receipts.
- Finalization deletes settled outbox metadata after labels and retained responses are proven complete.
- Expiry is bounded and retryable; rows that still have a binding or pending receipt are left in place for the next reconciliation pass.
- A finalized dataset cannot be used for participant-level corrections, appeals, or re-identification; those remain assessment capabilities only.
