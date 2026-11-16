# Preserve failed reasoning-only chat responses

Executable batch under the user's instruction to fix empty reasoning-only responses, verify the affected Auto cases and prepare a PR. Target: v3-ai. Main session owns implementation, integration, runtime and verification. Publication ends at a draft PR; merging, deployment and unrelated ownership changes remain outside this batch.

When a provider terminates with reasoning but no meaningful response, the app must retain a localized retry state across streaming and reload. Keep a finalized billing record and the existing usage/idempotency path; encode the failed response as a structured `chat-error` content part instead of changing accounting lifecycle states. Preserve usable partial text, legitimate tool/non-text output and participant-stopped turns. Projection handles old reasoning-only completed rows without rewriting stored history. No schema or model-registry changes and no automatic paid retry.

## Work and verification

1. Extend the existing persisted-content helper with meaningful-response classification and a machine-readable empty-response error. Add regression cases first for empty/whitespace/reasoning-only versus legitimate response and stopped content.
2. Use the helper at provider completion, client stream completion and assistant-history projection; render the existing error UI with localized defaults for server-authored markers. Verify actual usage reaches the current idempotent finalizer unchanged, and duplicate/manual-retry behavior stays intact.
3. Run focused native tests and applicable checks in the isolated task runtime. Exercise deterministic synthetic provider output in a real browser, including reload and manual retry. Capture safe synthetic evidence.
4. Repeat the two bounded Auto queries against the existing production imports as separate live-query evidence within the existing test budget. Do not claim the PR candidate is deployed. No processing/import/replay of successful prior chats.
5. Review the exact candidate independently, commit/push the scoped fix and prepare a draft PR with verification and any remaining browser/runtime or CI limitations. Use normal CI observation. Stop the exact task runtime at the terminal boundary.

Plan critique accepted: preserve billing lifecycle rather than introduce failed-row reclaim changes; distinguish response failure from finalized usage, classify before truncation notices, project legacy rows without mutation, preserve real tool output, and separate current-production Auto checks from fixed-code acceptance. The independent planner approved this narrowed approach.

Progress: Source complete, review and forge validation pending. Focused regression and transactional usage tests pass; chat typechecking passes. Local browser verification confirms the error and retry state survives reload. Production Auto canary results remain private and are not fixed-source deployment proof. The exact isolated runtime will be stopped after final dependent verification. No schema/model-registry change or ownership transfer.
