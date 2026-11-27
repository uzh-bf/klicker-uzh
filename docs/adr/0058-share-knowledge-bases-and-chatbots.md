# 58. Share knowledge bases and chatbots with lecturer and group grants

## Status

Accepted for the sharing implementation.

## Context

Teaching teams maintain common sources and course-specific chatbots. A lecturer may leave a team while the course continues. The existing sharing dialog lets an owner grant access to individuals and groups and preserves the highest applicable access level when one grant is removed.

## Decision

Use those grants independently for the KB and chatbot. KB Read permits reuse in a chatbot. Changing a binding requires chatbot Write and KB Read for both the actor and the bot owner. The owner provides continuing authority for retrieval. The owner of the source collection provides the storage namespace for source changes. Collaborator access does not transfer funding or ownership.

Losing the bot owner's last KB grant suspends new reads while retaining the selection. Restoring Read reactivates that selection. Removing a co-editor's grant affects that person's access and leaves other eligible users' bots running. Students keep their existing course access and can read answers already delivered. New retrieval, source opens and protected media reads check current access.

Publication approval and funding follow [ADR 0020](./0020-two-tier-chatbot-approval.md) and [ADR 0041](./0041-chatbot-trusted-pilot-boundary.md). Replacing a KB affects live retrieval through the existing binding lifecycle in [ADR 0043](./0043-review-chatbot-revisions-before-activation.md) and [ADR 0050](./0050-per-mode-retrieval-scope-and-kb-attachment.md).
