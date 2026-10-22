# Review: Pino logging stack — PRs #5316–5320

> **Resolution log — 2026-09-12 (later same day).** Actions 1–7 of Part 6 were
> implemented as 8 local commits (`76da493b5`…`085e4d4708`) on a local
> `feat/logging-server-apps` in the linked worktree; nothing has been pushed.
> **P1-2 was retracted**: a live probe against the real Hatchet SDK 1.9.4
> context dispatch showed error-path fields arrive top-level (`event:
> "probe.failed"` verified); the static analysis had mis-traced the SDK's
> `warn/error(message, extra)` getter contract. The fix became a regression
> test pinning that contract through the real SDK Context class. All gates
> re-run green after the changes: logging 40/40, hatchet 139/139, backend 8/8,
> chat 8/8, olat-api 8/8, typechecks for all touched packages, ESLint,
> format:check, server-console guard, gitleaks (no leaks), syncpack N/A (no
> package.json changes), `helm template` verified with and without the value.
> Commits: test-env precedence fix; Hatchet regression test + facade comment;
> olat-api adapter alignment; backend 5xx test; chat auth/MCP logger migration
> (+3 extra console sites beyond the two scoped handlers); pwa SSR logger;
> observability docs; chart `logging.logLevel` plumbing.

**Date:** 2026-09-12 · **Reviewer:** ZCode (requested by @rschlaefli) · **Author:** Patrick Louis Aldover
**Scope:** stacked branches `feat/logging-foundation` → `feat/logging-hatchet-correlation` → `feat/logging-core-apis` → `feat/logging-auth-integrations` → `feat/logging-server-apps` (tip `b502baa86c`)
**Method:** full static review of every layer, plus live runtime verification in a linked devrouter worktree (`feat-logging-server-apps`) — all logging test suites executed in-container, real HTTP/GraphQL/auth-edge traffic driven, and a real Hatchet course-duplication task traced end-to-end.

## TL;DR

The stack is **architecturally sound and substantially production-ready**. It delivers exactly what ADR 0002 promises: a thin shared contract package, NDJSON on stdout, explicit correlation context, allowlist-first privacy with central redaction as backstop, and a narrow AsyncLocalStorage bridge only inside Hatchet task attempts. Every central design claim was **verified live** — including full request-ID propagation from a browser header through the GraphQL API into worker-side task records across a process boundary.

It is **not flawless**: one environment-sensitive contract break (a set `LOG_LEVEL` env var defeats the "silent in tests" guarantee — reproduced as a failing test in the devcontainer), one real correctness bug (Hatchet error-path events bury their semantic `event` under `extra`, making all failure events unqueryable by the documented contract), an outlier adapter in `olat-api`, and a series of consistency debts (event-naming deviations, double logging on failure paths, response-header and `outcome` asymmetries). None are privacy blockers: the sweep of ~318 call sites found **no leaked bodies, tokens, cookies, emails, or participant data** in pino records.

Landing requires a sequencing decision: the five PRs are internally clean (~10.4k additions / 199 files total) but sit on `v3-audit`, which itself carries ~185k insertions of the `v3-ai` lineage relative to `v3`. The stack cannot land on `v3` before its base branch does (or a rebase).

Recommendation: **fix P1-1/P1-2/P1-3 on the stack, land the base line, then merge.** The full action list is in Part 6.

---

## Part 1 — What the stack does well (verified, keep all of this)

| Aspect | Evidence |
| --- | --- |
| Record contract is real and exact | Live records match the documented shape precisely: `{"level":"info","time":1789221439428,"service":"backend-graphql","requestId":"review-valid-123","correlationId":"review-corr-456","event":"http.request.completed","http":{"method":"POST","route":"/api/graphql","statusCode":200,"durationMs":28},"msg":"HTTP request completed"}`. No `pid`/`hostname`; epoch-ms `time`; lowercase level labels. |
| Hostile input handling | Live probes with 200-char, `../../etc/passwd`, and whitespace IDs → each replaced by a fresh `crypto.randomUUID()`, correlation defaults to request ID, UUID echoed back. The `[A-Za-z0-9._-]{1,128}` allowlist is enforced at every ingress. |
| Health-probe hygiene | `/healthz` (backend), `/health` (chat, olat-api), `/healthz`+`/` (response-api) are suppressed; live `GET /healthz` produced an echoed header and zero completion records. |
| Unmatched-route cardinality safety | Unknown paths log as route `/unmatched` (backend, response-api) — verified live with a 404: `"route":"/unmatched","statusCode":404`. No label-cardinality explosion from arbitrary URLs; no URL/query strings ever enter records. |
| Edge logger is allowlist-by-construction | `packages/logging/src/edge.ts` drops every field not in `approvedFields`; `child()` re-filters. Prototype-pollution level names (`__proto__`, `constructor`) normalize to `info`. |
| Central redaction backstop | 15 exact paths (`authorization`, `headers`, `body`, `payload`, tokens, `password`, `secret`, `connectionString`, …) censored to `[REDACTED]`; canary-tested. |
| Chat content firewall | `sanitizeChatLogContext` is the strongest privacy control in the repo: allowlist keeps counts/token-usage/byte-sizes, drops **even content-derived hashes**, raw provider errors, prompts, model/deployment names. Exact-equality tested. |
| Correlation across process boundaries | Live end-to-end: browser `x-request-id: review-hatchet-e2e` → backend `http.request.completed` → Hatchet `loggingContext` envelope → worker `hatchet.task.started`/`hatchet.task.completed` all carrying `requestId`/`correlationId: review-hatchet-e2e`. The course ("Testkurs Pino Review") was actually created — the task ran, not just the logs. |
| Crash-safe flushing | Probes: a record logged immediately before `process.exit(0)` and before an uncaught exception both reached stdout. Synchronous stdout NDJSON has no lost-buffer window. |
| Diagnostic IDs stay diagnostic | No call site uses `requestId`/`correlationId` as a business key. The assessment pipeline's business MD5 `correlationId` (Redis dedup) is deliberately kept separate from the diagnostic envelope (`packages/hatchet/src/auditLogging.ts:6-8`). |
| Test quality | Suites parse JSON and assert parsed fields (not string-matching); redaction canaries; once-only completion; ID validation tables; thrown-error canary absence. The chat suite is the strongest. |

---

## Part 2 — The layered architecture (as found)

```
Layer 4  Output          prod: bare NDJSON → stdout → (K8s → Alloy → Loki, infra repo)
                         dev:  in-process pino-pretty (sync stream via createRequire)
                         test: silent     edge: dependency-free allowlist serializer → console sink
Layer 3  App integration 11 apps: Express middleware (backend), Next route wrappers (chat),
                         edge proxy (auth/chat), SSR helpers (pwa), node:http (response-api,
                         olat-api), worker lifecycle (2 hatchet workers), lti service logger
Layer 2  Correlation     x-request-id/x-correlation-id → resolveRequestContext → pino child
                         → GraphQL ctx.log → additive Hatchet loggingContext envelope →
                         AsyncLocalStorage bridge (single task attempt) → worker records;
                         propagationHeaders() on outbound calls (pwa apollo, internal fetches)
Layer 1  Contract        packages/logging: node.ts (createLogger + redact), edge.ts, request.ts
                         (ID validation), levels.ts (normalization, inherited-name rejection)
```

The ADR's boundary decisions hold in code: the shared package owns only contract/validation/defaults; apps own framework adapters and lifecycle; no app-side network log transport; no app-wide ALS; no global exception handlers.

---

## Part 3 — Findings (ordered by severity)

### P1 — should fix before merge

**P1-1. `LOG_LEVEL` env var defeats the "silent in tests" contract.**
`packages/logging/src/node.ts:31-33`: `options.level ?? process.env.LOG_LEVEL ?? (environment === 'test' ? 'silent' : 'info')`. The devcontainer exports `LOG_LEVEL=info` (`.devcontainer/devcontainer.env`), so every workspace with that env set produces noisy test output and the documented test-silent guarantee breaks. **Reproduced live:** `packages/logging` suite fails in the linked worktree (`test/node.test.ts:99` "is silent by default in tests" — one record `time:1789221217420` leaked) while passing in CI where `LOG_LEVEL` is unset. Fix: give the test-environment silent default precedence over the ambient env var (or unset `LOG_LEVEL` in test setup), and add an env-precedence test — currently untested entirely.

**P1-2. Hatchet error-path events bury their semantic `event` under `extra`.**
`apps/hatchet-worker-response-processor/src/processors/processor.ts:53-59` and `assessmentProcessor.ts:44-50` wrap error fields as `{ extra: fields }`; combined with `mergeContextExtra` (`packages/hatchet/src/logging.ts:39-57`) and `pinoFields` (`:114-118`), the emitted pino record has top-level `event: 'hatchet.task.log'` with the real event (`response.processing.failed`, `response.assessment.failed`, `dependency.unavailable`, `groups.rolling.failed`, `course_deletion.failed`) nested as `extra.event`. Info-path calls surface fields top-level, so **identical events are queryable on success paths and unqueryable on failure paths** — precisely inverting operational value. This directly violates the ADR consequence "every owned production event has stable `service`, `event`, … fields". Fix in one place: make `taskError` pass fields top-level like `taskInfo`, or unwrap `extra` in `pinoFields`.

**P1-3. `olat-api` adapter is the outlier on every axis.**
`apps/olat-api/src/requestLogging.ts`: uses `res.on('finish')` not `once` (`:50` — only adapter without once, double-log risk on retried finishes); silently drops unmatched requests instead of logging `/unmatched` (`:32-35`); `logRequestFailure` uses fallback `'unmatched'` without the leading slash (`src/index.ts:52`); and the failure paths double/triple-log (`http.request.failed` + `completed`, `/openapi.yaml` adds `dependency.read_failed`). Its parameterized-route regexes are also the only untested templates. Bring it to the backend/response-api pattern.

### P2 — fix early, not necessarily pre-merge

- **P2-1. Double logging on failure paths.** `response-api/src/index.ts` server catch emits `http.request.failed` and then the 500 response's `finish` emits `http.request.completed` at error level (two records per failure; olat-api worse, see P1-3). Pick one owner for the failure record.
- **P2-2. Backend 5xx level untested.** `apps/backend-docker/test/requestLogging.test.ts` never asserts the `>=500 → error` mapping (`requestLogging.ts:60`); chat/response-api/olat suites all test theirs.
- **P2-3. Deprecated API is the only one used.** `toSafeError` is marked `@deprecated` in favor of `createSafeError` (`packages/logging/src/node.ts`), but the branch has **67 `toSafeError` usages and 0 `createSafeError`**. Either un-deprecate or migrate; shipping a deprecated-only API is noise.
- **P2-4. Docs vs pipeline field naming.** `docs/observability.md:205` LogQL example queries `correlation_id="…"` while records emit camelCase `correlationId`; the snake_case mapping lives in the external Alloy config (`df-cloud-klickeruzh`, GitLab MRs) and is unverifiable from this repo. State the exact structured-metadata field names in the doc or link the cloud spec. Also document which emitted fields (`outcome`, `reason`, `http.*`, `durationMs`) are **not** structured metadata and only full-text searchable.
- **P2-5. Worker service naming split.** `hatchet-worker-general` derives pino `service` from `HATCHET_WORKER_NAME` (deployment-configurable drift), while `hatchet-worker-response-processor` ignores that env var and derives from `ASSESSMENT_MODE` — even though the Helm chart sets `HATCHET_WORKER_NAME` for both (`deploy/charts/klicker-uzh-v3/templates/cm-hatchet-workers.yaml:17,60,75`).
- **P2-6. Unwrapped chat route handlers.** `apps/chat/src/app/auth/lti/route.ts` (6 sites) and `app/auth/pwa-embed/route.ts` (4 sites) still log raw errors via `console.*` (e.g. `:82` `console.error(LOG_PREFIX, 'LTI JWT verification failed:', error)`) — raw verification error text to stdout in an app that has a redacting logger.
- **P2-7. SSR console residual.** `apps/frontend-pwa/src/lib/getParticipantToken.ts:147` bare `console.error(e)` on a server path (raw error, no record shape).
- **P2-8. Trace context dead-ends.** Only `frontend-pwa` SSR parses `x-trace-id`/`x-span-id`; no server middleware does, and nothing generates WTs — the fields exist in the contract but can never be populated on server ingress. Fine as forward-compat, but say so in the doc.
- **P2-9. Test-coverage gaps in the shared package.** Timestamp freshness (`time` asserted only as `any(Number)`), `LOG_LEVEL` precedence (see P1-1), and redact paths (only 4 of 15 canary-tested: `authorization`, `headers.cookie`, `req.body`, `payload.token`).
- **P2-10. Production level plumbing absent.** Neither `LOG_LEVEL` nor `PINO_PRETTY` exists in the Helm values/templates on the branch; production defaults to `info` with no tuning path. Add value plumbing before the first "turn chat down to warn" incident.
- **P2-11. Coverage gaps by app.** `lti` has a logger but zero request logging and zero diagnostic-ID handling (the one server flow with no correlation at all); `frontend-manage`/`frontend-control` have loggers used only for `service.started` (manage's two SSR pages log nothing on failure, unlike pwa's 13).

### P3 — consistency debt (batch into a follow-up)

1. **Event-name deviations** from the dot-separated, past-tense convention: `auth.redirect_cookie.updated`, `auth.sign_in.*`, `service.configuration_invalid` (vs backend's `configuration.invalid`), `service.start_failed`, `hatchet.worker.starting_jobs`, `process.unhandled_rejection`/`process.uncaught_exception`, `response.block_closed`, unprefixed `participant_token.invalid` (chat proxy), ~13 `chat.*` `_failed` variants mixing both styles.
2. **Asymmetric lifecycle events:** auth emits `http.request.started` with no `completed` (every `/api/auth` call logs one noisy line); pwa emits `ssr.request.failed` with no success event (SSR success rate unmeasurable); workers have no `service.started` (9 other apps do).
3. **Response-header asymmetry:** backend and olat-api echo only `x-request-id`; chat, response-api, and auth echo both headers. Standardize (both is the majority and more useful).
4. **`outcome` inconsistency:** chat (`success|rejected|failure`) and olat-api (`success|failure`) attach `outcome` to completion records; backend and response-api don't.
5. **Duplicate task fields:** every `hatchet.task.*` record carries both `workflowName` (SDK-injected) and `workflow` (app-added) with identical values — observed live. Drop one.
6. **Fatal-level zero-signal:** workers' `process.uncaught_exception`/`unhandled_rejection` handlers log only `toSafeError('Unhandled rejection')` — the real error object is discarded entirely at fatal level; you learn *that* the process died, never *why* (contrast: chat's 500 path also discards the cause; both poles of the privacy/diagnosability tradeoff are present — pick a middle: `errorType` + owned message, as the task wrapper already does).
7. **Worker stdout mixes SDK banners with NDJSON** (live: `🪓 … [INFO/Worker/…]` lines between records). ADR says Alloy preserves non-JSON lines, so tolerated — but workers will never be 100% parseable; worth a doc note.
8. **`response-api` silently drops all OPTIONS preflights** (route `/` suppression) — intentional but undocumented coupling.
9. **`LOGGED_ROUTES` coupling is implicit** (`apps/backend-docker/src/requestLogging.ts`): adding a path to the Set without registering the identical literal yields silent `/unmatched`; a shared constant or a test enumerating mounts would pin it.
10. **`createTaskAppLogger`** (`packages/graphql/src/lib/taskLogger.ts`) maps fatal→error and re-wraps warn/error in `{ extra }` (same nesting family as P1-2); its `forward()` merges caller extras with no sanitizer equivalent to chat's.
11. **Audit trails carry PII by design** (outside pino's contract): `response-api` assessment audit `info` embeds participant `sub` + raw response JSON; `assessmentProcessor` thrown errors embed `participantId` and restrictions JSON into Hatchet task errors. Deliberate audit requirement, but flag for the data-protection discussion — these bypass every logging-layer control.
12. **Soft typing boundary:** `courseDuplication.ts:832` casts a reconstructed context's `requestContext` into the GraphQL context type — harmless today, no compile-time guard if future helpers start reading it as business context.

---

## Part 4 — Runtime verification evidence (linked worktree `feat-logging-server-apps`)

All checks performed against the routed container stack at branch tip `b502baa86c`.

**Test suites (in-container):**

| Suite | Result |
| --- | --- |
| `packages/logging` (21 tests) | **1 failed** — silent-in-test contract broken by ambient `LOG_LEVEL=info` (P1-1); 20 pass |
| `apps/backend-docker/test/requestLogging.test.ts` (7) | pass |
| `apps/response-api/test/requestLogging.test.ts` (8) | pass |
| `apps/olat-api/test/requestLogging.test.ts` (3) | pass |
| `apps/chat` logging suites (8) | pass |

**Live traffic (all verified in `/tmp/dev.log`):**

- `POST /api/graphql` with valid headers → exact-contract completion record (quoted in Part 1).
- Hostile `x-request-id` (200×`a`, `../../etc/passwd`, `bad id here`) → fresh UUIDs echoed and logged; correlation falls back to request ID.
- `GET /healthz` → header echoed, **zero** completion records.
- `GET /no/such/route` → 404 logged as `route:"/unmatched"`.
- GraphQL validation error (400, bad variables) → completion record at `info` (4xx ≠ error, correct).
- Auth edge: both headers echoed on responses; forced redirect decisions produced `"event":"auth.redirect.rejected"` (400, `audience:"lecturer"`) and `"auth.redirect_cookie.updated"` (307) NDJSON records with request IDs bound.
- `LOG_LEVEL=error` at runtime → `info` records suppressed, `error` emitted (level plumbing works end-to-end).
- Crash-flush probes → records survive `process.exit(0)` and uncaught exceptions.
- **Hatchet end-to-end** (via browser delegated-login session, mutation `startCourseDuplication` with `x-request-id: review-hatchet-e2e`): backend completion record → Hatchet event push → worker `hatchet.task.started` (`requestId`/`correlationId` present, `workflowRunId`/`taskRunId`/`retryCount`) → ~8s later `hatchet.task.completed` (`durationMs`) with the same correlation; duplicated course confirmed present in the lecturer's course list. Scheduled tasks (`sweep-stale-course-duplications`) correctly carry no correlation IDs.

---

## Part 5 — Merge readiness

**The five PRs are internally clean and correctly stacked:**

| PR | Head → Base | Size |
| --- | --- | --- |
| #5316 | `feat/logging-foundation` → `v3-audit` | +3,874 / 27 files |
| #5317 | `feat/logging-hatchet-correlation` → foundation | +1,444 / 17 files |
| #5318 | `feat/logging-core-apis` → hatchet-correlation | +1,615 / 63 files |
| #5319 | `feat/logging-auth-integrations` → core-apis | +767 / 21 files |
| #5320 | `feat/logging-server-apps` → auth-integrations | +2,662 / 71 files |

**But the base is not `v3`.** `v3-audit` sits 191 commits / 1,152 files / ~185k insertions above `v3` (the `v3-ai` lineage: chat, MCP, KB ingestion, audit, telemetry). The roadmap phrasing "targeting `v3`" is imprecise — the stack lands only after `v3-audit` (or its line) lands in `v3`. Additionally, current `origin/v3-audit` has **advanced beyond** the commit the stack was cut from (`merge-base --is-ancestor` fails), so a rebase/re-stack check is needed at merge time.

**Other readiness notes:**

- `turbo.json` correctly adds `LOG_LEVEL`/`PINO_PRETTY` to `globalEnv` (commit `0b3d8fb891`).
- CI wiring for Playwright packaging of the logging runtime exists (`ad358e18ec`, `591ff18a33`).
- Helm values lack any logging env plumbing (P2-10).
- The shipping half (Alloy → Loki, structured metadata, `service_name` from `app.kubernetes.io/component`) lives in the `df-cloud-klickeruzh` GitLab MRs — **out of this repo and unreviewed here**; the LogQL examples in `docs/observability.md` depend on that config's field renaming (P2-4).
- Plan checkboxes for "submit the five PRs as drafts" and "stage acceptance after the cloud parent MR is deployed" remain unchecked — merge and promotion are still human-controlled, as designed.

---

## Part 6 — Recommended actions (ordered)

1. **P1-1:** Reorder level precedence so test-env silence beats ambient `LOG_LEVEL` (or clear it in vitest setup); add env-precedence tests. One-file fix on the foundation layer.
2. **P1-2:** Fix Hatchet error-path event nesting — `taskError` top-level fields or `pinoFields` unwrapping `extra` (touches `packages/hatchet` + both processors; add a regression test asserting top-level `event` on error paths).
3. **P1-3:** Align `olat-api` to the reference adapter (`once`, `/unmatched`, slash fallback, single failure record, route-template tests).
4. **P2-2/P2-9:** Close the identified test gaps (backend 5xx level; timestamp freshness; full redact-path table; chat `err` assertion).
5. **P2-6/P2-7:** Wrap the two chat auth route handlers; replace the pwa SSR `console.error`.
6. **P2-4:** Cross-check structured-metadata field names against the actual Alloy config in the cloud MRs; document queryable vs full-text-only fields.
7. **P2-10:** Add `LOG_LEVEL` (and `PINO_PRETTY`) to the Helm values before first production deploy.
8. **Decide the landing sequence** (`v3-audit` line → `v3`, then the stack in order), and re-check the base drift at merge time.
9. **Follow-up batch (P3):** event-name normalization pass, `outcome`/response-header standardization, drop duplicate `workflow`/`workflowName`, worker fatal-level diagnostics (`errorType` at minimum), LTI request logging, manage/control SSR failure logging, `createSafeError` migration or un-deprecation.
10. **Carry to the data-protection discussion:** audit-trail PII (response-api assessment `info`, processor thrown errors) and the pre-existing Teams-notification raw errors — outside pino's contract but in scope for the same review conversation.

---

## Appendix — Verified service names

`backend-graphql` / `backend-assessment` · `auth` · `chat` · `frontend-pwa` / `frontend-assessment` · `frontend-manage` · `frontend-control` · `response-api` / `response-api-assessment` · `olat-api` · `lti` · `hatchet-worker-general` (env-derived — see P2-5) · `hatchet-worker-response-processor` / `-assessment`
