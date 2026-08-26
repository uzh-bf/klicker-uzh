# 20. Two-tier approval: account AI capability plus per-chatbot publication

## Status

Accepted. The budget-control and pilot-cutover portions are superseded by
[ADR 0041](./0041-chatbot-trusted-pilot-boundary.md); account authorization,
publication approval, and usage-class semantics remain in force.

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
   self-service in a non-published state. In Phase 0, the owning lecturer can
   manage and configure it, but no use or preview path exists. A later
   owner-authenticated test chat may exercise an unpublished bot without making
   it participant-reachable. Going live requires an in-app publication request
   on the bot
   (use case, expected student count, proposed participant usage-credit
   configuration) that the team approves or rejects with a comment. This
   legacy per-chatbot allowance is separate from, and does not approve, the
   account-wide base and advanced usage budgets.

In the original design, configuration edits were free within the account
authorization and lecturer-defined budgets, and applied immediately. The
trusted-pilot boundary in [ADR 0041](./0041-chatbot-trusted-pilot-boundary.md)
supersedes that budget write ownership: operations manages the configured
limits through an `ADMIN`-only mutation with an explicit owner, while account
owners retain read-only visibility. Model selection does not require a new
approval while the account authorization is valid. Publication approval
remains a separate lifecycle decision; it does not serve as a usage funding or
per-model approval.

Usage is tracked in two explicit model classes. Registry entries are classified
as `BASE` or `ADVANCED`. GPT-5.6 Luna is the only `BASE` model and the
participant-credit fallback. Every other current registry entry, including
`Auto`, is `ADVANCED`. Participant-credit fallbacks stay within the selected
class, and the service never silently switches classes when a class is
exhausted. This is distinct from provider-level LiteLLM fallbacks, which do not
change the selected registry entry or its usage class.

Registry costs use Azure Global Standard short-context USD prices per one
million input and output tokens, verified on 2026-08-24. The registry cannot
represent cached-input, cache-write, or long-context rates. `Auto` therefore
uses the accepted rounded accounting rate of 1 input / 5 output, based on the
observed 90% Luna and 10% Sol generation mix whose exact weighted rate is 0.68
input / 4.08 output. Classifier and embedding overhead are not represented.

The original design assigned one account-wide monthly budget per class to the
lecturer. ADR 0041 supersedes that write ownership for the trusted pilot:
operations manages each configured limit, which persists until an authorized
`ADMIN` changes it; only the used-credit counter resets at the Europe/Zurich
month boundary. The lecturer-facing UI shows exactly two read-only lanes —
**base model usage** and **advanced model usage** — with the configured budget,
used credits, remaining credits, and reset date. The teaching center
contributes a limited, internal amount toward base usage, but the contribution
and its settlement are never shown. Advanced usage receives no teaching-center
contribution. Base usage above the hidden contribution remains base usage and
may consume the authorized paid budget.

The MVP performs an availability pre-check and charges reliable provider usage
after generation with atomic counters. Bounded final-turn and concurrent
overruns are accepted; strict reservations, an immutable ledger, automated
refunds, and invoice generation are deferred. Missing reliable provider usage
is not charged, and manual corrections remain available. Existing participant
usage credits remain a separate legacy allowance and cannot cause cross-class
fallbacks. At migration cutover, new account counters start at zero; historical
messages and participant credits remain legacy analytics.

## Consequences

- The team reviews each publication request before the bot meets students, at
  the moment its real configuration and stated use case are visible together.
  A rejected resubmission receives a new review.
- Post-publication edits to non-gated knobs (knowledge, standard-mode fields,
  and model choices within the account authorization) take effect
  without another approval; this bounded risk is accepted.
- Both registry consumers reject configurations that do not make GPT-5.6 Luna
  the sole `BASE` model and participant-credit fallback. CI pins registry
  class, fallback, and accounting-rate parity across built-in, staging, and
  production declarations.
- Base and advanced budgets are visible as separate usage lanes, while the
  teaching center's base contribution and internal settlement remain hidden.
- Class-specific exhaustion does not disable the other class or trigger a
  silent cross-class switch. Participant clients receive only the stable
  availability and exhaustion contract, never cost-center or funding details.
- Draft-config machinery for live bots is deliberately deferred until editing
  live bots proves painful.
