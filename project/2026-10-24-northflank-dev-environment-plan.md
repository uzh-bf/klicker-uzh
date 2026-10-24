# KlickerUZH full-stack Northflank trial with selective previews

## Approval summary

Qualify Northflank with the complete relevant Klicker development stack, then prove that a Chat-only PR starts only its supported dependency closure. This supersedes the earlier core-only pilot. Reuse `.devrouter.yml` and `util/profile-resolver.sh` as the profile authority, translate their results into native Northflank services, and reuse the existing changed-image inventory for automatic selection. Keep application processes in production-built containers; no host Devrouter runtime or Docker-in-Docker supervisor is proposed.

The trial includes Manage, PWA, Control, Auth, GraphQL API, response ingestion, both Hatchet workers, Chat, LiteLLM, the existing synthetic MCP harness, mock OIDC, SMTP capture, LTI and OLAT API, plus PostgreSQL and the three Redis roles. Analytics is an explicit synthetic one-time job. Office add-in and docs are build/artifact checks outside the backend stack; Office host execution remains a declared limitation. Real external identity/LMS/ingestion/storage integrations need their own named development targets; unavailable integrations must be reported rather than counted as passed.

Select `full` for initial qualification. Ordinary Chat work selects `chat,ai,mcp`: Chat, PWA, Auth and API, the shared data services, LiteLLM and the synthetic tool harness; Manage, Control, response ingestion, both quiz workers, LTI, OLAT, mock OIDC and SMTP capture remain off. Shared-schema, root-toolchain and ambiguous changes expand safely to full. Documentation-only changes create no environment. Explicit overrides may expand the automatic selection.

The user accepted a $50 total trial ceiling, including at most $2 of synthetic AI calls, and a 48-hour maximum lifetime. Reserve at least $10 within the ceiling for tax and uncertainty. Keep at most two simultaneous environments. Hypothetical small plans imply approximately $124.80/month compute for full and $81.60/month for Chat with AI/MCP; actual addon minimums, memory and build costs remain unmeasured. This proposal is not a provider-enforced spending cap.

The full-trial request and spending/lifetime constraints are accepted. The user requested concrete proposals for the DNS namespace, viewer networks and development-secret profile. The user approved those private bindings, correcting the DNS namespace; execute the named finite sequence within its cost and data boundaries. Continue independent source preparation without repeating the budget question. Success requires full functional checks, selective startup and shutdown receipts, safe update/pause/resume, explicit integration limitations, and cleanup of only the new synthetic trial resources. This is functional breadth, not an unrequested load test.

## Working context and evidence

- Worktree: `trees/rs/northflank-dev-environment-proposal`; branch `rs/northflank-dev-environment-proposal`; target `v3`.
- Controller baseline: fetched `origin/v3` at `dbe911583c33c7d0ca096da1ef977e9d4da0ceb3`. The first application candidate is the separately selected `v3-ai` revision.
- Artifacts root: `project/`. [Research](2026-10-24-preview-environment-research.md) preserves prior investigation and alternatives. Account-specific observations and review receipts remain in ignored `project/_local/`.
- Main session owns architecture, credentials, external effects, integration and final proof. Native source mapping is complete; the expanded plan gets a fresh planning review because its scope changed.
- Execution mode: standard; no exact allowlisted main-model ID was exposed. Current approval mode: executable batch with accepted full-trial scope and spending/lifetime limits; DNS/access/credential bindings approved; exact live prerequisites and budgets must pass before dependent effects.
- Application primitive impact: none. Preview identity, profile selection and lifecycle are infrastructure contracts.
- ADR: the trial does not yet adopt another permanent deployment platform. Successful adoption or a permanent multi-project operating contract triggers an ADR.
- Execution is active. Provider ownership, database qualification and the fixed cleanup deadline are recorded privately. Application builds, hosted functional checks and synthetic application AI checks remain pending.

### Verified source and platform findings

The existing pure resolver selects workers only for `live-quiz` and `full`. Chat includes PWA for its no-login route. Backend startup eagerly constructs all three Redis clients, and Hatchet is boot-critical, so these dependencies cannot be pruned merely because only Chat source changed.

The global host Devrouter reports 0.1.0 and rejects the current configuration. The repository-pinned 0.5.1 was installed into an isolated temporary cache and run with already installed Node 24.21.0. Native JSON resolution passed for six selections and matched the source probe. No global installation/configuration changed. Pin the compatible controller toolchain; reuse `util/devrouter-cli.mjs` for its version check.

A source-only probe of `.github/scripts/staging-image-targets.cjs` selected Chat for a Chat component change, Manage for a Manage page change, and the broad image set for a Prisma model change. This is build-selection evidence, not proof that the final hosted selector is implemented. The existing Playwright selector deliberately expands ready PRs to full and therefore cannot be reused as the preview startup selector.

Northflank supports conditional node execution through arguments/functions, private networking, preview expiry and pause/resume. Removing or skipping a resource node does not delete an earlier resource. The hosted reconciler must explicitly pause/deactivate resources no longer selected.

## Scope and profile contract

| Selection | Application processes | Additional capabilities | Persistent base |
| --- | --- | --- | --- |
| `manage` | Manage, API, Auth | none by default | PostgreSQL, Hatchet, three Redis roles |
| `pwa` | PWA, API, Auth | none by default | same base |
| `chat` | Chat, PWA, API, Auth | add `ai` for LiteLLM and `mcp` for synthetic tools | same base |
| `live-quiz` | PWA, Control, API, Auth, response API, both workers | email/OIDC only when selected | same base |
| `full` | All available registered application routes and both workers | LiteLLM, synthetic MCP, OIDC and SMTP capture | same base |

Use the canonical profile union and deduplication semantics. Capability selections `ai`, `mcp`, `email` and `eduid` keep their current meanings. The `db` route is an administrative access capability, not authority to expose PostgreSQL publicly.

Full means all relevant available services in the selected source tree. The default baseline has no `apps/mcp-lecturer` or `apps/mcp-student` Dockerfiles even though the trusted image inventory knows these integration-branch targets. For a source tree that contains them, include and qualify the real services through explicit bindings. The synthetic MCP harness does not qualify those application services or a real ingestion pipeline.

Analytics is a bounded job against synthetic data, not an always-running HTTP server. The current image has no service entrypoint to infer automatically; select and review its actual job command. Office add-in execution requires an Office host; docs and add-in builds do not justify adding backend services. The separate production assessment deployment topology is not silently reproduced by the devrouter full profile; test assessment behaviour and declare any unqualified deployment partition separately.

Live Chat/Auto routing and a synthetic MCP turn are in scope once the approved provider profile and AI budget exist. Full also verifies mock OIDC, a captured mail flow, and synthetic LTI/OLAT contracts. Actual SWITCH/OLAT launches, Azure upload/CORS, external course ingestion, graph preparation and real MCP application services need explicit development endpoints and source availability. Complete independent paths while recording any blocked path; do not mark the full trial passed with missing required evidence.

## Selection and native deployment design

### One profile authority

Use a small adapter that:

1. Reads the exact PR merge-base diff with both sides of renames and validated paths. A branch trial can request an explicit profile directly.
2. Uses the existing affected-image inventory to identify changed applications, then maps image identities to profile intent. Keep the small binding table in the Northflank runtime contract, not another copy of profile app lists.
3. Calls a compatible pinned Devrouter `profile resolve --json` for the canonical app/service/process union. Use the existing pure repository helper for the separate worker marker. A strict consumer validates every resolved name against approved native bindings.
4. Emits one values-free, immutable desired-state plan: source/base revision, selection reason, profile union, image/build inputs, selected native resources, readiness checks, resource bounds and capability flags.
5. Starts only selected builds/services/addons through native Northflank resource nodes. Build dependencies are not automatically always-running services.

`profile resolve` is preferred to forcing the Playwright literal-binding contract onto this adapter. The latter deliberately excludes OIDC/LiteLLM/MailHog and has an exact process policy unsuitable for all profile unions. The Northflank runtime contract maps resources to native targets; it does not redefine profile membership.

For ordinary Chat source changes, default to `chat,ai,mcp` so the reviewer can exercise a real synthetic model/tool turn. A UI-only explicit `chat` selection is possible but cannot qualify model/tool behaviour. A capability/config change selects every consuming profile. Backend, Prisma, auth, shared packages or root build changes use the inventory's impacted services and widen to full when narrowing cannot be proved. Unsupported profile names fail closed; unknown changed application paths select full. A proven docs-only diff selects no environment.

The deterministic image-to-intent binding is: Chat → `chat,ai,mcp`; Manage → `manage`; PWA → `pwa`; Control, response API or either worker → `live-quiz`; Auth/backend/migrator/LTI/OLAT, shared inputs and unresolved non-documentation paths → `full`. Merge multiple intents additively, with `full` dominating. An analytics-only change selects the auxiliary job with its owned synthetic PostgreSQL/fixture prerequisites, not HTTP applications. Docs/Office-only changes select their artifact checks. A non-documentation `no-change` inventory result is not evidence that no runtime is needed.

Treat dependency/tooling inputs outside the staging inventory explicitly: LiteLLM config changes select Chat/AI; synthetic MCP harness changes select Chat/AI/MCP. Database seed/bootstrap changes invalidate the fixture generation and cannot silently leave old data while reporting the new revision qualified. Block that update as requiring recreation; the finite trial may recreate only its owned synthetic environment when that recovery branch is approved and the original deadline/budget permit it. Ordinary source updates never reseed retained state.

Run selection without provider credentials. Record two immutable revisions: the approved controller revision supplies the workflow, planner, image-selection metadata, profile configuration/helper, native bindings and provisioner; the candidate revision supplies application source/build inputs. Pin the controller to the reviewed implementation commit before the first credentialed run. A candidate changing these control files does not replace the trusted versions: report the drift and require a separately approved controller update before adopting new profile membership or permissions. Use only the inventory's target/input selection metadata, never its staging `prep` commands or staging environment files.

The provisioner validates outputs against trusted bindings, budget/resource limits and the exact current event revision. Candidate workflow/profile changes do not grant new resources, secrets or permissions. Public forks remain outside privileged automatic deployment. Use one trusted adapter as the sole admission path; disable independent provider Git/GitOps auto-runs and per-service auto-deploy triggers that could bypass its selection and limits. Native blueprints still own resource creation and teardown. Initially run the adapter from the operator-pinned controller checkout on the host; credentials do not enter candidate source execution there. Keep its values-free trial receipts locally in the ignored artifact root. GitHub requires a new `workflow_dispatch` file on the default branch, so an unmerged branch alone cannot establish manual Actions dispatch. Do not merge solely to activate it. The source workflow and event/race tests can be prepared and exercised without provider credentials; actual automatic PR event activation remains an explicit adoption prerequisite after approved integration. Hosted qualification and automated controller-logic qualification are reported separately.

### Reconciliation and lifecycle

Use one environment identity per forge/repository/PR, with stable application origins and a recorded selected revision. Admit only the trial's exact source/repository/PR identities named before creation, with a fixed deadline that updates cannot extend. Use one trusted trial admission queue across both environments and serialize build/initialization/update, profile switches, pause/resume and teardown. Native blueprint run concurrency alone does not establish a lifecycle lock or an environment-count cap.

Before every queued mutation, re-read PR state and current candidate revision. Drop stale updates, duplicate operations, closed/merged PRs and expired/terminal trial identities. Close/merge, explicit teardown or the deadline closes admission before draining/deleting. A reopened PR can resume before terminal cleanup only under the original identity/deadline and remaining shared allowance; after deletion it needs a new explicit trial identity. An old queued update must never recreate deleted resources. Store values-free ownership, terminal state and aggregate build-attempt receipts in the pinned host runner's ignored trial artifacts, or trusted CI run artifacts after CI activation; missing or inconsistent accounting blocks new paid operations. Count attempts across both environments and both revisions, including retries and native retry attempts. Set retry policies explicitly; provider defaults cannot multiply the allowance silently.

A profile expansion creates/resumes newly required resources. A contraction drains and pauses unused compute explicitly; conditional nodes alone are insufficient. Preserve PostgreSQL and Hatchet data, and retain the resource inventory so later expansion and final cleanup find every resource. Paused resources may retain storage charges. Build services and immutable caches can remain reusable, but unused application processes must not stay active.

Use the cumulative PR diff, not only the latest commit, so an update does not forget earlier changes. Prove profile switching on an explicit trial environment as well as fresh automatic selection. When components remain selected, update them consistently with the resolved source/configuration; do not use an arbitrary last successful image from another revision. Filter the inventory by selected runtime bindings before building; exclude the separate `frontend-assessment-arm` deployment variant from this devrouter-shaped trial. The existing `reuse: true` flag permits fingerprint-based reuse of backend/migrator/workers/LTI/OLAT/response/analytics images across environments and revisions; it is not sufficient proof alone. Require unchanged complete source inputs, build configuration/toolchain, content digest and controller policy. Frontend images remain environment-specific. Key bootstrap and MCP harness tooling images by their own complete input fingerprints, with credentials/configuration injected only at runtime.

The full trial first uses one isolated environment; a second Chat environment then proves isolation and positive/negative startup inventories. Keep at most two environments active. Pause only when no quiz/assessment or migration remains active and in-flight work drains. Resume dependencies before applications, then require behavioural readiness. PostgreSQL/Hatchet remain durable; Redis may start empty under this idle-only contract.

Never report paused/deleted/billing-stopped from API acceptance alone. Record settled native resource states and the owned-resource usage receipt. Failed cleanup retains exact resource identities and blocks completion. Automatic expiry has a fixed trial deadline; a failed deletion is an operator recovery case, not a guaranteed spending cap.

## Runtime, data and ingress

Default to native PostgreSQL/Redis addons if role/database authority and minimum plans qualify. Before writing a provider adapter, compare ordinary `postgres:15` and `redis:7` containers with owned volumes where needed. The latter reuses the existing dependency topology but makes us responsible for image patching and database recovery. Select and quote one shape before provisioning the application set.

Preserve literal `klicker_test` login/database, ownership, privilege and `klicker-disposable-test-v1` marker checks for synthetic seeds. The local administrative bootstrap cannot be copied unchanged onto a managed addon. Use fresh environment-owned roles and generated credentials. Seed/guarded fixture jobs receive a constructed `DATABASE_URL` for the exact allowed user/database/URL parameters and no `PG*` environment keys. Do not link all native addon variables into those jobs: the current guard deliberately rejects PostgreSQL environment overrides. Scope only necessary aliases/values to other consumers. The database-authority proof includes this actual job environment shape. Reuse `packages/prisma/Dockerfile` for deployment migrations and a dedicated bootstrap/seed image for fixture initialization. Backend runtime images do not contain seed tooling.

Create and seed once; migrate on updates; resume without reset/reseed. Failed migration may commit partial DDL and cause P3009: block rollout, retain images, quarantine the environment and prohibit blind retries. Rebuilding the disposable environment is the default recovery.

Hatchet Lite is dev-grade and internal-only. Persist its engine configuration/keys and database, qualify its advertised gRPC address, and securely provision the client token. Do not assume a local shared `/config` volume can be mounted simultaneously by hosted services/jobs. Application containers receive only the required token; engine keys stay private.

Use one exclusive hostname family for each environment, with an approved DNS namespace, valid TLS and environment-scoped cookies. A wildcard TLS certificate covers only one label. A live Northflank form rejected nested `app.environment` subdomains beneath a wildcard-redirect grouping, even with individual HTTP certificates. Parent wildcard DNS resolution succeeded; native route registration is the constraint. Do not claim that one wildcard record alone qualifies the nested URL scheme.

The proposed correction is automatic DNS provisioning: one Northflank grouping per environment, with wildcard routing and a wildcard certificate for its app hosts. The controller creates the grouping's routing CNAME and ACME delegation CNAME through Azure DNS, verifies the grouping, and then runs the native preview. The first bounded trial proposes the operator's existing Azure session for the two exact records per trial environment; this proves the integration, not unattended CI authentication. Activation requires explicit Azure write approval naming the subscription, resource group, authoritative zone, record names, executing principal and cleanup effects in the private bindings. The existing Northflank project token has no DNS permissions; use the approved signed-in owner only for the finite trial's domain group setup. Existing login and DNS naming approval do not grant Azure write authority.

For ongoing automation, an isolated delegated child DNS zone limits the automation identity to the preview namespace. Child-zone creation, one parent NS delegation and identity/RBAC setup require a separately named approval. Keep DNS registration outside the project-only resource token. Qualify the scoped identity before claiming unattended operation; the first trial must not silently create identities or broaden permissions.

DNS reconciliation refuses an existing record with a different target, records exact created resource identities and values, and preserves claims during pause/resume. A terminal event first prevents further creation and stops billed compute, independently of DNS cleanup success. Cleanup removes only owned routing and DCV records that still match their receipts, accounts for their TTL/cache lifetime, and then releases the Northflank grouping. Retain the receipt after any partial failure for expiry recovery. Add conflict, interrupted creation and terminal recovery cases to the existing lifecycle tests. Do not delete a parent zone, release a still-routable domain claim, or overwrite another operator's DNS edit.

Azure creates record sets with `If-None-Match: *`, writes environment/receipt ownership metadata, and deletes with the saved `If-Match` ETag after checking current ownership. Preserve every Northflank domain claim independently of native compute expiry until DNS withdrawal and cache checks succeed. An existing parent wildcard must stay claimed while its CNAME exists, including when a removed environment falls back to that wildcard. Read the exact record set from Northflank; any extra verification record or changed target requires an updated activation input. Validate collision-free environment identities before DNS creation. Use the same DNS adapter for the operator trial and later identity-based authentication.

Flat `environment-app` names fit one Northflank wildcard grouping, but the current authentication code derives a shared cookie parent by removing the first hostname label. That would mix preview cookie scopes without an application authentication change. Do not make that change merely to avoid DNS automation. A second preview must prove distinct cookies, DB credentials and workflow routing. Provider-generated domains do not automatically satisfy cross-app cookie isolation.

This establishes configured cookie scopes for trusted synthetic previews. Browser cookie ancestry still permits an application to set cookies on a broader parent. Public forks remain unprivileged; this trial does not qualify hostile preview code isolation. Backend participant/assessment cookie paths also consume `COOKIE_DOMAIN`, so bind and verify it per environment alongside `NEXTAUTH_URL`.

Published local seed credentials require an approved ingress allowlist on every public app/API domain, including provider-generated domains, before seeded login. Keep databases, Redis, Hatchet, LiteLLM and MCP tooling private except the exact browser-facing OIDC/mail-review endpoints that need approved access. Use internal origins for server-to-server traffic where supported. Test both allowed and denied access.

Audit all five Next.js apps (Auth, Chat, Control, Manage and PWA) before building. A values-free key audit found unbound public keys in every Dockerfile; the staging inventory normally swaps environment files, which the preview must not reuse. Classify every consumed build/runtime key as an explicit preview binding or a reviewed harmless default; disabling telemetry is an explicit preview choice. Reject selected builds with unresolved production-origin fallbacks.

Use one preview-only build-config input and a conditional `.env.production.local` overlay for missing bindings, via a small shared build helper if required. Existing declared Docker arguments receive their explicit preview values. Do not add unconditional empty `ENV` assignments: Next.js gives `process.env` precedence over environment files. When no preview input is supplied, the helper does not write an overlay or alter legacy variables. Test synthetic legacy/preview/empty-input cases and configuration cache fingerprints, then verify staging/production configuration resolution remains equivalent. Record required changes across all five Dockerfiles; do not claim runtime injection rewrites browser bundles.

Use Infisical through the restricted host operator for approved development-only upstream values. Provider-generated database credentials stay in scoped Northflank secret groups. The user supplies profile/key names, not credential values. The automatic provisioner also needs a Northflank API token scoped to the new trial project through that approved injection path; a signed-in browser alone is not authenticated API access. Qualify the minimum scope before cloud writes. No production connection or secret is part of the trial. Route mail to SMTP capture; use synthetic user/content fixtures. External AI and storage calls need the named development boundary and bounded usage.

## Cost and finite trial batch

The previous core-only cost is superseded. Illustrative small-resource compute, derived from published monthly plan amounts for 720 active hours:

| Selection | Hypothetical compute/month | Interpretation |
| --- | ---: | --- |
| Manage or PWA | $54.90 | Three apps plus shared base |
| Chat | $66.90 | Chat/PWA/Auth/API plus shared base |
| Chat with AI/MCP | $81.60 | Adds LiteLLM and synthetic MCP |
| Live quiz | $76.50 | Includes response ingestion and both workers |
| Full registered stack | $124.80 | Earlier core plus Chat, LTI, OLAT, LiteLLM, MCP, OIDC and SMTP capture |

These are arithmetic floors, not eligible-plan quotes or measured sizes. The full example is 16 deployment services plus four addons, totaling 4.9 vCPU and 11 GiB under the illustrative allocations; analytics/bootstrap/migration run as jobs. Real MCP services, extra assessment deployment variants, addon minimums and larger runtime allocations can increase cost. Retained disks, builds, network traffic and approved model calls are separate.

Use the agreed 48-hour maximum lifetime in a new `klicker-previews` project, with at most one full and one selective environment, two application revisions and at most 42 image-build attempts including recovery. The selected `v3-ai` tree contains all 16 inventory targets; exclude the duplicate assessment deployment and conservatively allow two tooling builds, for 17 full builds. The second Chat environment needs three additional origin-specific frontend builds; its backend, migration and tooling images are reused only with matching fingerprints. Two worst-case revisions therefore imply `2 × (17 + 3) = 40` builds, leaving two recovery attempts within 42. Sharing one fixture/tooling image may reduce this count; it never enlarges admission. A graph that cannot satisfy the bound stops before admission. Docs/Office receipts reuse existing CI or container checks and are outside these Northflank image builds; any incremental billed validation is included in the total quote.

The user selected `v3-ai` as the first deployed candidate. Record its immutable revision before each run; controller source remains the reviewed task branch targeting `v3`. Read availability from the selected candidate tree and qualify its profile/runtime differences before deployment.

Recommend Zurich if it offers the required plans; otherwise use an approved European region. Accepted total ceiling: $50, with no more than $2 for synthetic AI included. Reserve at least $10 for tax and uncertainty; quoted resource/AI commitments must fit the remaining $40. Before creation, quote actual selected allocations and enforceable build/lifetime bounds. Start the fixed deadline with the first billed trial resource or build; a later environment or update receives only the remaining time. An illustrative upper allocation is 8 vCPU/20 GiB aggregate for full and 4 vCPU/12 GiB for Chat; 48 active hours of both is approximately $22.40 compute. A 4-vCPU/16-GiB build plan at $0.20/hour and 42 attempts of at most 30 minutes is $4.20. These controls must be supported and set before treating the arithmetic as a bound; network/storage/AI admission and cleanup failure still need accounting.

Billing alerts are notifications. They are not a hard cap. Do not retry uncertain paid operations until provider state and usage are reconciled. If the selected shape or enforceable limits do not fit the approved ceiling, pause only the dependent branch and return the concrete revised quote.

### Finite execution sequence

1. Prepare source/native manifests, validate the profile planner and fixtures, run relevant existing checks, and publish an ordinary task branch/draft PR when the implementation package is reviewable.
2. In the named new project and approved region, qualify database permissions and Hatchet credentials, then provision only synthetic trial dependencies, private credentials and approved app origins. On a fixture-generation incompatibility or failed migration, quarantine and recreate only the named synthetic trial environment within the original shared budget/deadline; never reset a retained external database or retry an uncertain paid operation blindly.
3. Run full functional qualification, one source update, full-to-selective reconciliation and a second Chat preview. Exercise synthetic AI within its separate sublimit and record exact missing external-integration evidence.
4. Drain, pause/resume and reconcile resource/billing states. On success or the deadline, delete only the newly created synthetic trial environments/resources and verify cleanup. Retain the source package and sanitized evidence.

The total ceiling/lifetime are accepted. Named DNS/access/credential bindings are approved privately with the corrected namespace; first candidate is `v3-ai`. Operator profile configuration or permission expansion is separately governed by its exact-name approval rule. The sequence may continue through independent preparation while those activation inputs remain pending. No merge, release, production/staging mutation, real-user notification, global tool reconfiguration or unrelated cloud resource change is included. No custom wake gateway is included; request-triggered wake remains a separate capability decision.

## Implementation package and verification

Prospective files, created only during approved implementation:

- `util/northflank-preview-plan.mjs` and `util/northflank-preview-plan.test.mjs`: values-free selection/validation using the existing inventory, profile helper and pinned CLI.
- `deploy/northflank/runtime-contract.yml` and `deploy/northflank/klicker-preview.json`: native resource bindings and conditional deployment graph.
- `deploy/northflank/Dockerfile.bootstrap` and `deploy/northflank/Dockerfile.fixtures`: separate existing seed and synthetic MCP harness runtimes, reusable by complete input fingerprint. Their dependency/privilege needs differ; keep the two simple images unless a measured common runtime justifies consolidation.
- `.github/workflows/northflank-previews.yml`, `util/northflank-preview-lifecycle.mjs` and `util/northflank-preview-lifecycle.test.mjs`: thin, serialized GitHub event/lifecycle adapter around native APIs. Keep provider inputs independent of GitHub so a named GitLab adopter can use the same planner; do not add an unused second-forge framework.
- `util/preview-build-env.mjs` and `util/preview-build-env.test.mjs`, with required narrow edits in the five frontend Dockerfiles: conditional preview bindings and legacy configuration equivalence.
- Conditional `packages/prisma/scripts/northflankBootstrap.ts` and `packages/prisma/test/northflankBootstrap.test.ts` only if the selected addon shape needs it; affected frontend Dockerfile/config bindings only where verified necessary.

Do not add application fixture controllers or replace the CI test selector. Extend `docs/ci-and-deployment.md` and the relevant skill only after the delivery contract is adopted; update this plan/research with trial results. No plan-only PR.

### Delegation map and sequence

Each slice has one implementation owner. Main retains source/authority choices, credential handling, cloud effects and final acceptance. No peer task is proposed.

| Slice | Owner / route | Dependency and acceptance |
| --- | --- | --- |
| Profile planner and native definition | `executor` for settled planner/contract files; main integrates | Approved controller/source boundary; selection tests and native schema checks pass without starting a runtime |
| Full environment | main; critical-path coupling and secrets/external effects | Approved finite batch, actual resource quote, database/engine authority and analytics command gate; every required full acceptance receipt below |
| Selective lifecycle adapter | `executor` for lifecycle code/workflow/tests; main owns live operations | Settled profile output and native APIs; event/race/budget tests pass, then excluded services observed inactive and fixtures preserved on updates |
| Integration and cleanup | main; cross-system proof/external effects | Previous slices pass; cross-preview isolation, idle pause/resume, exact usage and complete authorized teardown |

Delegate the planner and lifecycle adapter sequentially because the latter consumes the former's contract. Native resource topology and credential decisions remain with main until settled. Commit coherent verified source slices, use the configured simplifier/risk review and integrated final review, and publish the reviewable draft package within the approved source-delivery scope.

### Test portfolio

| Independent risk | Obligation / primary seam | Existing protection and distinct failure |
| --- | --- | --- |
| Wrong profile or build set | Add `util/northflank-preview-plan.test.mjs`; structured planner output | Existing inventory/profile helpers protect their own logic; new adapter must cover Chat/Manage/Prisma/root/unknown/docs, unions, renames, fixture/config input changes, the 36+6 build bound and controller/candidate drift without duplicating membership lists |
| Stale events, contraction or cleanup races | Add `util/northflank-preview-lifecycle.test.mjs`; fake native API/CI event harness | No existing Northflank adapter; cover duplicates, obsolete head, close/update race, terminal reopen, cross-environment build allowance, partial creation and pause/removal recovery |
| Managed-addon bootstrap privileges | Conditional add `packages/prisma/test/northflankBootstrap.test.ts`; disposable DB seam | Existing `packages/prisma/test/disposableDatabase.test.ts` and `disposable-prisma.test.ts` remain authoritative; exercise denied authority and wrong target if a new adapter is actually needed |
| Preview frontend origins versus legacy builds | Add `util/preview-build-env.test.mjs`; synthetic environment resolution/build-input seam | Existing image args omit keys; prevent production-origin fallback, blank legacy origins and a cache hit from another preview configuration |
| Existing app behaviours on hosted origins | None new initially; reuse named browser suites and native platform receipts | `playwright/tests/A-login.spec.ts`, `O1-live-quiz-core.spec.ts`, `O2-live-quiz-collaboration.spec.ts`, `Y-chat.spec.ts` and `Z-credential-verification.spec.ts`; local/source success does not protect hosted TLS, cookies, worker routing or assessment state |
| Extra capability and artifact qualification | None new by default; bounded job/build/integration receipts below | Existing OLAT API and Office tests protect their own contracts; boot/health checks alone cannot qualify OIDC, mail, LTI or analytics |

Planner/lifecycle focused check: `node --test util/northflank-preview-plan.test.mjs util/northflank-preview-lifecycle.test.mjs util/preview-build-env.test.mjs`. Run package-native bootstrap tests inside the exact disposable build/test environment only if that adapter exists. Validate native JSON against the provider schema, then render each profile to a values-free resource inventory. Container-dependent builds/tests run in the provisioned container or native build jobs; host Playwright uses `pnpm playwright:host -- <named-specs>` with the approved hosted origins and synthetic fixture database. Do not run destructive local test wrappers against a retained hosted database.

### Required full acceptance receipts

| Surface | Required trial evidence | Explicit qualification boundary |
| --- | --- | --- |
| Core apps, subscriptions and Hatchet | Delegated login; synthetic live quiz response processed once; worker result and subscription received; both worker processes identified | Health/ready and API acknowledgement alone do not pass |
| Chat, AI and MCP | Synthetic streamed turn through selected model route; existing local MCP harness invoked; answer/tool/source survive reload | Fixture MCP qualifies the harness integration only; real MCP applications/ingestion require their own available source and endpoints |
| Identity, mail and LMS adapters | Mock OIDC login with hosted callback; captured SMTP flow; synthetic authenticated/denied OLAT contracts using `apps/olat-api/test/index.test.ts` as contract evidence; LTI discovery/JWKS plus a controlled synthetic launch/session flow | Real SWITCH/OLAT launch and external course content remain separate integration proofs; a missing required synthetic flow blocks full acceptance |
| Analytics | Review `uv run --no-sync python src/main.py` as the initial one-shot command before provisioning; prove its datasource points only to the owned synthetic database, image/client generation succeeds and the job exits successfully | Current entrypoint only connects/reads a user; no claim of advanced analytics or production-data qualification. Do not run the environment-specific initialization scripts |
| Docs, Office and assessment | `pnpm --filter @klicker-uzh/docs build:docs`; `pnpm --filter @klicker-uzh/office-addin build` and its existing test suite; assessment credential/report flow through `Z-credential-verification.spec.ts` with synthetic data | Office host integration and separate production assessment deployment partition remain unqualified; artifact checks do not imply those passes |

Automated tests protect selection and lifecycle invariants, not prose or fixture contents. Reuse existing login, live-quiz, Chat and LMS tests where suitable; add only adapter/guard/reconciliation tests for new consequential failure modes. Browser verification covers cross-origin auth, HTTPS/cookies, WebSockets, Chat streaming/tool persistence and subset navigation. Platform inventory checks prove that excluded services are not active; a green health endpoint alone does not.

Acceptance is distinct from server readiness. Report each external boundary separately. The package remains incomplete if a required relevant capability is blocked, even when the base stack is healthy.

## Progress

Source mapping and a source-only profile/inventory dry run are complete. Canonical Chat/Manage/PWA/live-quiz worker membership was observed; no application runtime started. A temporary pinned CLI 0.5.1 on Node 24.21.0 now also resolves six selections successfully, matching the source probe; the global installation remains unchanged. This proves the profile-resolution seam, not the unimplemented Northflank adapter.

The earlier core-only planner/Opus reviews remain historical evidence for unchanged database, ingress, credential and lifecycle findings. They do not approve this expanded profile/full-stack scope. Current status: expanded plan APPROVED by the same Astra planner in focused Round 2 after the requested Opus discussion. Accepted corrections include immutable controller provenance, terminal event handling, fixture/config drift, safe frontend bindings, fingerprinted image reuse, complete acceptance receipts and corrected service/build counts. Adviser approval grants no human authority. The user has since accepted the finite budget/lifetime and asked for binding proposals; those are saved privately and now approved with the corrected namespace. Execution is active. Account-specific pay-as-you-go verification is kept privately.


### Binding proposal follow-up

Budget and lifetime are no longer open questions. The approved DNS/cookie namespace, current-viewer-only ingress policy and exact read-only operator profile are recorded in ignored `project/_local/northflank-trial-bindings.md`. Credential access uses the approved restricted operator profile. Live ownership and execution evidence remain private; this public plan contains no account configuration or secret values.

User approved the named bindings with their DNS correction. Fast-forwarded to current `origin/v3` (`dbe911583c33c7d0ca096da1ef977e9d4da0ceb3`) before implementation; incoming review-workflow/docs changes do not alter the qualified profile/runtime source.

The user selected the v3-ai candidate and clarified admission: named branch environments use an explicit allowlist; PR previews require an opt-in label or manual request. Do not deploy all PRs or all branches sharing a prefix. URL identity uses the named branch or PR number; exact private origins remain in ignored binding notes. The candidate has real MCP application sources and profile differences, requiring actual qualification and a recomputed resource/build quote within the existing cap.
