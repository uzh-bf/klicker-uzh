# Vorkurs Chatbot SDK Fix Plan

## Goal

Fix the Vorkurs chatbot's staging first-request stream failure after MCP tool
discovery. The package will move the chat app to the reviewed AI SDK patch
train, add a public-provider regression fixture for a sparse first tool-call
index, and document the failure mode and verification boundary.

Proof requires the focused stream fixture, the chat package suite, repository
checks, and the production build. Staging rollout and real-upstream smoke
evidence remain a later explicitly approved operation.

## Non-Goals

- No prompt, model registry, credits, MCP-server, ingress, Argo, deployment, or
  production changes.
- No upgrade to the newest registry patch releases beyond the narrow fix train.
- No new direct dependency on the transitive `@ai-sdk/provider-utils` package.
- No browser or live-upstream claim from the injected-fetch regression fixture.

## Plan Identity

- Plan path: `project/2026-08-09-vorkurs-chatbot-sdk-fix-plan.md`
- Branch: `rs/vorkurs-chatbot-sdk-fix`
- Target branch: `v3`
- Base checked: `origin/v3` at `092d99efff387b7cf4b6b874492d0228c819fc31`
- Related history: `project/2026-08-08-vorkurs-chatbot-finalization-plan.md`
- Current state: the branch has no implementation changes. The pre-existing
  untracked `project/2026-08-07-vorkurs-chatbot-production-adjustments.md`
  remains outside this plan and must not be staged.

## Research Summary

- The route uses `provider.chat(...)` when the selected model does not support
  reasoning and already passes `consumeSseStream: consumeStream` to
  `toUIMessageStreamResponse`; that option stays unchanged.
- The current direct pins are `ai@7.0.37`, `@ai-sdk/openai@4.0.20`, and
  `@ai-sdk/mcp@2.0.16`. Their shared provider-utils resolution is `5.0.12`.
- The installed `@ai-sdk/provider-utils@5.0.12` source stores streaming tool
  calls in an index-addressed array and iterates sparse entries during
  `flush()`. A first tool call at index `1` therefore reads `hasFinished` from
  `undefined`.
- A public local reproduction through `createOpenAI` and `streamText` emits
  the same `TypeError: Cannot read properties of undefined (reading
  'hasFinished')`.
- Registry metadata checked on 2026-08-09 confirms the approved train:
  `ai@7.0.52`, `@ai-sdk/openai@4.0.30`, and `@ai-sdk/mcp@2.0.25` all resolve to
  `@ai-sdk/provider-utils@5.0.21` and `@ai-sdk/provider@4.0.5`. Newer stable
  releases exist, but widening to them would add unreviewed scope and is
  explicitly out of scope for this fix.
- Primary sources: package registry metadata via `pnpm view`, the installed
  package sources, and local reproduction. The planning-stage reviewer
  independently confirmed the sparse-index diagnosis and fixture boundary.

## Runtime / Package Manager Findings

- Runtime: Node `24.17.0` in the current shell; the repository pins Node 24
  and pnpm 11.x.
- Surfaces: `apps/chat/package.json` and the root `pnpm-lock.yaml`.
- No Node, pnpm, Docker, CI, or deployment pin changes are required.
- Lockfile and direct dependency changes must land together.

## Deployment / Migration Findings

- This is an application dependency/test fix only. No migration hook, image
  layout, Helm value, Argo resource, or secret mapping changes.
- Later staging verification must use the existing GitOps path and three real
  Vorkurs first-turn requests. That work is not authorized by this package.

## Patch Findings

| Package | Current | Approved target | Class | Role | Notes |
| --- | --- | --- | --- | --- | --- |
| `ai` | `7.0.37` | `7.0.52` | patch | chat runtime | Aligns provider-utils fix |
| `@ai-sdk/openai` | `4.0.20` | `4.0.30` | patch | OpenAI-compatible chat provider | Exercises `provider.chat(...)` |
| `@ai-sdk/mcp` | `2.0.16` | `2.0.25` | patch | MCP tool integration | Keeps the provider train aligned |
| `@ai-sdk/provider-utils` | `5.0.12` | `5.0.21` | transitive patch | stream tool-call tracker | Fixes sparse index storage; do not pin directly |

## Local Development Design

The regression fixture uses an injected `fetch` returning an in-memory
OpenAI-compatible SSE response. It needs no database, MCP server, model key,
or running app. The fixture sends the first tool-call delta at index `1`,
splits its JSON arguments across deltas, sends `finish_reason: "tool_calls"`,
and terminates with `[DONE]`.

## Verification Baseline

- Confirm the branch/base and preserve unrelated untracked work.
- Run the focused fixture against the current dependency set to retain the
  red reproduction evidence before installing the approved train.
- After implementation, run the focused fixture, the full chat package suite,
  `pnpm run check:all`, and `pnpm run build`.
- Re-run the focused fixture after the broad checks and inspect the lockfile
  resolution plus staged paths for secrets and personal data.
- No browser evidence is required for this package because it changes no UI,
  selectors, i18n text, or auth flow. Real-upstream staging evidence remains a
  follow-up gate.

## Implementation Slices

### Slice 1: Reviewed plan and baseline

Files:

- `project/2026-08-09-vorkurs-chatbot-sdk-fix-plan.md`

Do:

- Commit this reviewed execution contract before implementation.

Check:

- Verify only the plan is staged; exclude the existing untracked production
  adjustments note.

Commit:

- `docs(project): add Vorkurs chatbot SDK fix plan`

### Slice 2: Sparse streamed tool-call fix

Files:

- `apps/chat/package.json`
- `pnpm-lock.yaml`
- `apps/chat/test/openai-chat-streaming.test.ts`
- `docs/chat-platform.md`
- `docs/log/2026-08-09-vorkurs-chatbot-sdk-fix.md`
- `.agents/skills/klicker-testing-verification/SKILL.md` if the focused test
  procedure needs a factual update

Do:

- Update only the three direct AI SDK pins and regenerate the lockfile.
- Add the public-provider SSE fixture. Assert one completed public `tool-call`
  with the expected parsed input and a terminal `finish` with unified reason
  `tool-calls`; do not assert internal implementation fields.
- Keep `consumeSseStream: consumeStream` in the route.
- Document the sparse-index failure and the local/staging evidence boundary in
  the chat wiki and its required dated log entry. Update the testing skill only
  for durable verification procedure facts.

Check:

- Focused fixture first, then chat tests, `pnpm run check:all`, `pnpm run build`,
  and a fresh focused-fixture rerun.
- Confirm the chat lockfile train resolves to provider-utils `5.0.21`.
- Review the exact staged diff for secrets, PII, unrelated files, and generated
  churn.

Commit:

- `fix(chat): handle sparse streamed tool-call indices`

## Progress

- [x] Read the handoff and verified the branch/base against the live repository.
- [x] Reproduced the exact failure through the public OpenAI-compatible stream
  path.
- [x] Completed the planning-stage read-only review and recorded its concern
  about newer out-of-scope registry patches.
- [x] Created the implementation branch from verified `origin/v3`.
- [ ] Commit this plan before implementation.
- [ ] Update dependencies and add the regression fixture.
- [ ] Update the chat wiki/skill evidence and run the verification matrix.
- [ ] Obtain the integrated final review before any PR or staging action.

## Open Questions

- None affecting the approved fix. The newer registry patch releases are
  intentionally deferred; a later dependency-maintenance package can evaluate
  them separately.

## Next Steps

1. Commit this plan as the branch's first commit.
2. Update the three direct chat dependencies and install the reviewed lockfile
   train.
3. Add and run the public-provider sparse-index regression fixture.
