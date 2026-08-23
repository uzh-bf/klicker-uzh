# 39. Provider credential use requires an explicit resource binding

- **Status:** Proposed — 2026-08-23

## Context

A valid provider key does not answer who may spend against it, which teaching
resource may use it, which models are in scope, how participants are limited,
or which provider notice applies. Treating a credential as an account-wide
implicit default would make copying, sharing, ownership transfer, and revocation
surprising and difficult to audit.

## Decision

A Provider Credential is reusable but inert. The first implementation uses a
chatbot-specific Credential Binding rather than a polymorphic future-resource
abstraction. Each use requires an active binding to one chatbot. The binding
records the allowed named model or, in the later Auto layer, a complete Auto
manifest, explicit participant delegation, a separate BYOK budget, and the
current Provider Notice version.

Only the credential owner can create, rotate, revoke, delete, or bind the
credential. A lecturer may delegate a chatbot binding to its enrolled
participants; participants never receive the credential and see only their own
availability and quota state. Co-owners may receive safe status and aggregate
usage where the resource's existing ownership model requires it, but they do
not manage or inspect the credential. An enrolled participant is eligible only
while the corresponding `Participation.isActive` value is true, checked when a
request capability is issued and consumed.

If chatbot copy or ownership-transfer operations are introduced, copying
creates no credential binding and ownership transfer removes the binding.
Revocation, deletion, invalid validation state, or a provider-profile suspension
disables every binding synchronously.

BYOK usage has a per-participant limit and a lower lecturer-level aggregate cap
than the provider account itself might allow. It never consumes or falls back
to UZH credits. Every request makes an atomic hard reservation against both
limits before dispatch, then settles the LiteLLM-derived estimated actual cost.
If reliable terminal usage is unavailable, the full reservation remains
charged. The UI shows the estimate in the provider currency and labels it as an
estimate rather than invoice truth.

A participant must acknowledge the current factual Provider Notice before the
first request. Changing the provider profile or any material data-boundary fact
increments the notice version and requires acknowledgement on the next use.
Acknowledgement is not consent, a waiver, or a legal basis.

## Consequences

- Credential reuse does not create ambient authority.
- Binding lifecycle events must be transactional with resource copy, ownership
  transfer, suspension, and deletion.
- Provider-profile, model-manifest, quota, and notice-version changes become
  explicit policy events with auditable effects.
- Lecturer-facing analytics remain aggregate and privacy-minimal; this decision
  does not expose participant-authored text in manage.
