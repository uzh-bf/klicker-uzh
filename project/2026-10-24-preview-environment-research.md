# Full-stack development and preview environments

Research captured 2026-10-24; pilot evidence updated 2026-10-25. Status: restricted synthetic pilot deployed; automatic preview adoption remains incomplete.
Repository baseline: `origin/v3`, `6dad21cc7a6da46eb4931b1195e99f9c9d0d2216`.
Related proposal: [Northflank development environment](2026-10-24-northflank-dev-environment-plan.md).

## Goal and current constraints

Enable isolated branch and integration-PR/MR environments without first merging unrelated features into the shared staging branch. The user wants automatic provisioning, updates, shutdown, recovery and cleanup; predictable costs; retained review identity; and reuse for public and private projects on GitHub and GitLab.

The preferred operational experience is managed/serverless. Actual billing for an idle full stack matters more than the serverless label. Distinguish creation/deletion, scheduled pause/resume, inactivity-based suspension, and request-triggered wake: these are separate capabilities.

Keep account identifiers, billing/account details, screenshots of authenticated pages, tokens and private repository information outside tracked documents. Store values-free account findings under ignored `project/_local/`.

## Verified Klicker source findings

- The Compose devcontainer includes PostgreSQL, three Redis services, Hatchet Lite, and an app container running multiple web applications, the response API and two Hatchet workers. MailHog, mock OIDC and LiteLLM provide optional capabilities.
- Hatchet uses a separate database on the same development PostgreSQL server. Its engine and worker processes are part of observable application behaviour.
- Backend GraphQL subscriptions require WebSockets. Authentication spans several related application origins, with cookie-domain, CORS, redirect and callback configuration.
- `.devcontainer/post-create.sh` unconditionally resets/pushes the application schema and seeds synthetic data. A retained hosted environment needs separate initialization, migration and resume semantics.
- `.devcontainer/post-start.sh` requires the process helper injected by host-side `devrouter ensure`. It selects localhost or workspace-local origins. A hosted devcontainer is therefore not a drop-in public preview.
- The existing Helm chart defines workers and application deployments, with external PostgreSQL, Redis and Hatchet connection configuration. It does not already provision all dependency servers.
- Shared staging follows a selected source branch. Preview environments should have their own revision identity and delivery path; live environment configuration remains in private notes.

Source references at the frozen baseline:

- [Compose](https://github.com/uzh-bf/klicker-uzh/blob/6dad21cc7a6da46eb4931b1195e99f9c9d0d2216/.devcontainer/docker-compose.yml)
- [Bootstrap](https://github.com/uzh-bf/klicker-uzh/blob/6dad21cc7a6da46eb4931b1195e99f9c9d0d2216/.devcontainer/post-create.sh)
- [Startup](https://github.com/uzh-bf/klicker-uzh/blob/6dad21cc7a6da46eb4931b1195e99f9c9d0d2216/.devcontainer/post-start.sh)
- [Helm chart](https://github.com/uzh-bf/klicker-uzh/tree/6dad21cc7a6da46eb4931b1195e99f9c9d0d2216/deploy/charts/klicker-uzh-v3)

## Candidate assessment

| Candidate | Useful capabilities | Limits and unresolved questions | Disposition |
| --- | --- | --- | --- |
| Northflank managed cloud | Full-stack preview blueprints, services, jobs, managed database addons, volumes, GitHub/GitLab and self-hosted VCS | Hosted whole-environment automatic sleep/wake is unproven. Documented scheduled active hours apply to BYOC. Per-service stateful costs remain. | First managed candidate to investigate. |
| Existing AKS and ArgoCD | Existing application chart and deployment tooling; ApplicationSet PR generators for GitHub and GitLab, private/self-hosted endpoints and label filters | Needs dependency provisioning, image delivery, resource/isolation policy, suspend/resume and retained-data policy. Cluster capacity/tenancy has not been inspected. | Potentially lowest incremental operating cost. |
| Coolify on shared compute | Git-backed Compose previews, per-service preview domains, GitHub/GitLab integrations and close/merge cleanup | Operator owns servers, capacity and updates. Whole-stack idle suspension and wake are not verified. Stopping containers does not reduce a fixed host bill. | Budget option for a broad Compose-based portfolio. |
| Codespaces | Devcontainer-based developer workspace, forwarded ports and inactivity timeout | Developer session and sharing semantics, GitHub-centric provisioning, hostname/cookie integration, and retained-preview lifecycle need adaptation | Optional developer editor/workspace, not the default shared preview platform. |
| Coder | Devcontainers, Terraform-defined infrastructure and workspace scheduling | Another control plane to operate; ordinary direct app URL access does not count as workspace activity in the documented scheduler | Consider only if remote developer workspaces are also a goal. |
| DevPod with VM per environment | Reuse devcontainer shape and broad cloud/provider support | Private/public preview access, forge reconciliation and HTTP wake still need orchestration; cloud stop/deallocation semantics differ | Keep behind simpler existing controllers and managed platforms. |
| Daytona sandboxes | Docker-in-Docker Compose, persistent filesystem, automatic lifecycle, configurable preview proxy and WebSockets | Requires forge lifecycle/routing integration. Docs conflict about preview traffic resetting inactivity. Database/job recovery and retained storage require proof | Investigate only if devcontainer fidelity is decisive. |
| Render | Blueprint-created full-stack previews, updates and close/merge cleanup; GitHub/GitLab sources | Pro plan or above; each deployed service/datastore is billed. Automatic deletion is not whole-stack idle sleep | Managed alternative if Northflank fails a key acceptance check. |
| Railway | Per-project environments, GitHub PR previews and service sleeping | Long-lived DB connections, internal traffic and queue polling prevent sleep; GitLab lifecycle parity not established | Less convincing for this stack's idle-cost goal. |
| Fly Machines / Sprites | API-driven compute, machine stop/start and durable storage options | Multi-service orchestration, routing and dependency lifecycles still need proof; pricing pages differ in some resource rates | General compute primitives, not a selected preview controller. |
| Azure Container Apps | Request/event-driven container scaling with zero minimum replicas | Non-ingress workers need a custom scale rule or a warm replica. Hatchet work does not automatically supply such a trigger. Stateful dependencies and preview lifecycle remain | An application hosting option with more integration work. |
| Per-environment traditional VMs | Full stack, isolated machine and persistent disk are straightforward | Repeats OS/service overhead and adds lifecycle operations; not all clouds stop billing on power-off | Avoid building a custom VM control plane initially. |

Coolify's latest release was independently read through the GitHub API as `v4.5.0`, published 2026-10-23. Its GitLab App docs require at least v4.3.0. Recheck versions before implementation.

## Prices observed in the first research pass

Prices are USD unless stated otherwise, exclude taxes and may change. These are billing examples, not measured Klicker capacity or performance comparisons.

| Resource example | Active hourly compute | 40 active hours | 720 active hours | Additional costs |
| --- | --- | --- | --- | --- |
| Codespaces, 4 cores | $0.36 | $14.40 | $259.20 | Storage $0.07/GB-month; prebuild costs can apply |
| Codespaces, 8 cores | $0.72 | $28.80 | $518.40 | Same storage/prebuild qualification |
| Northflank, nf-compute-400, 4 vCPU / 8 GB | approximately $0.1333 | approximately $5.33 | approximately $96 | Separately sized dependencies, storage, builds and traffic |
| Daytona, 4 vCPU / 8 GiB | $0.3312 | $13.25 | $238.46 | Reserved disk and snapshot/storage rules |

- Northflank lists CPU at $0.01667/vCPU-hour and memory at $0.00833/GB-hour. The final current pricing-page check lists persistent disk at $0.11657/GiB-month, replacing the $0.15/GB-month observed earlier. Actual resource plans, minimum sizes and addon billing determine the stack total.
- Coolify self-hosted software is free. Its managed control plane starts at $5/month for two connected servers; application compute is supplied separately.
- Hetzner explicitly bills a cloud server while it exists, even powered off. Snapshot/delete/recreate has different cost and recovery implications.
- Daytona's billing docs distinguish stopped/paused (disk billed), archived container sandboxes (no sandbox resource billing), and deleted (separate snapshots can remain billed).
- Account-specific eligibility and observations are kept in ignored local notes. The public tier facts and later inspection limitations are recorded below.

## Adviser conclusions and disposition

### Astra

Initial advice favoured a per-environment VM with Compose to preserve full-stack behaviour. A second focused round incorporated Claude's challenge and verified platform features. Astra revised its recommendation: evaluate Northflank for managed operation, reuse ArgoCD if cluster ownership/capacity is suitable, and use Coolify as the budget Compose option. It warned that none of the evidence yet establishes automatic lifecycle, no server management, low idle cost and retained review identity together.

Accepted: distinguish compute lifetime, data lifetime and URL identity; measure actual costs and recovery; avoid inventing a generic controller when an existing platform already owns the lifecycle.

### Claude

The first discussion used the configured Claude Fable advisor, not Opus. Claude favoured namespace-per-preview through existing AKS/Helm/ArgoCD to avoid a second deployment path. It proposed automatic PR/MR discovery and emphasized multi-origin authentication, browser-reachable mock OIDC and trusted-branch admission.

Accepted: reuse deployment primitives and qualify request generators for both forges. Qualifications: current chart lacks dependency servers; idle pods are not free infrastructure; namespace isolation alone does not establish a suitable boundary for untrusted code; chart lifecycle must preserve existing ArgoCD PreSync migration conventions rather than mixing Helm hook semantics. The user has now separately requested an Opus discussion of the Northflank proposal.

## Proposed reusable environment contract

Use platform-native lifecycle mechanisms and a repository-owned application definition. Share policy and CI conventions across forges without first building a universal environment API.

- Identity binds forge, repository, PR/MR or branch and the exact desired revision. Updates are serialized; duplicate events reconcile safely.
- Each environment has stable application origins, an isolated PostgreSQL database boundary, isolated Redis state and Hatchet work routing. The simplest first trial gives the environment its own complete dependency stack.
- Creation initializes synthetic fixtures once; updates migrate; resume preserves state. Any deliberate reset is explicit and environment-scoped.
- Suspension has observable completion and a readiness-gated resume. It stops workers and background work deliberately; retention does not imply schedules continue while paused.
- Cleanup distinguishes temporary compute from durable data. Expiry, close/merge, branch deletion and reopening follow a declared policy.
- Trusted branches may provision automatically. Public fork code receives no privileged repository, cluster or external-provider credentials.
- Costs include builds, active application/dependency compute, retained storage, egress, gateway/control plane and maintenance. Cap concurrent active environments.

## Required proof before adopting a platform

1. Deploy the minimum complete Klicker stack and exercise delegated login, cross-app cookies, WebSockets and one Hatchet response job.
2. Bind it to one exact revision; update it and show synthetic state survives.
3. Suspend the complete stack, identify which costs stop, resume through its supported entry point, and rerun the behavioural check.
4. Demonstrate private GitHub and GitLab lifecycle using the same environment contract. Network reachability is a prerequisite for private/self-hosted VCS.
5. Prove close/expiry cleanup and retained-data policy, and report actual resource usage with all dependency costs.

The bounded pilot has since proved shared wildcard HTTPS, synthetic cross-preview participant sessions, a persisted Chat/MCP turn, Hatchet response processing, SMTP capture, OLAT authentication, assessment report verification, source update without reseeding, profile contraction and compute pause/resume. Analytics needed a 4 GiB one-shot job. These findings support continuing the managed-platform evaluation, while the [execution plan](2026-10-24-northflank-dev-environment-plan.md#pilot-qualification-checkpoint) records the unqualified integrations and automation gaps. The current source workflow plans only; no automatic PR deployment or request-triggered wake is established.

The initial research pass was read-only. Subsequent approved pilot setup and its current qualification state are recorded in the execution plan.

## Public sources

Northflank:
- [Preview blueprints](https://northflank.com/docs/v1/application/release/manage-preview-blueprints)
- [Blueprint setup and active hours](https://northflank.com/docs/v1/application/release/set-up-preview-blueprints)
- [Git integrations](https://northflank.com/docs/v1/application/collaborate/manage-git-integrations)
- [Compute plans](https://northflank.com/docs/v1/application/billing/resource-plans-and-quotas)
- [Pricing](https://northflank.com/pricing)

Other platforms:
- [ArgoCD PR generators](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-Pull-Request/)
- [Coolify Compose](https://coolify.io/docs/applications/builds/docker-compose), [previews](https://coolify.io/docs/applications/deployments/preview-deployments), [GitLab](https://coolify.io/docs/applications/sources/gitlab), [pricing](https://coolify.io/pricing)
- [Codespaces billing](https://docs.github.com/en/billing/concepts/product-billing/github-codespaces), [timeout](https://docs.github.com/en/codespaces/setting-your-user-preferences/setting-your-timeout-period-for-github-codespaces), [port forwarding](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace)
- [Coder devcontainers](https://coder.com/docs/user-guides/devcontainers), [scheduling](https://coder.com/docs/user-guides/workspace-scheduling)
- [DevPod provider lifecycle](https://devpod.sh/docs/developing-providers/agent)
- [Daytona Compose](https://www.daytona.io/docs/snapshots/), [persistence](https://www.daytona.io/docs/en/persistence/), [billing](https://www.daytona.io/docs/billing), [pricing](https://www.daytona.io/pricing), [preview proxy](https://www.daytona.io/docs/en/custom-preview-proxy/)
- [Render previews](https://render.com/docs/preview-environments), [Git providers](https://render.com/docs/git-provider)
- [Railway serverless](https://docs.railway.com/deployments/serverless)
- [Fly resource pricing](https://fly.io/docs/about/pricing/), [pricing page](https://fly.io/pricing/)
- [Azure Container Apps scaling](https://learn.microsoft.com/azure/container-apps/scale-app)
- [Hetzner billing](https://docs.hetzner.com/cloud/billing/faq/)

## Northflank follow-up findings

The initial research above was saved before authenticated inspection. The follow-up used the signed-in UI read-only, current public documentation, Context7 and the public plan catalog. Account identifiers and account-specific details are kept in ignored local notes.

### Free and paid boundaries

- The public Developer Sandbox allowance is two services, two jobs and one addon, with restricted resource plans. Jobs do not replace continuously running Hatchet workers. A complete native Klicker core exceeds this allowance.
- Pay-as-you-go has no stated monthly base or per-seat charge; compute, retained storage, builds and traffic are separately billed. Free platform access is not unlimited free preview cloning.
- Published sources conflict about free signup: the current pricing page says no card is needed, while the billing guide still requires a payment method before creating resources. Neither source establishes account-specific free eligibility; no free resource was submitted. The current pricing page also advertises up to $20/month of Sandbox resources.
- Exact free CPU/RAM, addon minimums and free build allowance remain unverified. General account quotas and the public plan catalog do not establish free eligibility.
- BYOC includes underlying cloud charges, and public billing documentation describes additional platform metering. It is not a free alternative to the managed-cloud bill.

Sources: [billing and free allowance](https://northflank.com/docs/v1/application/billing/pricing-on-northflank), [prices](https://northflank.com/pricing), [plan catalog and quota scope](https://northflank.com/docs/v1/application/billing/resource-plans-and-quotas).

### Capabilities that fit Klicker

Native build/deploy services, one-time jobs, PostgreSQL/Redis addons, private networking, WebSockets/gRPC, custom domains and environment-scoped secret groups match the existing topology. The earlier core-only proposal used nine deployment services and four addons. The expanded full-profile trial below supersedes that scope. Ordinary PostgreSQL/Redis containers are a smaller alternative to evaluate before adding provider-specific bootstrap code; they retain platform-managed compute while shifting database patching and recovery responsibility to us.

The strongest first dependency test is managed PostgreSQL role/database authority and the existing disposable marker, rather than a generic HTTP smoke test. Free eligibility must be confirmed; upgrading does not establish a retained free allowance. The next integration proof is Hatchet's persisted configuration and client-token delivery across separate hosted services.

Frontend origins must be allocated before building the existing Dockerfiles. A fixed pilot can reserve one exclusive hostname family with one suitable wildcard certificate; multi-preview cookie isolation still needs per-environment domain/certificate qualification.

Local fixture passwords are public, so hosted preview ingress must be restricted before seeded login is enabled. Port IP policies are documented; Basic Auth across origins and WebSockets is not assumed compatible.

Sources: [PostgreSQL administration](https://northflank.com/docs/v1/application/databases-and-persistence/deploy-databases-on-northflank/deploy-postgresql-on-northflank), [private/public protocols](https://northflank.com/docs/v1/application/network/networking-on-northflank), [wildcard domains](https://northflank.com/docs/v1/application/domains/wildcard-domains-and-certificates), [port security policies](https://northflank.com/docs/v1/application/network/add-security-policies-for-ports).

### Lifecycle and cost qualifications

The current API explicitly exposes preview pause and resume. API acknowledgement alone does not prove every worker/addon is stopped or its compute billing has ceased. Scheduled active hours are documented for BYOC; hosted automatic idle/wake remains unproven. Expiry deletes resources and data, whereas pause is meant to retain the configured state.

Suspend only once live quizzes/assessments and in-flight work are idle. PostgreSQL and Hatchet are durable; Redis can be ephemeral for that contract. Coordinate all lifecycle actions before introducing automatic schedules or cleanup. Retain owned-resource identities when partial operations fail.

Historical core-only arithmetic was $81.90 per 720 active hours, including $20.10 of unverified addon-plan assumptions. The expanded full-profile trial below supersedes its scope and build-count proposal. Per-image build latency, memory, pause behaviour and actual usage remain unmeasured.

Sources: [pause API](https://northflank.com/docs/v1/api/project/preview-blueprints/pause-preview-environment), [resume API](https://northflank.com/docs/v1/api/project/preview-blueprints/resume-preview-environment), [expiry and BYOC active hours](https://northflank.com/docs/v1/application/release/set-up-preview-blueprints).

### Requested Opus discussion

The Opus consultation returned REVISE on the earlier draft while endorsing a bounded managed-cloud experiment. Accepted changes: use the free database-authority proof; evaluate ordinary dependency containers before a custom adapter; restrict preview ingress; expose uncertain rates as a floor; bound commits and image-build attempts; allow empty Redis after an idle pause; simplify the fixed pilot's certificate setup; and describe Hatchet as dev-grade.

Qualified advice: a flat shared cookie parent is safe only in an exclusively reserved pilot namespace, not as the multi-preview design. DNS authority is still needed. Coolify may have better shared-host economics, but a specific concurrency threshold was not established. No exclusive model provenance is claimed: the CLI reported Opus 5.5 and auxiliary Fable 5.1 usage.

## Progress

Research was persisted first; authenticated inspection and the original Opus discussion are complete. The full-profile proposal below supersedes the earlier core-only pilot. This is the historical research checkpoint. The approved pilot has since created isolated trial resources and qualified shared wildcard TLS, hosted application paths and manual pause/resume. See the execution plan for current evidence and unresolved automatic lifecycle adoption.

## Expanded full-profile trial

The current goal is full relevant application qualification followed by selective previews. Reuse `.devrouter.yml` as the single profile authority and `util/profile-resolver.sh` for its worker/process semantics. A source-only probe confirmed that Chat includes PWA, API and Auth, three Redis roles, PostgreSQL and Hatchet, but no quiz workers. The ordinary Chat selection should add `ai,mcp` for real synthetic model/tool behaviour. `full` adds all registered apps, workers and optional capabilities; analytics is a job and docs/Office are artifact checks. Source absent on a selected branch cannot be counted as tested.

The existing staging image inventory provides application build-input matching. A Chat path selected only the Chat image; a Prisma schema path selected all fourteen available targets. The Playwright test selector is unsuitable as a runtime startup selector because its selection policy intentionally widens app PRs and tests. Reuse inventory metadata, never its staging environment preparation commands. Separate a trusted controller revision from candidate application source.

The global host Devrouter is older than this checkout's configuration. A temporary isolated CLI 0.5.1 running with installed Node 24.21.0 now successfully resolves six selections; all app/service sets match the source-only probe. No global installation or application runtime changed. This qualifies native profile resolution while the Northflank adapter remains prospective.

Northflank's argument-driven conditional nodes can omit unwanted builds/resources. Skipping a node or removing it from a later template does not stop an existing service. Profile contraction needs explicit drain/pause and a retained resource inventory. One admission queue must coordinate updates with close/merge/expiry; terminal events and obsolete revisions cannot recreate a deleted preview. Keep the fixed trial deadline even on updates.

Hypothetical compute floors per 720 active hours: Manage/PWA $54.90; Chat $66.90; Chat plus AI/MCP $81.60; live quiz $76.50; full $124.80. Actual eligible addon plans, runtime allocations, storage, builds and AI must be measured. Proposed finite batch: $50 excluding tax, 48 hours, two environments maximum, two source revisions and at most 42 total build attempts. These are proposed limits, not a provider-enforced spending cap.

Start with a full environment, then test full-to-Chat-to-full reconciliation and a second isolated Chat preview. Validate every selected capability, absent processes, state retention, idle pause/resume, usage and cleanup. Keep production data and live staging resources outside the trial. Automatic activation in a default-branch workflow and private GitHub/GitLab qualification are adoption steps requiring their own actual evidence.

Sources: [conditional nodes](https://northflank.com/docs/v1/application/infrastructure-as-code/make-a-template-dynamic), [template update/removal behaviour](https://northflank.com/docs/v1/application/infrastructure-as-code/run-a-template), [preview settings and expiry](https://northflank.com/docs/v1/application/release/set-up-preview-blueprints), [CI preview arguments](https://northflank.com/docs/v1/api/project/preview-blueprints/run-preview-blueprint), [current pricing](https://northflank.com/pricing).



### Expanded Opus discussion and correction

The user-requested expanded consultation completed on the CLI-reported `claude-opus-5-5` route, with `DONE_WITH_CONCERNS`. Verified findings: the full topology is sixteen deployment services plus four addons; omit the duplicate assessment image when that deployment is excluded; source inventory reuse requires complete fingerprints; frontend origins need a five-app binding audit; guarded seed jobs must have no `PG*` environment keys; fixture/bootstrap and LiteLLM config changes need explicit handling. The plan incorporates these corrections.

A key-name-only frontend audit found unbound public environment keys in all five Next.js Dockerfiles. Preview bindings must cover consumed origins and preserve legacy configuration when no preview input exists. Current Next.js documentation confirms process environment precedence and build-time public-variable inlining. GitHub documentation also confirms a new `workflow_dispatch` file must exist on the default branch, so the initial finite test uses the same adapter from a pinned host checkout; unmerged source and event-harness checks do not prove automatic Actions activation.

The build-count derivation is 13 selected full inventory images plus two tooling images and three additional origin-specific Chat frontends per revision. With verified reuse this is 36 builds for two revisions, leaving six retry attempts within the proposed 42. The actual build graph must validate that assumption before paid admission. Docs/Office checks reuse candidate CI/container evidence.

Sources: [Next.js variable loading and inlining](https://nextjs.org/docs/app/guides/environment-variables), [GitHub workflow dispatch requirements](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch).

The expanded proposal passed Astra's focused second planning round after these corrections. Execution remains pending the named finite budget, origins/access and credential inputs; no hosted application test is claimed.


The user accepted the $50/48-hour trial constraints and requested proposed DNS/access/credential bindings. The named proposals are saved in ignored local notes; no credential value was fetched and no account/resource setting changed. Existing development operator authentication and relevant readable-name permission were verified values-free.


## Shared wildcard correction and selected-source qualification

The user requires a generic wildcard setup with no DNS changes per branch, PR/MR or app. This supersedes the earlier per-environment DNS adapter proposal and its adviser reviews. No Azure DNS writes were made for that proposal; the unused adapter prototype is preserved privately.

Northflank supports dynamic preview routes with one shared wildcard-redirect grouping and wildcard certificate. Use flat labels such as `branch-a--chat.preview.example.com` and `pr-123--manage.preview.example.com`; include repository identity when sharing the namespace across projects. One-time shared routing and certificate-validation DNS records replace per-preview records. A live form rejected nested `app.environment` names under wildcard routing, while DNS itself resolved the query. The constraint was native route registration and certificate coverage.

Current Klicker cookies derive the parent domain by removing the first label. Flat names therefore require an explicit preview-only cookie namespace across all readers and writers, plus independent signing secrets. This prevents accidental session collisions between trusted synthetic previews; it does not prevent sibling preview services from receiving parent-domain cookies. The approved application change is implemented locally; hosted activation awaits its focused review and browser verification. Public forks remain unprivileged. The existing parent claim must remain protected during any one-time certificate-mode transition.

A source-only comparison found that one host per environment with path prefixes needs substantially broader NextAuth, Chat, redirect, manifest and service-worker changes. It cannot be qualified by adding Next.js `basePath` alone. Preserve the detailed mapping and adviser responses privately; qualify two concurrent environments in a real browser before adopting either design.

The selected source's profile configuration and pure process helper are qualified by explicit public source digests in the trusted controller contract. Native Devrouter 0.5.1 resolution passes for full, Chat/AI/MCP, combined Chat/Manage and worker-only selections. Full includes the available real MCP application images. Chat omits those applications and quiz workers. Azurite and the synthetic MCP PostgreSQL dependency are selected from canonical profiles. These are source-planning results; full hosted acceptance remains pending.

Sources: [Northflank wildcard routing and certificates](https://northflank.com/docs/v1/application/domains/wildcard-domains-and-certificates), [dynamic template domains](https://northflank.com/docs/v1/application/infrastructure-as-code/make-a-template-dynamic). Account records, identities and live receipts remain in ignored local notes.

A focused Opus 5.5 consultation endorsed flat labels with preview-only cookie names as the smallest design for concurrent trusted previews. Its concerns were shared-cookie exposure to sibling previews, cookie/header buildup, exact callback allowlists, and external OIDC callback registration. Disposition: keep fork previews excluded, use short cookie lifetimes and per-environment secrets, verify exact redirects, and use the approved delegated/synthetic login and mock OIDC paths. Real identity-provider qualification remains explicitly separate. Retain wildcard validation DNS permanently for renewal. The current individual-certificate grouping needs an exact safe transition before activation; the consultation did not qualify deleting and recreating it while DNS still points at an unclaimed provider target.

The automatic Jev citation check was unavailable because the existing `jev-prototype` operator profile is missing. No profile or credential setup was attempted. Main-session inspection and Context7 both confirmed Northflank's official wildcard-routing, dynamic-domain and wildcard-certificate passages.
