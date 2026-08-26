# 41. Staged chatbot usage enforcement and trusted-pilot boundary

## Status

Accepted

This ADR supersedes the budget-control and pilot-cutover portions of
[ADR 0020](./0020-two-tier-chatbot-approval.md). ADR 0020 remains authoritative
for account AI authorization, per-chatbot publication, and usage-class
semantics where this record does not change them.

## Context

The chatbot usage foundation can observe account-level usage for base and
advanced model classes, but the first pilot still needs an operational review
step. The system must remain useful for a trusted, operations-assisted cohort
without turning a lecturer-facing settings page into an ungoverned spending
control or claiming that a code-ready stack is a live deployment approval.

The model registry is shared by Chat and GraphQL consumers. A malformed or
unbounded supplied registry must fail before either service becomes ready, and
both consumers must enforce the same output-token ceiling and model-class
invariants.

## Decision

- Account usage enforcement remains **default-off**. The existing lifecycle
  claim, participant-credit behavior, and completion semantics remain active
  while the switch is false. Enabling enforcement is a separate operational
  cutover decision for a named environment and cohort.
- The budget mutation is an operations boundary. It is available only to the
  existing `ADMIN` role and requires an explicit target owner ID. Account
  owners retain read access to their own two usage lanes but cannot write
  budgets.
- Monthly budgets are soft planning targets. The system performs an
  availability pre-check and records reliable provider usage after generation,
  but it does not reserve credits. A final or concurrent request already in
  progress may therefore exceed a target. The Manage surface shows estimated
  base and advanced usage, used credits, remaining credits, and the next Zurich
  reset date without exposing internal funding or provider details.
- Both registry consumers parse built-ins and supplied JSON through the same
  bounded contract. Every entry has an integer `maxOutputTokens` value from 1
  through 4096, supplied-invalid JSON is rejected rather than replaced by a
  warning fallback, and model-class/fallback invariants remain fail-closed.
- New chatbots start with the safe pilot policy: model selection disabled,
  GPT-5.6 Luna as the only allowed base model and fallback, low and medium
  reasoning, the standard prompt override unset, and no MCP relation. Existing
  chatbot rows are not migrated or normalized by this policy.
- Manage renders a localized lifecycle status for every chatbot. A participant
  link is rendered only for `PUBLISHED`; every other state explains that the
  link becomes available after publication. Published model-policy edits stay
  self-service within the existing approval boundary.
- Code and CI readiness do not authorize a live pilot. Cohort inventory,
  provider hard caps, secret or configuration writes, enforcement activation,
  deployment, and live smoke testing are separate tasks requiring explicit
  authority and their own evidence.

## Consequences

- Operations retains one controlled place to set account budgets and can
  review usage without granting write access to every lecturer.
- The first release is transparent about estimates and bounded overruns while
  deferring reservations, immutable ledgers, refunds, invoices, and routed-cost
  reconciliation to a later usage-accounting package.
- Strict startup parsing can prevent readiness after a bad registry change;
  deployment configuration must therefore be validated and rolled back to the
  last valid registry before any later activation.
- Safe creation defaults reduce accidental exposure but do not freeze
  published configuration. Immutable revisions and approval snapshots remain
  follow-up work for a wider rollout.
