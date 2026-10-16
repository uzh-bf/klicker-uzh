# Bounded evaluation budget initialization

## Approval summary

Extend the existing evaluation budget initializer with an explicit US$55,
48-submitted-turn option. The default remains US$5 and 120 turns. Existing
lower-cap ledgers remain valid; higher budgets are accepted only for the exact
new pair. A new ledger records both limits in its immutable identity receipt.
Existing experiments cannot acquire more allowance through reinitialization or
limit edits.

The approved executable batch covers source changes, synthetic verification,
ordinary task-branch commits and pushes, and a draft pull request against `v3`.
Completion requires passing applicable CI and disposition of review findings.
The pull request remains draft. Merge, deployment, real experiment initialization
and paid evaluation are outside this batch.

This extends application-side admission, not framework orchestration or scoring.
No new executable scripts, dependencies, ledger schema, automatic retry, refund
or uncertain-state recovery are introduced. Existing reservations remain shared
across all arms of an experiment. The main risk is accidentally broadening the
limits accepted by persisted-ledger readback; direct validator tests protect
that boundary separately from command-line parsing.

## Execution details

Owner and boundary owner: main session, execution mode `standard`.
Branch: `enhance/evaluation-budget-limits`; target: `v3`.
Baseline: `733b6e7c9456fb11cb75001dbe111820d9c3b009`.
Pull request: none created yet.
Ceremony: full path because this changes spend policy and ledger validation.
Pause only for a material authority, policy or data-boundary change, or an
unavailable required verification capability.

### Primitive impact

| Product primitive | Disposition | Contract delta | Consumers and evidence |
| --- | --- | --- | --- |
| Experiment budget | Extend | Explicit US$55/48 option; unchanged default and immutable identity | Existing initializer, runner, target and guard reuse `evaluation-budget.mjs` |
| Provider reservation | Reuse | None; each attempt reserves before dispatch, without refunds | Existing spend guard and fake-upstream tests |

### Binding contracts

The existing `--initialize-budget` command gains paired options
`--max-provider-micro-usd 55000000 --max-submitted-turns 48`. Either order is
accepted. Missing, duplicate, unknown or noncanonical options and unsupported
pairs fail before any ledger or identity receipt is created. These options are
invalid when starting the guard.

Central validation accepts the existing positive limits up to US$5/120 and the
exact US$55/48 pair. Intermediate higher caps and other higher-budget turn
counts fail, including on persisted readback. Existing version-2 identity,
locking, monotonic accounting and uncertainty semantics stay intact.

One slice changes only `evaluation/evaluation-budget.mjs`,
`evaluation/evaluation-spend-guard.mjs`, the existing
`apps/chat/test/evaluation-spend-guard.test.mjs` and `evaluation/README.md`.
Main owns the policy, CLI, documentation and integration. A bounded test worker
owns only the existing test file. This plan is the only new tracked file.
Generic evaluation/import/scoring remain in the separate framework.

### Test portfolio

| Consequential risk | Obligation and primary seam | Existing protection and distinct extension |
| --- | --- | --- |
| Default changes or arbitrary high caps become readable | Extend existing central-ledger tests | Directly accept legacy lower caps and exact US$55/48; reject intermediate, oversized and mismatched pairs |
| CLI silently raises limits or writes invalid state | Extend existing guard tests at offline initializer | Default readback, explicit pair in either order, invalid arguments leave no files |
| Existing allowance can be raised or reset | Extend existing ledger identity tests | Reinitialization and both directions of limit mutation preserve the original ledger and identity |
| Guard or runner ignores the new limits | Extend existing fake-upstream scenario | Admit the final allowed turn/reservation, refuse the next turn or oversized reservation before upstream dispatch |

Run focused Vitest suites for guard, trajectory runner and evaluation target in
a network-disabled ephemeral Node container, plus Node syntax, repository
formatters and diff checks. Reuse existing concurrency, retry and uncertainty
coverage. No browser or application runtime is needed for this CLI-only change.
Hosted CI provides full repository checks. No live provider qualification is
claimed by fake-upstream results.

### Review and documentation

Planner approved the proposed contract after requiring direct central-validator
coverage distinct from CLI parsing. Required post-commit passes are simplifier,
cost/data-integrity slice review and integrated final review. Read-only reports
live under ignored `project/_local/reviews/`. The existing evaluation guide
documents the opt-in and its separate spending approval. No ADR is introduced:
this is a reversible, bounded extension of an existing policy; a generic budget
configuration surface or changed ledger ownership would reopen that decision.
No version-sensitive library or framework behavior is changed.

## Progress

Planning complete; baseline guard, trajectory and target suites passed all 47
tests. Implementation is next. Source, hosted CI and required reviews remain
pending. No real ledger or paid request has been created. Required delivery is a
verified draft pull request; no pull request exists yet.
