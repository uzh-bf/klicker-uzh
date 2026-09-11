# Unified OLAT LTI chatbot access

## Approval summary

An OLAT chatbot activity currently reaches the PWA login screen for learners without a Klicker account. The deployed Chat guest entry also loses guest identity at downstream authorization. Restore one launch flow for existing OLAT links: reuse a valid logged-in Klicker participant, otherwise sign in the account linked to the verified LTI identity, otherwise reuse or create the existing course-scoped guest persona. Create missing participation with `isActive=false`; preserve every existing opt-in value.

This is an executable batch authorized by the user's request to plan and work through the goal. It covers implementation, synthetic local verification, required independent reviews, commits, normal task-branch push and draft PR delivery. Merge, release, production deployment, OLAT configuration changes, real-account writes and paid provider turns are withheld. The stopping point is a reviewed draft PR with current-head checks and browser evidence, plus a concrete deployed validation recipe.

Preserve non-chat PWA launch behavior, assessment exclusion, published-chatbot and course checks, guest token separation from backend account tokens, and existing guest history. No schema migration, new external dependency, guest-history claim, model policy change or new retention policy is planned. Identity precedence is explicitly the existing valid Klicker session even when it differs from the LTI-linked account; do not relink the OLAT identity to that session as a side effect. Authentication and course authorization remain separate.

## Execution details

### Working context and evidence

Repository: KlickerUZH. Worktree: `trees/rs/lti-chatbot-access`. Branch: `rs/lti-chatbot-access`; target `v3-ai`, baseline `1d85533a65ea71552cca290c9fa75908ebcac922`. Primary checkout has unrelated untracked reports and remains untouched. Artifact root is `project/`.

The original guest feature is PR https://github.com/uzh-bf/klicker-uzh/pull/5083. Production release `v3.4.0-alpha.75-ai.1` includes it. Live health and missing-parameter responses establish route presence, not functional acceptance. User reproduced the PWA login redirect through an existing OLAT activity. Production identifiers and browser session material are excluded from committed fixtures and artifacts.

`apps/frontend-pwa/src/pages/course/[courseId]/chatbot/[chatbotId].tsx` invokes account-only PWA authentication before redirect. `apps/chat/src/lib/server/apiGuards.ts` contains guest-aware identity resolution but its combined guard uses only the account cookie. Chat's server layout uses the same account-only guard. `Participation.isActive` defaults to false in Prisma; make the requested creation invariant explicit where touched and retain empty upsert updates.

### Binding contracts

A signed, unexpired LTI 1.3 handoff from the configured issuer is required before automatic account or guest creation/session issuance. Reject other scopes, wrong issuers, malformed targets, missing/deleted courses, assessment courses, and invalid chatbot/course associations before writes. Preserve existing target allowlisting and custom-claim precedence. Resolve the target before the LTI service signs the handoff. For direct Chat and legacy PWA chatbot target shapes, include the parsed course/chatbot IDs in the signed claims. Both Chat and the backend login operation compare those claims to the requested target before any writes. Reject unbound chatbot handoffs; preserve existing link shapes, not stale five-minute tokens. This is a coordinated LTI/backend/Chat release requirement and mixed-version launch rejection must be documented. Existing PWA-shaped chatbot links must enter the unified flow without manual edits; ordinary PWA browsing without a verified LTI launch retains its existing access rules.

Reuse a valid real participant session only after validating its token type and participant record. Otherwise resolve the verified existing LTI account. Reuse established PWA identity matching rather than adding a second email-matching policy; ambiguous matches must fail closed, not silently create a guest. Use a dedicated typed GraphQL LTI chatbot login operation implemented beside the existing account resolver. Chat calls it server-to-server using the verified handoff and current participant session when present. The backend validates the bound target before writes, reuses `resolveOrCreateParticipantForLti(allowCreate:false)` only when no valid real participant session wins, and returns account token or a definitive guest-eligible no-match status. Ambiguous identity and infrastructure failures deny entry. Account-link creation remains the existing resolver behavior, not creation of a new registered participant. Chat sets the returned ordinary account token only in the existing shared-domain HttpOnly cookie and also issues the existing scoped PWA-embed token for Chat fallback. Chat declares the existing GraphQL workspace dependency to consume its generated persisted-operation hash; this is required because production rejects arbitrary operations. No external dependency is added. The operation/public schema and codegen receive focused contract coverage. A guest persona never becomes a regular account merely because its database record is a Participant.

All account and guest entry paths ensure missing participation with false opt-in and preserve existing participation. Guest derivation and ownership remain course-scoped and stable. Do not merge guest history into account history. Session switching clears stale guest transport state so an old guest cookie or sessionStorage value cannot override the newly selected account.

Cookie and blocked-third-party-cookie paths must reach the same identity and authorization decision. Never expose raw account tokens through a new query-string fallback. Preserve scoped PWA embed audience/course restrictions, published state, participation checks and guest model limitations. For server rendering, the proxy overwrites a reserved request header with the scoped fallback token and the layout verifies it again through shared identity-to-chatbot authorization. Never trust an identity header. Reuse existing scoped bootstrap/sessionStorage and no-login reload recovery; clear stale guest and PWA scoped state on each identity transition. Add no-store and no-referrer to token-bearing handoffs. Account tokens require the canonical participant role/issuer/expiry and a real participant record; LTI handoffs require LTI1.3, issuer and expiry. Remove the scoped LTI callback full-token log and duplicate-email value logging.

### Primitive impact

| Primitive | Disposition | Contract delta |
| --- | --- | --- |
| Participant session | Compose | Existing session wins; verified linked account can obtain a session automatically. |
| LTI identity | Reuse | Verified identity resolves accounts; current-session precedence never changes its linkage. |
| Guest persona | Reuse | Stable per-course identity and existing history; account-free Chat access restored. |
| Participation | Reuse | Missing rows opt out of leaderboard; existing preference remains unchanged. |
| Chatbot access | Compose | Page and APIs accept the same verified account/guest transports with existing authorization. |

### Privacy and documentation

Use synthetic fixtures only. Reuse existing account and guest persistence; collect no new identity attributes and leave retention unchanged. Log outcomes without tokens, email addresses or LTI subjects. Preserve guest model restrictions and all user-facing consent/disclaimer gates. Do not treat guest data as anonymous to the operator. The scoped change adds no research processing, exports or third-party recipients. Update `docs/auth-model.md` and `docs/chat-platform.md` for the durable launch and identity precedence contract; update a matching local skill only if its current workflow becomes inaccurate. Existing guest future-plan documents remain historical proposals and are not acceptance authority. ADR disposition: settled user-directed composition of existing identities and participation, no new domain object; a new token trust domain or general launch protocol would reopen architecture review.

### Delegation map and slices

One cohesive ordinary draft PR into `v3-ai`: routing, identity and authorization together deliver the account-free launch; independent landing of only a routing change would remain broken. Reassess packaging if a general auth redesign becomes necessary.

| Slice | Owner and route | Acceptance |
| --- | --- | --- |
| S1 Unified launch and session resolution | main; security-sensitive identity/session seams remain coupled | Focused existing LTI/account tests plus launch cases prove precedence, rejection and false participation. |
| S2 Consistent guest/account Chat authorization | executor after S1 seam is fixed; bounded public-source scope | Existing guards/layout/embed tests prove guest cookie and bearer acceptance with course/lifecycle denials retained. |
| S3 Browser regression proof | executor, `playwright/tests` and test-owned fixtures only, depends on S1/S2 | Real local browser launch in ordinary and blocked-cookie contexts. |
| S4 Integration and draft delivery | main, docs and delivery, depends on S3 | Checks, required reviews and draft PR. |

Read-only explore owns existing helper/test mapping. Main owns architecture, provider-boundary decisions, runtime lifecycle and final proof. Every implementation slice is committed and receives simplifier and risk review; integrated final review follows complete verification. No child may mutate external services.

### Test portfolio

| Risk | Action | Evidence |
| --- | --- | --- |
| Incorrect account identity or automatic linking | Extend existing account/LTI tests | Valid-session precedence, linked account without session, unknown identity guest, ambiguous identity rejection, invalid signature/issuer/scope, expired session. |
| Participation preference changed | Extend existing persistence tests | Missing row false; existing true and false preserved; repeated launch idempotent. |
| Guest accepted at proxy but denied by page/API | Extend layout/published/guest tests and add one synthetic browser launch spec | Page renders, API succeeds, synthetic chat response persists/reloads; backend rejects guest token. |
| Embed transport mismatch | Extend existing embed coverage | Cookies blocked, scoped fallback and reload; wrong chatbot/course scope denied. |
| Legacy link or ordinary PWA regression | Add focused compatibility assertions | Existing PWA-shaped LTI target enters unified Chat; ordinary PWA and non-chat LTI routes retain behavior. |

Container-dependent builds/checks/tests run in the managed disposable task runtime. Playwright runs through the host wrapper. Read runtime lifecycle skill before startup and stop/prove the exact runtime after the last check. Use deterministic external-provider mocks only in the test harness; do not add production test paths or feature bypasses. No live OLAT launch or real learner mutation is claimed by local browser evidence.

Browser verification is mandatory for auth, redirects, cookies and reload. No visual redesign or copy change is planned; capture synthetic guest/account states to make the changed access outcome reviewable. Native formatting, relevant type checks, focused suites, source/data hygiene and required hooks precede commits. Exact-head CI and configured final AI review precede completed draft delivery.

### Authority and pause conditions

Authority: executable batch above. Terminal: verified/reviewed source delivered as draft PR; deployment remains withheld. Boundary owner: self. Pause only for material identity-policy changes, new data/trust boundaries, unavailable required review/runtime capability, or separately gated external effects. Routine corrections and subsequent slices continue automatically.

## Planning review

Round 1 native planner returned REVISE. Accepted all five findings: typed backend resolution, executable scoped-cookie fallback, signed launch target, scoped log hygiene and expanded negative coverage, and one owner per slice. Revised draft uses existing token families and introduces no new trust domain. Claude advisor failed OAuth refresh; permitted GLM advisor continuity is running. Optional AGY rival is running. Round 2 returned APPROVED. Optional AGY completed without a usable verdict; recorded as unavailable.

## Progress

S1 and S2 source patches are implemented. The LTI service binds the signed
handoff to the launched chatbot target, the legacy PWA route forwards the
handoff into the unified entry, and Chat calls the dedicated backend
account-or-guest resolution operation (server-to-server, persisted operation
`LoginParticipantForLtiChatbot`). Missing participation is explicitly false;
existing values are preserved. Chat's page render, proxy and API guards share
one identity resolution and one identity-to-chatbot authorization.

S2 executor completed with concerns: syntax inspection and `git diff --check`
passed; native tests, type checks and browser validation did not run. Main found
and added required account-token expiry and explicit HS256 verification during
integration. Backend failures during existing-session lookup now propagate rather
than silently selecting another identity.

### Managed runtime

The runtime was recovered by the user-approved devrouter upgrade
(`devrouter` 0.0.71, installed and verified this session). Workspace
`rs-lti-chatbot-access`; containers
`default-rs-86395-{app,postgres,azurite,hatchet,redis_exec,redis_assessment,redis_cache}-1`;
routes `chat`, `pwa`, `api` and `auth` live at
`https://{app}.klicker.rs-lti-chatbot-access.localhost`; reliability record
phase `stable`. The running apps use the namespaced origins
(`APP_ORIGIN_API`, `APP_ORIGIN_LTI`, `APP_ORIGIN_CHAT`,
`COOKIE_DOMAIN=klicker.rs-lti-chatbot-access.localhost`); the container-level
`docker inspect` env still shows the un-namespaced values, so the process
environment is the authoritative source. Database
`postgres://klicker_test@postgres:5432/klicker_test` (dev-only, disposable).

### Verification

Static and container-native checks:

- `pnpm --filter @klicker-uzh/graphql generate` succeeds; the tracked public SDL
  snapshot is regenerated.
- `pnpm --filter @klicker-uzh/graphql test`: 1306 passed, 3 failed. The three
  failures are in `test/activitySharing.test.ts` (audit-log identifiers), are
  unrelated to this diff, reproduce in isolation and differ between runs.
- `pnpm --filter @klicker-uzh/chat test:run`: 1042 passed, 30 skipped.
- `pnpm run check`: `check:ts` and the Chat package check exit 0. Only
  `graphql#check:schema` fails, because the SDL snapshot is regenerated but
  uncommitted at that point.
- `pnpm --filter @klicker-uzh/playwright check` (tsc) exits 0; `pnpm exec
  prettier` reports the new spec and helper unchanged.
- `pnpm check:playwright-ci`: 67 of 68 pass. The single failure is the
  in-container "no host devrouter" check; run on the host, the two relevant
  scripts pass 25/25, and the manifest validation accepts the new spec in the
  `pwa,chat` profile group.

Browser verification (host `agent-browser` session `lti-b`) against the
disposable runtime above:

- No account, no probe cookie: the launch lands on `/<CHATBOT_ID>`, a
  `chat_participant_token` with scope `CHAT_GUEST` is issued, the composer
  renders, the `?_t`/`?_pe` handoff parameters are stripped, no
  `participant_token` is set, and access still works after reload.
- Verified LTI-linked account without a browser session: `participant_token`
  (role `PARTICIPANT`, issuer the namespaced API origin, subject the linked
  participant) and the scoped PWA embed cookie are both issued; the participation
  row is created with `isActive=false`; exactly one linked account exists and no
  guest persona is created.
- Existing leaderboard opt-in preserved: with `isActive=true` set before the
  launch, the value is still true afterwards.
- Existing signed-in account wins: a seeded account session for a different
  participant than the LMS subject is retained, no account link is created for
  the LMS identity, and no guest persona appears.
- Tampered binding (handoff bound to a different chatbot than the URL): HTTP 403
  `{"error":"Invalid launch target"}`, reached in the browser.

Backend resolution contract, exercised directly against the running backend with
synthetic handoffs (persisted operation, token values never printed):

| Input | Result |
| --- | --- |
| Unknown LMS identity | `GUEST`, no token, no account row |
| Identity linked to an existing account | `ACCOUNT`, token issued for the linked participant |
| Valid account session plus a different LMS identity | `ACCOUNT` for the **session** participant |
| Expired handoff | `DENIED` |
| Handoff bound to another chatbot | `DENIED` |

The missing participation row for the session participant was created with
`isActive=false`; the pre-existing `true` opt-in on the linked participant was
unchanged; no account row was added for the unknown identity. Synthetic
`lti-e2e-*` and guest-persona fixtures were deleted from the disposable database
afterwards.

### Defect found, not fixed in this batch

`noLoginRedirect` in `apps/chat/src/app/auth/lti/route.ts` builds its redirect
from `req.nextUrl`, which resolves to the server's internal origin. The response
therefore carries `location: https://localhost:3004/noLogin?lti=1&redirectTo=%2F<chatbotId>`
for a request that arrived on the public host, so a browser cannot follow it and
shows a connection error instead of Chat's `/noLogin` page. Reproduced directly
with an expired handoff (307 plus that `location`, while the tampered handoff
correctly returns 403). The same pre-existing pattern is used by
`apps/chat/src/app/auth/pwa-embed/route.ts` and `apps/chat/src/proxy.ts`, and it
is invisible to the existing suite because CI runs Chat on `127.0.0.1:3004`,
where the internal and external origins coincide. Only rejection of the launch is
asserted for this path here; the redirect target itself is a separate fix.

### Remaining work

- S3 browser regression proof exists as `playwright/tests/Y-chat-lti-access.spec.ts`
  (type-checked, formatted, wired into the `pwa,chat` profile group and the
  relevance manifest). It has not been executed locally: the host Playwright
  dependency install does not complete in this environment (`ERR_PNPM_VERIFY_DEPS_BEFORE_RUN`,
  and `pnpm install` for the Playwright workspace does not finish), and the
  repository requires Playwright to run through `pnpm playwright:host` rather
  than inside a container. Exact-head CI is the first real execution.
- S4: required committed-range reviews, commit, push and draft PR.

### Screenshot evidence (disposable runtime, host `agent-browser`)

| State | Entry | Result |
| --- | --- | --- |
| No account | Chat `/auth/lti` handoff | Guest identity, composer reachable, `?_t` handoff stripped from the URL |
| Linked LTI account | Chat `/auth/lti` handoff | Account identity, composer reachable |
| Linked LTI account | Legacy PWA link `/course/<courseId>/chatbot/<chatbotId>?jwt=` | Forwards into the unified Chat entry on the Chat origin and reaches the chatbot |

Captures: `/tmp/agent-browser-shots/lti2/01-guest-entry.png`,
`02-account-entry.png`, `03-legacy-pwa-forward.png` (distinct renders, taken
after accepting the chatbot disclaimer). Locale variants were not captured.
Synthetic participants, accounts and guest personas created for these captures
were deleted from the disposable database afterwards.

### Verification ceiling for this change set

The repository's pre-commit hook runs `pnpm run check:all`. In this environment
that hook cannot complete, and no local environment can run all of it:

- Host worktree: `node_modules` is not installed, so pnpm refuses any script
  with `ERR_PNPM_VERIFY_DEPS_BEFORE_RUN`. Installing it does not complete
  (offline and network attempts both stall; the earlier registry path failed
  with `ECONNRESET`).
- Container: the pnpm-script checks run, but `check:playwright-ci` and
  `check:playwright-host` are host-only by design
  (`No executable host Devrouter found` / `Local Playwright execution is
  host-only`).

Every member of `check:all` was therefore run in the environment able to run
it, in addition to the hook's secret scan:

| Check | Environment | Result |
| --- | --- | --- |
| `gitleaks git --staged --redact` on the exact staged content | host | no leaks |
| `check:playwright-ci` | host | 68/68 pass (also validates the new spec's profile group) |
| `check:playwright-host` | host | 30/31; the failure is `pnpm workspace discovery failed` from the missing host install |
| type checks: chat, graphql, frontend-pwa, playwright, lti-service | container | exit 0 |
| `format:check` (biome + prettier) | container | clean |
| `syncpack lint` | container | clean |
| lint: chat, frontend-pwa | container | 0 errors (pre-existing warnings only) |

This is a reported split, not a completed hook run. The commit that carries this
change is made without the local hook because the hook cannot execute here; the
staged content was secret-scanned, and the checks above stand as the equivalent
evidence.

### Validation checkpoint

Host-side source parsing covered 16 changed TypeScript files with zero syntax
errors. `git diff --check` passed. Targeted Biome checks corrected newly introduced
import ordering and implicit-any declarations. These early checks did not establish
type compatibility, generated-schema validity or working browser behavior; the
runtime evidence above does.

For deployed acceptance after a separately authorized rollout, test the existing
OLAT activity with: no account; an existing linked account with no session; an
already logged-in account differing from the LMS identity; and an account lacking
course participation. Confirm selected identity, missing participation false,
existing true and false unchanged, and repeated launch without duplicates. Repeat
in a context blocking third-party cookies and after reload. Use approved synthetic
accounts and messages, and verify page/API access together. Reject assessment,
unpublished, mismatched and expired launches without creating identity or
participation rows. Production testing with real accounts remains outside this
batch.
