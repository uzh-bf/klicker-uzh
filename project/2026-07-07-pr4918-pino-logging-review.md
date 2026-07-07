# Review: PR #4918 "Pino logging" — path to production readiness

**Date:** 2026-07-07 · **Reviewer:** Claude (requested by @rschlaefli) · **Branch:** `pino-logging` @ `326ec7103` · **Related:** PR #4750 (`feat-logging-package`)

## TL;DR

PR #4918 is the **right approach** and is worth finishing: it replaces all server-side `console.log` calls in `apps/auth` with structured, request-scoped pino loggers, matching the pino setup that already ships on `v3` in `apps/hatchet-worker-general/src/logger.ts`. It is **not mergeable today**: the typecheck CI job fails with two real type errors, several log statements leak OAuth parameters and personal data (emails, full Edu-ID profiles) at `info` level with no redaction, the default log volume is too chatty for production, and the branch is 235 commits behind `v3` (conflicts are trivial — only `apps/auth/package.json` and the lockfile).

PR #4750 (a hand-rolled, zero-dependency `packages/logging`) should be **closed**. It reinvents pino, is 515 commits behind with a failed SonarQube quality gate, and its "total silence in test env" design hides real errors. Its good ideas (correlation-ID propagation, GraphQL context logger, Prisma event-based query logging) should be salvaged into follow-up work on top of the pino direction.

Everything below is written so it can be executed step by step without further context. Steps 1–6 make this PR mergeable; step 7 is the follow-up roadmap.

---

## Part 1 — What PR #4918 does well (keep all of this)

| Aspect | Evidence |
| --- | --- |
| Complete migration of the auth server code | After the PR, `git grep 'console\.' apps/auth/src` finds only `pages/logout.tsx` (client-side, fine) and the intentional `console` calls inside `lib/logger/edge.ts`. All 58 server-side `console.*` calls are migrated. |
| Request correlation | `lib/logger/request.ts` reads `x-request-id` (or generates one) and binds it to every log line via a child logger. Much better UX than the old `[AUTH ${reqId}]` string-prefix grepping. |
| Consistency with existing precedent | `lib/logger/base.ts` mirrors `apps/hatchet-worker-general/src/logger.ts` on `v3` almost line for line: same `messageKey: 'message'`, ISO timestamps, `service` base binding, `LOG_LEVEL` + `PINO_PRETTY` env switches. One convention across services. |
| Edge-runtime awareness | Next.js middleware cannot run pino (worker threads / Node APIs unavailable in the edge runtime), so the PR adds a minimal console-based `EdgeLogger` with the same `.child()` API shape. Correct design choice. |
| Fixes silent failures | The `redirect` callbacks in `[...nextauth].ts` previously swallowed invalid-URL exceptions with an empty `catch {}`; the PR now logs a `warn` with the offending URL. Startup misconfiguration now logs `fatal` before `process.exit(1)`. |
| Scoped child loggers | `scope`, `authContext`, `callback`, and `route` bindings make it possible to filter logs per flow (e.g. all `signIn` logs for participants) in a log aggregator. |

## Part 2 — Findings (ordered by severity)

### F1 — BLOCKER: typecheck fails (this is the red "check" job on the PR)

Reproduced locally on the branch with `pnpm --filter @klicker-uzh/auth check` (ignore the `TS2307 Cannot find module '@klicker-uzh/prisma'` noise — those disappear once workspace deps are built, as CI does). The two real errors introduced by this PR:

```
src/lib/logger/edge.ts(40,5): error TS2322: Type '(messageOrContext?: string | Record<string, unknown>,
  maybeContext?: Record<string, unknown>) => void' is not assignable to type 'LogMethod'.
src/pages/api/auth/[...nextauth].ts(65,5): error TS2322: Type '(code: any, metadata: any) => void'
  is not assignable to type '(code: WarningCode) => void'.
```

plus `TS7006` implicit-any on the `createNextAuthLogger` parameters (lines 59/65).

**Why:**

1. `edge.ts` declares `LogMethod` as an overload set that includes `(context: Record<string, unknown>, message?: string): void` — a **string as second parameter** — but the implementation types its second parameter as `Record<string, unknown>`. The overload set and the implementation contradict each other.
2. next-auth 4.24.11 defines `LoggerInstance.warn` as **single-argument**: `warn: (code: WarningCode) => void` (see `node_modules/next-auth/utils/logger.d.ts`). The PR's `warn(code, metadata)` has two required parameters, which is not assignable. `info` is not part of `LoggerInstance` at all (it only sneaks through the `Record<string, Function>` index signature, which is why its parameters collapse to implicit `any`).

**Fix (exact edits):**

In `apps/auth/src/lib/logger/edge.ts`, replace the overloaded `LogMethod` with a single signature matching pino's common usage and the implementation:

```ts
export type LogMethod = (
  contextOrMessage?: string | Record<string, unknown>,
  messageOrContext?: string | Record<string, unknown>
) => void
```

and adjust `emit`/the arrow implementation accordingly (treat whichever argument is a string as the message, the other as context — the current implementation already almost does this; it only needs the second parameter widened to `string | Record<string, unknown>`).

In `apps/auth/src/pages/api/auth/[...nextauth].ts`, type `createNextAuthLogger` explicitly and drop the extra `warn` parameter:

```ts
import type { LoggerInstance } from 'next-auth'

function createNextAuthLogger(logger: AppLogger): Partial<LoggerInstance> {
  return {
    debug(code: string, metadata: unknown) {
      logger.debug({ code, metadata }, 'nextauth debug')
    },
    error(code: string, metadata: unknown) {
      logger.error({ code, metadata }, 'nextauth error')
    },
    warn(code: string) {
      logger.warn({ code }, 'nextauth warn')
    },
  }
}
```

(Remove the `info` method — next-auth never calls it.)

**Verify:** `pnpm run build` from the repo root (builds workspace deps), then `pnpm --filter @klicker-uzh/auth check` must exit 0.

### F2 — BLOCKER (privacy/security): sensitive values logged at `info` with no redaction

This is an auth service. The following log statements put secrets or personal data into log storage:

| Location | What leaks |
| --- | --- |
| `src/middleware.ts:75` — `searchParams: Object.fromEntries(request.nextUrl.searchParams.entries())`, logged on **every** request incl. `/api/auth/callback/*` | The OAuth **authorization `code` and `state`** query parameters. An authorization code in logs is a credential until it expires. |
| `src/lib/logger/request.ts:33` — child binding `url: req.url` (and `url: request.url` in middleware) | Full URL including query string → same `code`/`state`/`callbackUrl` leak on every log line of a callback request. |
| `src/lib/helpers.ts:218, 249, 453, 562` — `emails: …` payloads at `info` | Student email addresses (profile + affiliation emails) on every Edu-ID login. Personal data under GDPR; doesn't belong in routine logs. |
| `src/pages/api/auth/[...nextauth].ts:117` — `participantLogger.error({ profile }, 'missing sub in EduID profile')` | The **entire Edu-ID profile** (names, all emails, affiliation IDs). |

**Fix:**

1. Add a `redact` config to `apps/auth/src/lib/logger/base.ts` (pino built-in, zero cost):

```ts
const baseOptions: LoggerOptions = {
  // ...existing options...
  redact: {
    paths: [
      'url',
      'searchParams.code',
      'searchParams.state',
      'emails',
      'profile.email',
      'profile.swissEduIDLinkedAffiliationMail',
      'metadata.error.message', // nextauth sometimes embeds tokens in error messages
    ],
    censor: '[redacted]',
  },
}
```

2. Log `pathname` instead of the full URL: in `request.ts` and `middleware.ts`, bind `path: new URL(req.url ?? '/', 'http://x').pathname` (or `request.nextUrl.pathname`, already available in middleware) instead of `url`.
3. In `middleware.ts:75`, log only the **keys**: `searchParamKeys: [...request.nextUrl.searchParams.keys()]`. The keys are enough to debug the redirect flow; the values are not needed.
4. In `helpers.ts`, demote email payloads to `log.debug(...)` and log **counts** at info (`{ emailCount: emails.length }`). The counts answer "did matching work"; the raw addresses are only needed when actively debugging.
5. In `[...nextauth].ts:117`, log `{ profileKeys: Object.keys(profile) }` instead of the whole profile.
6. Note: the edge logger (`edge.ts`) does not support `redact` — that's why point 3 (log keys only) matters in middleware.

**Verify:** run the local login flow (step 6 below), grab the dev-server output for one full Edu-ID-style and one delegated login, and `grep -iE 'code=|@(uzh|students)' logs.txt` must return nothing.

### F3 — MAJOR: production log volume is too high at the default `info` level

A single `/api/auth/session` request currently produces ≥6 info lines (`middleware start`, `request:start`, `context detection input`, `context resolved: …`, `resolved auth context`, `request:finish`, plus `nextauth info` lines). next-auth clients poll `/api/auth/session` from every open tab. With a lecture hall of 300 students, that is thousands of info lines per minute that say nothing.

**Fix:** keep `info` for *state transitions* and demote *tracing* to `debug`:

- keep at `info`: `participant authenticated successfully`, sign-in failures, `invalid … redirect URL` (warn), `auto-accepted invitations …` (counts), `request:finish` **only for non-2xx or non-session routes** (easiest: log finish at `debug` when `req.url` starts with `/api/auth/session` or `/api/auth/_log`).
- demote to `debug`: `middleware start`, `request:start`, `context detection input`, `context resolved: …`, all `redirect check/relative/allowed/fallback` lines, `nextauth debug/info` passthroughs, `participant jwt` / `lecturer jwt`.

This keeps `LOG_LEVEL=debug` as the "full trace" switch for debugging redirect issues (the original purpose of these logs) while production defaults stay readable.

### F4 — MAJOR: edge logger emits objects, not JSON strings

`edge.ts` `emit()` calls `console[method](payload)` with a raw object. Outside of pretty dev terminals (i.e. in the container/k8s log pipeline), the platform decides how the object is stringified — Node prints `util.inspect` format (single quotes, no quoting of keys), which is **not parseable as JSON** by a log aggregator, and multi-line for nested objects (each line becomes a separate log record).

**Fix:** in `emit()`, add a timestamp and stringify:

```ts
const payload = {
  level,
  time: new Date().toISOString(),
  ...bindings,
  ...(context ?? {}),
  ...(message ? { message } : {}),
}
console[consoleMethod](JSON.stringify(payload))
```

Optionally keep the raw-object form when `process.env.NODE_ENV !== 'production'` for readable dev output.

### F5 — MINOR: verify the pino-pretty worker-thread transport actually works under Next.js dev

`base.ts` uses `pino.transport({ target: 'pino-pretty' })`, which spawns a worker thread and resolves the target by module path. Next.js keeps `pino`/`pino-pretty` in its default `serverExternalPackages` list, so this *should* work, but bundler regressions here are common. This is a "verify once, then forget" item — covered by the runtime verification in step 6. If it throws (`unable to determine transport target`), add to `apps/auth/next.config.mjs`: `serverExternalPackages: ['pino', 'pino-pretty']`. Also: replace the `transport as any` cast by passing the transport inside the options object (`pino({ ...baseOptions, transport: {...} })`), which is the typed API.

### F6 — MINOR: repo convention — new env vars missing from `turbo.json`

The PR introduces `LOG_LEVEL`, `PINO_PRETTY`, and `APP_NAME` reads but none are in `turbo.json` `globalEnv` (only `HATCHET_LOG_LEVEL` is there today). Repo rule (CLAUDE.md): every env var read at build/dev time must be listed so Turborepo cache invalidation sees it. Add all three. (`APP_NAME`: consider dropping it and hardcoding the service name instead — one less env var; the hatchet worker uses a dedicated `HATCHET_WORKER_NAME` for a real reason, the auth app does not.)

### F7 — MINOR: logger base is now duplicated

`apps/auth/src/lib/logger/base.ts` is a near-copy of `apps/hatchet-worker-general/src/logger.ts`. Two copies are acceptable for this PR (keep it small), but the third consumer (backend-docker, see roadmap) must trigger extraction into a shared `packages/logger` workspace package. Do **not** do the extraction in this PR.

### F8 — PROCESS: PR hygiene

- The PR body contains only the auto-generated ClickUp triage link. Before un-drafting, write a real description (use the `df-mr-description-writer` skill): motivation, what changed, how it was verified (screenshots/log excerpts from step 6), and the follow-up roadmap.
- Retitle to conventional-commit style, e.g. `enhance(apps/auth): replace console logging with structured pino loggers`.
- The commit list shows unrelated `v3-assessment` merge commits — harmless because the PR is squash-merged, but the squash title must be the retitled one.

## Part 3 — PR #4750 (`feat-logging-package`) assessment

**Recommendation: close it.** Reasons:

1. **It reinvents pino.** 4,532 added lines (200-line logger core + 1,293 tests + 1,768 lines of docs) to get level filtering, env-aware formatters, and child loggers — all of which pino provides, battle-tested, and which `v3` already uses in the hatchet worker. The "zero dependencies" goal solves a problem we don't have.
2. **Test-env total silence is a footgun.** `formatForTest` + no-op output means a test that triggers a real `logger.error` shows nothing. Cluttered test output is better solved with `LOG_LEVEL=silent` (pino supports it) so it stays opt-in.
3. **It logs via `console.log` under the hood** and would still be subject to F2/F4-style issues, with none of pino's `redact`/transport ecosystem.
4. **State:** 515 commits behind `v3`, `CONFLICTING`, SonarQube quality gate failed, CodeRabbit left 5 actionable + 19 nitpick comments. Rebasing it costs more than it returns.

**Salvage before closing** (reference these in the follow-up issue, they are genuinely good):

- `apps/backend-docker/src/logging.ts`: correlation-ID extraction from `x-correlation-id` / `x-request-id` / `x-trace-id` with fallback generation, and the request-scoped child-logger helper that works for both Express and Fetch-API (Yoga) requests.
- `apps/backend-docker/src/index.ts`: Prisma **event-emit** logging (`emit: 'event'` + `prisma.$on(...)` → logger) gated behind a `PRISMA_LOG_QUERIES` env var — much better than Prisma's default stdout logging.
- `packages/graphql/src/lib/context.ts`: injecting a request-scoped logger into the GraphQL context so resolvers/services stop using bare `console.*`.

When closing, leave a comment: superseded by #4918 (pino direction, consistent with hatchet workers); good parts tracked in the follow-up issue.

## Part 4 — Step-by-step execution plan (junior-executable)

Work on the `pino-logging` branch directly. Steps 1–6 are one PR; keep commits per step for reviewability (squash-merge at the end).

### Step 0 — Setup

```bash
git fetch origin && git checkout pino-logging
export VOLTA_FEATURE_PNPM=1   # required for the pinned pnpm (see repo memory)
pnpm install
```

### Step 1 — Update the branch from v3

Conflicts are only `apps/auth/package.json` + `pnpm-lock.yaml` (verified with `git merge-tree`, 2026-07-07):

```bash
git merge origin/v3
# package.json conflict: keep BOTH sides' dependency lists; the pino lines to keep are:
#   "pino": "9.9.5",  "pino-pretty": "13.1.1"
# consider bumping pino-pretty to 13.1.3 to match apps/hatchet-worker-general exactly (syncpack will complain otherwise)
git checkout --theirs pnpm-lock.yaml   # take v3's lockfile...
pnpm install                            # ...then regenerate entries for pino
git add -A && git commit
pnpm run check:all                      # will still fail typecheck until step 2 — that's expected
```

### Step 2 — Fix the typecheck (F1)

Apply the two exact edits from F1. Then:

```bash
pnpm run build && pnpm --filter @klicker-uzh/auth check   # must exit 0
```

### Step 3 — Redaction + PII cleanup (F2)

Apply fixes 1–6 from F2. Commit separately with a message noting the security relevance.

### Step 4 — Log-level pass (F3) and edge JSON output (F4)

Apply the demotion table from F3 and the `JSON.stringify` change from F4.

### Step 5 — Conventions (F6)

Add `LOG_LEVEL`, `PINO_PRETTY` (and `APP_NAME`, or remove its usage) to `turbo.json` `globalEnv`. Run `pnpm run check:all`.

### Step 6 — Runtime verification (mandatory, use the agent-browser skill)

The repo rule: frontend/auth-flow changes must be verified in the browser, not by reading code. This also covers F5.

1. Start the stack (`pnpm run dev` with Infisical, or `dev:raw`; Traefik setup per `.agents/skills/agent-browser/SKILL.md`).
2. Via `npx agent-browser`: log in as **delegated lecturer** (`lecturer` / `abcd`) and as **student** (`testuser1` / `abcdabcd`, participant flow).
3. Capture the auth app's server output for both flows and check:
   - every line of one request shares the same `requestId`;
   - no `code=`, `state=`, raw email addresses, or full profile dumps at default level;
   - `LOG_LEVEL=debug` restores the full redirect trace;
   - dev output is pretty-printed; `NODE_ENV=production PINO_PRETTY=false` output is one JSON object per line (pipe a few lines through `jq .` to prove parseability) — middleware lines included (F4);
   - no pino transport crash on boot (F5).
4. Save the log excerpts — they go into the PR description as verification evidence, plus screenshots of both successful logins.

### Step 7 — PR finish

1. Rewrite the PR body (`df-mr-description-writer` skill), retitle (F8), attach step-6 evidence.
2. Mark ready for review; confirm all CI checks green (the previously failing `check` job and the flaky cypress shard).
3. Close #4750 with the superseded-by comment (Part 3) and open one follow-up issue: *"Adopt shared pino logging in backend-docker and packages/graphql"* covering: extract `packages/logger` from the two existing copies (F7); adopt in `apps/backend-docker` (4 `console.*` sites in `index.ts`, 3 in `app.ts`, 3 in `migration.ts`); inject a request-scoped logger into the GraphQL context and migrate the ~550 `console.*` calls in `packages/graphql/src` incrementally; salvage the correlation-ID + Prisma-event pieces from #4750; align `messageKey`/field naming with whatever the k8s log aggregation expects.

### Definition of done

- [ ] Branch merged with `origin/v3`; `pnpm run check:all` passes locally
- [ ] `check` CI job green; cypress shards green
- [ ] No OAuth params / emails / profile dumps in logs at default level (grep evidence)
- [ ] Session polling produces no info-level noise
- [ ] Edge (middleware) logs are single-line JSON in production mode
- [ ] `turbo.json` `globalEnv` updated
- [ ] PR description rewritten with verification evidence; PR un-drafted
- [ ] #4750 closed with rationale; follow-up issue created
