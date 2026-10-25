# PR #5109 — Final Production Readiness Evaluation

Date: 2026-08-03
Evaluated head: `35aa6fc12` (branch `codex/manage-assistant-mcp-v3-ai`, base `v3-ai`)
Context: evaluated immediately after the `v3-ai` base integration (`e26e4bf2b`,
TypeScript 6 / Prisma 7 / Biome / Knip / Gitleaks) and its review-fix commit
(`35aa6fc12`). Readiness contract:
[2026-07-28 production readiness improvement plan](./2026-07-28-pr-5109-production-readiness-improvement-plan.md).

Method: three parallel evaluation passes (regression test suites, readiness-gate
audit, live browser verification against the running dev stack), each performed
by an independent agent, findings verified and reconciled by the orchestrating
session. One browser finding was investigated and rejected as a false positive
(see §5).

## 1. Verdict

**The branch is technically ready at head.** All agent-closable automated gates
pass at `35aa6fc12`. What remains is (a) a small set of evidence-refresh items
that depend on production-image rebuilds or paid judge spend, and (b) the
human-only gates: VoiceOver pass, merge/production-enablement authority, the
cluster apply for the new `mcp-lecturer` workload, the prd image-tag bump, and
the one-way Prisma migration deploy. None of the three evaluation passes found
a product regression from the base merge.

## 2. Evidence at head

### CI (GitHub, at `35aa6fc12`)

52 checks pass; the single failure is GitGuardian — the known inherited
staging-JWT disposition on `v3-ai` (secret already rotated; closed by a
separate fix PR, not this one). The green set includes the eight Playwright
shards (which cover `Y-manage-assistant` and `Y-course-chat-drawer`),
`test-graphql` (DB-backed resolver suite), `test-mcp-lecturer` (unit + migrate
+ seed + live-server `smoke:local` and `smoke:negative`), Cypress, CodeQL,
SonarCloud, and twenty Docker image builds.

### Regression suites (run today at head, in-container / host)

| Suite | Result |
| --- | --- |
| `@klicker-uzh/chat` `test:run` (incl. S1 request envelope) | 236/236 pass, incl. the 16 focused Manage-assistant prompt tests (exact baseline match) |
| `@klicker-uzh/mcp-lecturer` unit | 40/40 pass |
| `@klicker-uzh/mcp-student` unit | 28/28 pass |
| `grading` / `util` / `markdown` | 10 + 58 + 34 pass |
| Offline evaluator contract suite (host, `pytest -m offline`) | 95 passed / 53 deselected (exact baseline match) |
| `uv lock --check`, Ruff (evaluation/manage-assistant) | clean |
| Repo gates (in-container) | check 27/27, format:check clean, syncpack / agents-md / prisma-sync clean, production build 24/24 |

Deliberately not run: the 15-minute full judged evaluator (prohibited without a
behavioral change; no behavioral file changed in the merge).

### Live browser verification (dev stack at head, Chromium)

Screenshots: `project/screenshots/2026-08-03-readiness-*.png` (13 files).

- **Manage lecturer assistant — PASS.** Delegated login, drawer opens with
  `role="dialog" aria-modal="true"`, focus contained (Tab/Shift+Tab wrap
  verified), a real prompt returned a correct fully streamed answer through
  LiteLLM→OpenRouter (`POST /api/manage/chat` 200), close restores focus and
  page interactivity.
- **Error contract — PASS.** A real 500 rendered only the generic
  "Something went wrong. Please try again." A deliberately leaky mocked
  response (canary secret, connection string, file path) put zero canary
  strings into the accessibility tree; the route logs the stack server-side
  and responds `{"error":"Manage assistant request failed"}`.
- **PWA course-chat drawer — PASS.** testuser1 login, disclaimer gate accepted
  through the UI, real streamed answer with references and credit accounting
  (`Tutor — GPT-5.5 — 0.02 credits`), close restores the page. Multi-chatbot
  selection is not exercisable on seeded data (single "Benibot"); the absence
  of a selector for a single bot is correct behavior.
- **Regression spot-check — PASS.** Manage question pool and PWA course page:
  no hydration errors, no console errors, no `MISSING_MESSAGE`/Intl artifacts.

## 3. Gate table (reconciled)

Statuses reconcile the gate audit with the same-day test/browser runs.
"Refreshed today" means evidence now exists at `35aa6fc12`.

| # | Gate (plan §9 + §7) | Status | Evidence / remaining action |
| --- | --- | --- | --- |
| 1 | S1 request envelope (16 MiB ceiling, 413/deadlines, trust boundary) | **MET — refreshed today** | chat suite 236/236 at head |
| 2 | S2 PWA drawer modal contract + E2E | **MET** | 8/8 Playwright shards green at head |
| 3 | S3 no silence-based E7 pass | **MET — refreshed today** | offline pytest 95/95 at head |
| 4 | S4 consolidated automated gate at one clean commit | **MET — refreshed today** | union of check/build (27/27, 24/24), chat suite, offline eval, CI — all at head |
| 5 | Live judged eval OVERALL: PASS | MET-BUT-STALE | 148/148 on 2026-08-01 predates the base merge. Merge touched no prompt/runtime behavior file; live browser smoke today proves the runtime plumbing streams real model answers. Refresh option: targeted 15-test E3/E7 subset (needs spend authority). |
| 6 | Firefox/WebKit vs production builds | MET-BUT-STALE | 46/46 on 2026-07-29 against images compiled under TS 5.6/Prisma 6, which no longer correspond to head. Refresh: rebuild 3 production images at head, rerun `PLAYWRIGHT_RELEASE_MATRIX=true … --project=firefox --project=webkit` (~90 s once images exist). |
| 7 | VoiceOver pass (Manage modal + PWA drawer) | **OPEN — human-only** | Never executed; automated a11y coverage is explicitly not a substitute. |
| 8 | Wiki/skills/eval README/plan Progress match implementation | **MET — fixed today** | `docs/log.md` carried the 2026-08-03 merge entry already; plan §10 Progress entry for the base merge + this evaluation added in this commit. |
| 9 | Independent review gate at head | LARGELY MET | Merge commit `e26e4bf2b` received a dedicated read-only review today (2 findings, both fixed in `35aa6fc12`); this evaluation is itself a three-pass review at head. The four pre-merge behavior commits (`222552b07`…`6e81b6357`) were covered by the PR's 33 resolved review threads but have no dedicated review entry in the plan — recorded here for the merge decision. |
| 10 | PR body and live head/check state agree | **OPEN — agent-closable** | Body still names head `6e81b6357`, 162 commits/318 files; live head is `35aa6fc12`, 164 commits/322 files. Refresh the Head SHA, counts, and Verification block. |
| 11 | No unresolved review threads | **MET** | 33 threads, 0 unresolved (read live today). |
| 12 | Merge + production enablement authority | **OPEN — human-only** | Plan gate G1. |
| 13 | Chat pod memory sizing probe (200 Mi request / 400 Mi limit) | MET-BUT-STALE | 235 MiB peak measured 2026-07-29 pre-merge. The merge removed `@prisma/client` from chat deps (Prisma 7 resolves through `@klicker-uzh/prisma`), so the idle baseline may have moved either way. Re-probe against a production standalone build at head before the values are applied. |
| 14 | MCP auth happy/negative smoke vs live server | **MET** | `test-mcp-lecturer` green at head. |
| 15 | EN/DE desktop/mobile screenshots | MET (cosmetic-only exposure) | 2026-07-28 set; merge changes to `apps/chat` globals.css were formatting-only. Today's Chromium set adds fresh EN evidence. |

## 4. Deployment gates the DoD did not enumerate (all human-only)

These were surfaced by the gate audit and are **not listed in plan §9**; they
must be on the enablement checklist:

1. **Cluster apply** — the PR ships a new production workload
   (`deployment-mcp-lecturer.yaml`: Deployment/Service/HPA/PDB/ConfigMap,
   +54 lines prd values) and resizes chat memory 50Mi/200Mi → 200Mi/400Mi.
   Cluster-level change; requires separate explicit apply approval.
2. **prd image tag** — `deploy/env-uzh-prd/values.yaml:425` pins
   `mcp-lecturer-arm: v3.4.0-alpha.61`, a tag cut before the app or its build
   workflow existed; no such image was ever built. A `helm upgrade` with the
   committed values would ImagePullBackOff (loud, not silent). Bump at deploy
   time to a tag built after merge.
3. **Prisma migration deploy** — `20260726184305_assistant_proposal_audit`
   adds `ASSISTANT_PROPOSAL_CONFIRMED` to the `AuditLogType` enum. Additive
   and **one-way** (PostgreSQL cannot drop an enum value). The only writer
   wraps the insert in try/catch, so mis-ordered deploys lose an audit row,
   never a lecturer's confirmation. Plan §8's "no database rollback is
   required" conclusion survives, but the section reads as schema-neutral and
   should not.
4. **Nightly eval dispatch** — `test-manage-assistant-eval-nightly.yml` is
   schedule/dispatch-only and needs repository secrets plus one post-merge
   manual dispatch.
5. **GitGuardian** — closed by the separate inherited-leak fix PR on `v3-ai`,
   not by this branch.

## 5. Findings

### F1 (medium, rollback semantics) — the feature flag is UI-only and build-time

`NEXT_PUBLIC_MANAGE_ASSISTANT_ENABLED` is a Next build-time inline consumed
only by the Manage frontend launcher; it is absent from `.env.prd`/`.env.stg`,
so production images ship with the launcher compiled out — a fail-safe default.
But flipping it either way is an image rebuild + redeploy, not a Helm value
flip, so it is **not an incident-time kill switch**. And the server-side
routes (`/api/manage/chat`, `/api/manage/proposals/confirm`) carry no flag
gate: they are live for any authenticated lecturer as soon as the chat image
deploys. Recommendation: either add a server-side env gate to the
`/api/manage/*` family before enablement, or state explicitly in §8 that the
routes are considered safe while unreachable from the UI.

### F2 (low, robustness) — 2xx non-stream response yields silent UI

With the chat endpoint mocked to return HTTP 200 with a JSON error body, the
Manage transcript showed the user message and then nothing — no assistant
bubble, no error state. Only network failures and 5xx reach the generic error
UI. A real server never returns that shape; a catch-all "stream ended without
content" state would be more robust. Not a merge blocker.

### F3 (minor, a11y ergonomics) — Escape inside the iframe does not close the PWA drawer

The keydown lands in the cross-origin chat document, so the parent's handler
never fires. Inherent to iframe embedding; a `postMessage` escape signal from
the child would fix it. Keyboard users can still Tab to the close control.

### F4 (dev environment, not product) — `OPENAI_API_KEY` unwired in the devcontainer

The self-contained devcontainer sets `UPSTREAM_OPENAI_API_KEY` (for LiteLLM)
and `OPENAI_BASE_URL=http://litellm:4000`, but never `OPENAI_API_KEY`, so the
Manage assistant 500s out of the box
(`OPENAI_API_KEY is required for the Manage assistant`,
`apps/chat/src/app/api/manage/chat/route.ts:58`). The local proxy accepts any
bearer token, so a one-line dev-only default in `devcontainer.env` fixes it.
Production injects the real key via Helm — no production impact.

### Verified false positive — "aria-modal without background inertness"

The browser pass initially reported that both drawers declare
`aria-modal="true"` while the page behind stays non-inert. Investigation
rejected this: the implementations mark the actual app roots inert +
aria-hidden (`#__next` for the PWA in `CourseChatDrawer.tsx:161`, `#__app`
for Manage in `ManageAssistantWidget.tsx:184`), and the Playwright specs
assert exactly those attributes and pass in CI at head. The agent inspected
`#__next` on Manage (whose root is `#__app`), and its PWA hit-test result
(`elementFromPoint` → `BODY`) is precisely what an inert subtree produces.
No defect.

## 6. What stands between this PR and production

Agent-closable, in order:

1. Refresh the PR body (head SHA, counts, verification block) — gate 10.
2. Optional evidence refreshes if the release process wants them at head:
   Firefox/WebKit matrix on rebuilt production images (gate 6), memory
   re-probe (gate 13), targeted 15-test judged subset (gate 5, needs spend
   authority).

Human-only:

3. VoiceOver pass over both surfaces (gate 7).
4. Merge authority and production-enablement ruling (gate 12).
5. Cluster apply approval (new workload + chat resize), prd image-tag bump,
   `prisma migrate deploy`, nightly-eval secrets + dispatch (§4).
6. Landing the separate GitGuardian fix PR on `v3-ai`.

## 7. Environment notes from this evaluation (non-product)

- The dev stack had to be restarted after the base-merge verification (`turbo
  dev` had exited); restarted via `devrouter ensure` with the OpenRouter key
  injected through the approved Infisical-operator mapping.
- One PWA course route 404'd from the known typegen de-registration gotcha;
  remedied by touching the page file in-container.
- `apps/mcp-lecturer`/`apps/mcp-student` declare `engines.node: 20.x` against
  the Node 24 devcontainer (warning-only), and `mcp-student` lacks the
  `test:run` alias `mcp-lecturer` has — trivial consistency follow-ups.
