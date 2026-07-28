# Student Chat v3 — Follow-Up Roadmap (handoff)

- Date: 2026-07-27. Author: agent session on PR #5197.
- Branch: `claude/student-chat-v3-design-3459db` → `v3`,
  [PR #5197](https://github.com/uzh-bf/klicker-uzh/pull/5197). Use the live PR head;
  do not copy a stale SHA from this roadmap.
- Parent plan: [2026-07-26-pr-5197-student-chat-v3-design-alignment-plan.md](./2026-07-26-pr-5197-student-chat-v3-design-alignment-plan.md)
  (execution history + environment recipe). Earlier plans: 2026-07-19 reskin,
  2026-07-23 production readiness.
- Audience: junior dev picking this up without session context. Every item has
  Do/Check steps. Read `docs/chat-platform.md` first — it is the ground truth
  for the chat app.

## How to work on this

- Env: devcontainer worktree stack per `CLAUDE.md` + plan §"Environment +
  verification recipe". All pnpm/prisma/tests run in-container
  (`devrouter exec . -- ...`), Playwright runs on host
  (`.agents/skills/klicker-playwright-e2e`). Browser verification with
  `agent-browser` is mandatory for UI changes.
- Gotchas that cost us hours (details in plan Progress, 2026-07-27 entry):
  don't run `pnpm --filter @klicker-uzh/chat check` while browsing the app
  (typegen 404s routes; remedy: touch route files); Turbopack EMFILE crash →
  kill `turbo run dev` in-container, `devrouter ensure` from the worktree dir;
  `docker exec` psql heredocs need `-i`; host-run Playwright needs a plain TCP
  proxy to Postgres (node-postgres cannot use the SNI route) — see
  `playwright/global-setup.ts` + the e2e skill.
- Public repo: no secrets, no `.env`, no personal data in any commit.

## W0 — Land PR #5197 (now, ~0.5d)

- Problem: PR is review-complete but not merged. Merge authority = maintainer.
- Do:
  1. Watch CI on the current PR head. Known flake: Playwright shard 5
     (G-elements-mc/U-catalog) — rerun failed jobs once before debugging.
  2. Attach UI screenshots to the PR (CLI cannot upload). Recapture per plan
     §"Environment + verification recipe": seeded four-source answer,
     branch pager 2/2 after a root edit, image-analyzed chip en/de, amber
     blockquote callout, thread-row mode subtitle. 1440x900 + 390x844.
  3. Triage any new bot findings (Greptile/CodeRabbit) on their threads;
     verify before implementing.
- Check: CI green, screenshots visible in PR body/comments, no unanswered
  review threads. Then hand to maintainer for merge.

## W1 — Live-model verification round (after key, ~1d)

- Problem: every model-behavior claim on the branch is unverified — the local
  stack has no `UPSTREAM_OPENAI_API_KEY`, so all citation/orthography checks
  ran against seeded tool parts, not a live model.
- Do (needs a dev model key injected into the devcontainer env at
  `devrouter ensure` time; never commit it):
  1. Citation contract: ask a doc_query-backed chatbot factual questions;
     confirm answers emit `[n]` markers that resolve to the rendered source
     cards, and that repeat sources reuse their number
     (`apps/chat/src/lib/server/citationInstructions.ts`).
  2. Orthography contract: German answers use ss/real umlauts, never ae/oe/ue
     (`withLanguageStyleContract`, unconditional in the chat route).
  3. Multi-step runs: credits decrease per `calcCost`, reasoning/tool
     streaming renders, image attachment turn produces the analyzed chip live.
- Check: notes + screenshots on the follow-up PR or issue; failures become
  prompt-contract fixes, not UI changes (UI degrades gracefully by design —
  bad markers render as plain text).

## W2 — Citation system phase 2 (needs doc-query service work, ~1-2w)

- Problem: display quality is capped by the doc_query payload. Blocked
  gap-map items: source thumbnails, transcript hover previews, media
  durations, video deep links.
- Do (contract: UI renders whatever `normalizeSourcesFromParts` yields, so
  service upgrades never need a UI rework — see plan §"Citation system —
  phase 2" and ADR 0004):
  1. doc-query service: per-source `excerpt` in answer mode, stable
     `source_id`, media metadata (real video timestamp field, thumbnail ref).
  2. klicker: signed URLs to open course-material sources; extend
     `apps/chat/src/lib/sources/` normalizer + cards for the new fields.
  3. Eval harness asserting `[n]` markers ground in returned sources.
- Check: unit tests over the new payload shapes; e2e with seeded new-shape
  parts; existing tests keep passing (backward compatibility with the three
  current payload shapes is a hard requirement).

## W3 — Telemetry repair (~2-3d)

- Problem: Langfuse traces do not export (OTel peer mismatch, recorded in
  `docs/chat-platform.md`); message-feedback mirroring to Langfuse is
  disabled pending that repair.
- Do: fix the exporter wiring in `apps/chat` telemetry setup, then re-enable
  vote mirroring in the feedback route and confirm scores land on the derived
  trace ids.
- Check: a live chat turn produces a trace in Langfuse; a thumbs-up appears
  as a score on that trace; killswitch env still works.

## W4 — Small hardening items (independent, ~0.5d each)

1. URL-gate guard: add a test or lint convention so any future doc_query
   field feeding an `href` must pass `isUrlLike`
   (`apps/chat/src/lib/sources/`). Check: test fails if a card/preview href
   bypasses the gate.
2. `withHashSuffix` edge: a server name longer than ~45 chars would push
   `doc_query` out of the kept prefix and silently disable
   sources/citations/chips for that server (documented in
   `docs/chat-platform.md`). Decide: keep documented, or warn/log when a
   configured MCP server name exceeds the safe length. Check: unit test on
   `lib/config/toolNames.ts`.
3. Axe: one known moderate finding (landmark/region + sidebar) from the
   accessibility pass. Re-run the a11y suite, fix or formally accept.
4. `useAISDKRuntime` transport swap: verified follow-up per ADR 0003
   (`docs/adr/0003-chat-framework-upgrade.md`). Own branch; do not mix with
   feature work.

## W5 — Environment chores (local dev, not release-blocking)

1. Upstream seed bugs (junior-executable, own PR):
   `seedAssessmentCourse` fails P2025 via `recomputeDerivedPermissions`
   (`packages/util/src/permissions/element.ts:339`, nested connect to a
   missing Element) and `packages/prisma-data/src/seedAccounts.ts:13` upsert
   is non-idempotent (`where` uses the user id, `create` writes an eduid
   string → P2002 on reseed). Both break the devcontainer post-create seed;
   its retry loop masks the first error. Check: raw seed runs twice cleanly
   against a fresh DB in-container.
2. Multi-stack `postgres` alias collision on the shared devnet: one stack's
   post-create can reset another worktree's DB. Machine-local issue; fix
   belongs in devrouter/compose aliasing, not this repo's app code. Until
   then: always run `devrouter ensure/exec` from the checkout you mean.

## W6 — Parked design decisions (need a design ruling first)

- Recorded as deliberate non-changes in the PR body; do not implement without
  a ruling: text logo vs `KlickerLogo.png` in the sidebar; segmented mode
  switcher vs mockup dropdown; chatbot-identity header vs course-code sidebar
  header (chat is chatbot-scoped and has no course data today).

## Suggested order

W0 now. W1 as soon as a dev key exists. W4.1/W4.2 and W5.1 anytime (small,
independent). W3 before any feature relying on tracing. W2 is the next real
feature epic and deserves its own plan file per the sliced workflow. W6 only
after design input.
