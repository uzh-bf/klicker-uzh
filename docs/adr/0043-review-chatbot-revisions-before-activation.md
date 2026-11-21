# 43. Review chatbot revisions while the approved configuration stays live

## Status

Accepted. Supersedes the immediate lecturer-setup edits and deferred revision
workflow in ADRs [0020](./0020-two-tier-chatbot-approval.md),
[0021](./0021-templated-standard-modes-reviewed-custom-modes.md),
[0041](./0041-chatbot-trusted-pilot-boundary.md), and
[0042](./0042-version-chatbot-disclaimers-by-replacement.md) only for the
configuration described here.

## Decision

An owner can revise a published chatbot's existing lecturer-facing setup and
submit it for approval. Students keep using the last approved configuration
until an administrator approves the exact submitted revision. This avoids
interrupting an active course and prevents unreviewed configuration from
becoming live. A paused chatbot remains paused.

Keep one saved configuration revision alongside the existing chatbot. Its
identity, live fields, course relationship, chat history, and participant
access remain stable. A separate revision status and monotonic version fence
govern editing, submission, withdrawal, rejection, and approval. Pending content
is immutable; rejection and withdrawal retain content for editing and
resubmission. Approval validates and activates the reviewed version atomically.
There is no revision-history subsystem or parallel draft queue.

Revision content includes metadata, standard-mode configuration, model policy,
participant-credit policy, lecturer disclaimer text, and publication-request
details. It does not include account funding, ownership or course assignment,
provider credentials, custom prompts, knowledge-base or MCP bindings, or
response-example review. Those retain their separate authority and lifecycle.
Owner test chat exercises the live configuration until draft runtime preview
is separately implemented.

## Credit and disclaimer effects

Approving a credit policy does not grant credits, clamp balances, replace
participant rows, or reset usage history. Initial credits apply to newly
created participant credit rows. Existing balances and stored totals remain
until the next ordinary reset, when the approved reset amount and maximum
apply. NONE disables subsequent resets and preserves remaining credits.

A changed reset schedule starts at approval. Its activation time is a lower
bound on reset eligibility so changing periods cannot cause an immediate
extra top-up. Credit writers and approval serialize on the chatbot before
locking participant credit rows, preventing an old-policy reset from crossing
activation. Unrelated edits do not postpone the reset schedule.

Changed disclaimer content receives a replacement identity. Draft changes
remain unlinked from the live chatbot until approval. Linking the approved
replacement then requires fresh acceptance through the existing identity
comparison; historical disclaimer content and acceptance records remain intact.
Live acceptance statistics remain separate from draft disclaimer content.

## Alternatives

Taking the chatbot offline while editing was rejected because the approved
version remains useful to students. Immediate in-place edits were rejected
because approval would no longer identify the configuration students receive.
A separate revision-history model was unnecessary for one saved draft and one
pending review; the existing chatbot remains the authority for live state.
