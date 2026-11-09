# 56. Grant lecturer AI features by feature, with UZH approval by default

## Status

Accepted. Supersedes the preapproval chatbot authoring in ADRs
[0008](./0008-use-growthbook-for-feature-flags.md) and
[0020](./0020-two-tier-chatbot-approval.md), and the assistant's approval
requirement in [ADR 0038](./0038-backend-enforced-feature-entitlements.md).
The rest of those decisions remains in force.

## Context

All lecturer AI surfaces shared one capability: the `ai-beta` rollout, the beta
preference and the administrator-set `aiFeaturesEnabled` approval. The product
now opens the features to different audiences. The Manage assistant opens to
every Catalyst lecturer. Knowledge bases and chatbots open to UZH lecturers.
Question and flashcard generation stay limited to their current users.

## Decision

- **Manage assistant.** Catalyst, the beta preference and `ai-beta`. It does
  not require `aiFeaturesEnabled`; its per-user rate limits bound its use.
- **Knowledge bases and chatbots.** `aiFeaturesEnabled` in addition. Auth sets
  it once when an account is created whose email or eduID affiliation is on
  `uzh.ch` or a subdomain; a one-time migration did the same for existing
  lecturer accounts. Administrators still change it per account. USZ and other
  Catalyst institutions need an administrator. Creating a chatbot now needs the
  approval, so chatbot authoring is no longer preapproval.
- **Question and flashcard generation.** The `question-generation` GrowthBook
  flag in addition, evaluated in the backend as a fail-closed entitlement per
  ADR 0038. The approval alone does not open them.

## Consequences

- Revoking `aiFeaturesEnabled` no longer stops a lecturer's assistant use.
  Withdrawing the beta preference or the `ai-beta` rule does.
- Question-generation access is managed in GrowthBook, not on the admin panel.
  A deployment that introduces the flag needs its production rule first, or
  current users lose generation.
- The backfill cannot tell a deliberate administrator opt-out from the default,
  so it switched those accounts on as well.
