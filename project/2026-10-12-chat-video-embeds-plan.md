# Video embeds in chatbot replies

## Approval summary

Chat replies show video-labelled links as ordinary anchors. Reuse the shared Markdown player so explicit `video` and `embed` links render inline. Preserve the provider allowlist, citation handling, ordinary links, and inline wrapper. Add no dependencies or arbitrary HTML support.

The user authorized connecting uploaded videos to the production ethics chatbot and testing the student flow, and separately approved Unlisted viewing. Private course prompts, media identifiers, and configuration receipts stay outside public Git. Exact generated player URLs must play without uploader privileges before use.

Source delivery ends at a verified draft PR targeting `v3`. Merge, release publication and deployment remain separate gates. Until deployed, production can expose verified links; inline playback remains unverified. Acceptance covers the actual renderer, supported and unsupported links, citations, desktop/mobile browser evidence, and synthetic course-to-chat flow. Missing checks remain explicit.

## Execution details

Approval mode: executable batch. Execution mode: standard. Tier: full, external media rendering.

### Ownership and scope

- Main owns live Kaltura access, exact-player checks, guarded prompt/disclaimer updates, production synthetic testing, integration and delivery.
- Executor owns `packages/markdown/src/index.ts` (export existing VideoEmbed), `apps/chat/src/components/markdown-text.tsx` (citation-first link interception), and `apps/chat/test/markdown-video.test.tsx` (actual rendered behavior). No parser expansion.
- Scope-bound simplification and risk/final review cover source and verification limits.

### Verification and recovery

- Allowed provider with explicit plain label produces iframe. Unknown hosts and ordinary/formatted labels remain anchors. Citations retain precedence. Wrapper remains valid inside paragraphs.
- Existing shared video tests, focused chat regression, package build, type and format checks run in the task container. Browser captures cover desktop and compact layouts with synthetic content.
- Operator checks all three generated iframe URLs without Kaltura authentication, persona mapping, text fallback, course enrollment, consent, levels, two conversations, feedback and reload. Cap: 35 synthetic assistant replies and CHF 10; no budget increases or resets.
- Live update uses unique anchors, bound snapshot, rollback rehearsal, one commit and exact readback. Immutable receipts stay gitignored in the existing Catalyst task worktree. Preserve model/effort, ownership, KB and course configuration, and level-4 exclusion.
- Source rollback is ordinary revert. Configuration rollback must match its after-state; never replay completed applies.

### Working context

Target `v3`, base `bcdccb81cd05886510133f6a1b9106d89f987575`. Branch `enhance/chat-video-embeds`, worktree `trees/video-embeds-chat`. Artifact root `project/`. Use the exact worktree's chat runtime and stop/verify it at completion.

## Progress

Planner APPROVED after requiring exact-player checks without uploader privileges. Source implementation pending; runtime starting. Production inline acceptance remains gated on release/deployment.
