# Simple chatbot publication approval

## Goal

Replace the CLI draft in PR #6223 with an admin-only review section in the
existing Manage Admin panel. Review an existing pending chatbot and approve it
for participant access through the established publication mutation.

## Contract

- Reuse `Chatbot` and its `PENDING_APPROVAL -> PUBLISHED` lifecycle. The chatbot
  already exists; approval publishes it and does not create another chatbot.
- Reuse owner `aiFeaturesEnabled` capability; show its current value and retain
  the mutation's live capability check. Approval does not grant usage budgets.
- Add an ADMIN-only pending-review query, with the same service-level role
  guard as the approval mutation. No author beta/catalyst gating for admins.
- Show owner, course, description, use case, expected participants, credits,
  effective models, standard modes/framing, MCP summaries and disclaimer.
- Select only review data; never select credentials, server URLs/parameters,
  conversation content or participant records.
- Each expanded review has one explicit Approve and publish action, with a
  consequence notice, pending/disabled states, errors and refreshed queue.
- Keep the queue and actions unavailable for non-admin users. Backend guards
  remain authoritative. Refetch after approval or failure; no automatic retry.

## Footprint and non-goals

Manage page/components, GraphQL query/type/operation, EN+DE strings, targeted
service tests and browser evidence. No Prisma migration, seed change, Hatchet
work, gamification, budget administration or production write.
Remove the CLI/test/README additions; retain its approval operation.

## Verification

Generate GraphQL outputs, check affected packages, run publication service tests,
and exercise the Admin panel with synthetic data in the browser at desktop and
mobile sizes, including non-admin, empty, error and approval states. Full checks
and builds use the repository environment. Devrouter startup awaits explicit
user authorization; do not substitute an unauthorized startup.

## Progress

- Implemented the admin queue and review projection; removed the CLI.
- Native explorer and independent reviewer completed; no actionable findings.
  External executor/simplifier skipped because external-model opt-in is absent.
- Generated GraphQL outputs and passed GraphQL and Manage TypeScript checks.
- All 32 publication integration tests passed in the disposable database.
- Browser verified desktop/mobile review, revoked-owner rejection and disabled
  action, successful publication, empty queue, German strings, and non-admin denial.
- Browser used the built backend after watch-mode compilation exhausted the local
  Docker VM memory; temporary runtime configuration is excluded from the PR.

## Local approval and rejection follow-up

Added a required-reason rejection form using the existing ADMIN mutation.
Manage typechecking and Biome checks passed. Browser verification confirmed blank
and whitespace-only reasons are blocked, rejection succeeds, feedback is saved,
and approval still works. Checked the English desktop and German mobile layouts.
Synthetic pending requests and beta enrollment remain local test data only.
