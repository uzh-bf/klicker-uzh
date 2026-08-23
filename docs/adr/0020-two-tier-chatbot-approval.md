# 20. Two-tier approval: account AI capability plus per-chatbot publication

## Status

Accepted

## Context

The tutoring chatbot public beta lets any lecturer request access via a form
(use case, expected student count, cost center). Chatbot usage is billable, so
uncontrolled go-live is not acceptable; at the same time, a per-change approval
queue would make the operating team the bottleneck for every configuration
tweak and kill the beta feedback loop.

## Decision

Approval is two-tier and both tiers are account- or artifact-level, never
per-edit:

1. **Account AI capability**: the team approves a lecturer's account and cost
   center once and enables a feature flag. This single AI usage authorization
   covers both base and advanced model usage; it is not split by model or
   model class. Lecturers with Catalyst can already see and use the chatbot
   creation and configuration features beforehand; the flag gates publication,
   not creation.
2. **Per-chatbot publication**: each chatbot is created and configured
   self-service in a non-published state, in which only the owning lecturer
   can use it. Going live requires an in-app publication request on the bot
   (use case, expected student count, proposed participant usage-credit
   configuration) that the team approves or rejects with a comment. This
   legacy per-chatbot allowance is separate from, and does not approve, the
   account-wide base and advanced usage budgets.

Configuration edits are free within the account authorization and the
lecturer-defined budgets, and apply immediately. Model selection does not
require a new approval while the account authorization is valid. Publication
approval remains a separate lifecycle decision; it does not serve as a usage
funding or per-model approval.

Usage is tracked in two explicit model classes. Registry entries are classified
as `BASE` or `ADVANCED`; `Auto` is `ADVANCED` for the MVP until every routed
billable step can be attributed. Fallbacks stay within the selected class, and
the service never silently switches classes when a class is exhausted.

The lecturer defines one account-wide monthly budget for each class. Each
configured limit persists until the lecturer changes it; only the used-credit
counter resets at the Europe/Zurich month boundary. The lecturer-facing UI
shows exactly two lanes — **base model usage** and **advanced model usage** —
with the configured budget, used credits, remaining credits, and reset date.
The teaching center contributes a limited, internal amount toward base usage,
but the contribution and its settlement are never shown. Advanced usage
receives no teaching-center contribution. Base usage above the hidden
contribution remains base usage and may consume the authorized paid budget.

The MVP performs an availability pre-check and charges reliable provider usage
after generation with atomic counters. Bounded final-turn and concurrent
overruns are accepted; strict reservations, an immutable ledger, automated
refunds, and invoice generation are deferred. Missing reliable provider usage
is not charged, and manual corrections remain available. Existing participant
usage credits remain a separate legacy allowance and cannot cause cross-class
fallbacks. At migration cutover, new account counters start at zero; historical
messages and participant credits remain legacy analytics.

## Consequences

- The team reviews each bot exactly once before it meets students, at the
  moment its real configuration and stated use case are visible together.
- Post-publication edits to non-gated knobs (examples, knowledge, standard-mode
  fields, and model choices within the account authorization) take effect
  without another approval; this bounded risk is accepted.
- Base and advanced budgets are visible as separate usage lanes, while the
  teaching center's base contribution and internal settlement remain hidden.
- Class-specific exhaustion does not disable the other class or trigger a
  silent cross-class switch. Participant clients receive only the stable
  availability and exhaustion contract, never cost-center or funding details.
- Draft-config machinery for live bots is deliberately deferred until editing
  live bots proves painful.
