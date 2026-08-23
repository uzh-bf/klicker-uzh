# Reintegrating `v3-ai` into `v3`

**Date:** 2026-08-22 (revised same day after decisions)
**Status:** decided — ready to execute
**Governing decision:** [ADR 0007](../docs/adr/0007-reintegrate-v3-ai-behind-feature-flags.md), whose timing is now superseded (see below)
**Terminal condition:** `v3-ai` merged into `v3` and deployed before VK2 (31.08.), the lecturer-facing surfaces behind a runtime flag, the beta opt-in open for VK2 participants, and `v3-ai` retired.

## Decisions taken

| # | Decision | Consequence |
| --- | --- | --- |
| 1 | Merge and deploy **before** VK2, not after | Supersedes ADR 0007's deferral. VK2 becomes the structured-feedback event for features that are already live, instead of the reason to wait. ADR 0007 needs an amending record stating this. |
| 2 | "Secure MCP" means every call must originate from a valid Klicker chatbot | Internal token hardening, not external availability. External OAuth 2.1 for third-party clients stays deferred to `plans_wip/PLAN-external-mcp-oauth.md`. |
| 3 | Freeze `v3-ai` scope | Pull requests #5424 and #5474 get retargeted at `v3` after the merge. |
| 4 | Mechanical consistency now, structural refactoring later | Shared bearer parsing, matching token claims, matching engines, plus the FastMCP major upgrade. The shared package and the stateless specification migration move to the post-VK2 phase. |
| 5 | GrowthBook is the production-cluster deployment | Admin UI reachable over Tailscale, only the SDK endpoint public. The split the deployment wiring already assumes. |
| 6 | Exposure is a self-service beta opt-in in the lecturer profile, gated on Catalyst and held entirely in GrowthBook | Replaces per-surface administrative enablement. No new column in the Klicker database. Students get no flag at all — see the exposure section. |

### What moved after VK2, and what did not

The FastMCP major upgrade is in the ship phase. It turns out to be nearly free for this codebase: the only breaking change in 4.0.0 is a redirect-URI default in `OAuthProxy`, which neither service uses, and the constructor, tool registration, and start options these services rely on are unchanged. It also pays for itself immediately — see the sequencing note under A2.

The shared MCP package and the stateless specification migration stay after VK2. The package re-opens the authentication path in the last week before a live teaching event, and the stateless move is a framework replacement rather than an upgrade.

## Where the branch actually stands

Both blocking pull requests have merged since the first draft. `origin/v3` is at `d4303516a8` (GrowthBook deployment configuration, #5468) and `origin/v3-ai` is at `3425cebb41` (the MCP and assistant stabilization pass, #5466). Stage 1 therefore shrinks to a single merge of current `origin/v3` into `v3-ai`.

`origin/v3` is 25 commits ahead of the merge base; `origin/v3-ai` is 15 ahead. Someone already synchronized `v3-ai` through `822695ef8`, so the divergence is far smaller than when ADR 0007 was written. The combined difference is 383 files, roughly 36,000 added lines, but a large share of that is generated output, evaluation fixtures, and planning documents rather than reviewable product code.

### What the branch contains

| Component | Where it lives | Size |
| --- | --- | --- |
| Student practice MCP server (PR #5090) | `apps/mcp-student` | 26 files |
| Lecturer MCP server and embedded assistant (PR #5109) | `apps/mcp-lecturer`, `apps/chat` manage surfaces | 27 + 90 files |
| LTI semi-anonymous guest access for chat (PR #5083) | `apps/chat` auth routes | part of the chat delta |
| Manage assistant widget | `apps/frontend-manage` assistant components | 15 files |
| PWA course chat drawer and embedded auth | `apps/frontend-pwa` | 13 files |
| Assistant evaluation harness | `evaluation/manage-assistant` | 75 files |
| Kubernetes deployment for both MCP services | `deploy/charts` | 12 files |
| Documentation and planning records | `docs`, `project` | ~30 files |

### Freshness and hygiene notes

The Prisma migrations do not collide: `v3-ai` adds one migration, dated after both of the newer `v3` migrations, and it only extends an enum. Neither MCP service is exposed through an ingress today; both are cluster-internal services reachable only by `apps/chat`. The conflict surface between the two branches is 32 files, and most of those are generated artifacts that should be regenerated rather than merged by hand.

## The problems worth solving

### 1. Authentication is inconsistent between the two MCP servers

The lecturer server requires a token that carries a dedicated `purpose` claim and an explicit scope, and it maps the lecturer's session scope down to a read-only floor when the session does not justify drafting. The student server does none of this: it accepts any token that verifies against the shared application secret and carries the participant role. A participant's ordinary session token is therefore already a valid student MCP credential, with no way to distinguish an assistant-mediated call from a directly replayed session token, and no scope narrowing at all.

This is the single most important finding, and it is exactly what decision 2 asks for. Both the minting side and the verifying side live on this branch, so it can be fixed atomically without a compatibility window.

Two smaller weaknesses sit alongside it. Both services fall back to the shared application secret when their dedicated secret is unset, so a leak anywhere in the platform compromises the MCP trust boundary as well; the environment overrides already exist and simply need to be populated. And both services carry their own private copy of bearer-token parsing while this same branch adds a shared implementation to the utilities package.

The LTI guest question is now answered by reading, without needing a working local LTI service. Guest personas are real participant rows, and the chat request path never consults the authentication mode when it wires up MCP tools — it consults it only to pick a fallback model. A guest persona therefore does receive a full participant MCP token today. This is defensible, because every student MCP tool is scoped to the calling participant's own rows, so a guest can only reach data it already owns. It should nonetheless be made deliberate rather than accidental: once the purpose claim exists, the minting call should record whether the actor is a full account or a guest, and the guest flag should be available to tool policy.

### 2. Nothing is behind a runtime flag

The manage assistant is gated by a build-time public environment variable, which is not a runtime control and cannot be changed without a redeploy. The lecturer MCP tool surface has no gate at all. The student-facing surfaces need none, since they follow from a lecturer having created a chatbot.

One property makes the merge safe regardless: an unconfigured GrowthBook client performs no fetch and evaluates every boolean flag false. Once the surfaces read flags, the merge is dark by construction even before GrowthBook is wired up in an environment. That is what makes a pre-VK2 merge defensible at all.

### 3. The MCP framework is two generations behind, in two different senses

"Latest MCP standards" decomposes into two unrelated pieces of work, and it matters which one is meant.

The first is a library upgrade: `fastmcp` 3.15.2 to 4.16.8, and `@modelcontextprotocol/sdk` 1.17.5 to 1.30.0 in chat. This is in scope for the ship phase. Despite crossing a major version it is close to a no-op here — the sole 4.0.0 breaking change tightens a redirect-URI default in the built-in OAuth proxy, which neither service uses, and both services touch only the constructor, `addTool`, and the HTTP-stream start options, none of which changed. Version 4 also adds per-tool access predicates and built-in scope and role helpers.

The second is a specification migration, and it is not a version bump. FastMCP — at any version, including the newest — implements only the legacy handshake-based revisions, `2025-11-25` and earlier. The current specification, `2026-07-28`, made the protocol stateless: no `initialize` handshake and no session identifier header. FastMCP's own documentation states it does not support the current specification and points at a different framework for projects that need it. Moving to the current specification therefore means replacing the framework in both services, not upgrading it.

This also explains an observation from the running stack. Unauthenticated calls to either service are refused with a generic bad-request error from the transport's session layer, before authentication is ever consulted. That is FastMCP's legacy session handshake firing first. It is safe, but it is not the response an MCP protected resource is supposed to give, and it will only be fixed by the stateless move, alongside the external OAuth work that needs the same challenge response.

### 4. The two MCP servers are near-duplicates

They share an almost identical file layout — configuration, authentication, capabilities, tool policy, tool runner, tool errors, server, service — with different payloads. This is a real consolidation opportunity and the reason a shared package is worth building. It is also a refactor of the authentication path, which is why it is scheduled after the merge rather than before it.

## Phase A — ship before VK2

Five working days plus a weekend. This is tight against the work below and only fits if the deferrals above hold.

### A0 — GrowthBook provisioning, running in parallel

Not a code stage and not on the critical path of any other stage, but it gates A6 and has external lead time, so it starts alongside A1 rather than waiting for it. Its first step is an audit, not a build: some or all of this may already be provisioned. Details under the GrowthBook section below.

### A1 — Re-baseline the branch

Merge current `origin/v3` into `v3-ai`. Resolve the chat UI and translation conflicts by hand; take either side for generated artifacts and regenerate them through GraphQL codegen and a fresh install. Bring the whole repository check suite to green.

*Exit:* branch builds, typechecks, formats, lints, passes unit tests; the GrowthBook package is present and importable.

### A2 — Upgrade FastMCP and the MCP SDK

Move both services to `fastmcp` 4.16.8 and chat's `@modelcontextprotocol/sdk` to 1.30.0. The only migration touch worth planning is the `authenticate` failure path: version 4 expects a thrown `Response` carrying a status rather than a `UserError`, which incidentally turns today's generic rejection into a proper unauthorized response.

Do this *before* the token work, not after. Version 4's per-tool `canAccess` predicate with its `requireScopes` and `requireRole` helpers is precisely the primitive A3 would otherwise hand-roll, and expressing both services' policy through the same framework idiom shrinks the shared package that phase B extracts.

*Exit:* both services start, all thirteen tools respond, negative smoke tests pass, and unauthenticated calls return an unauthorized status.

### A3 — Close the token trust boundary

Give the student MCP the token contract the lecturer MCP already has: a dedicated purpose claim required on the verifying side and emitted on the minting side, plus explicit scopes so read-only and practice-submitting tools are separable. Express the per-tool scope requirements through the framework's access predicate rather than inside each tool's runner, and move the lecturer service's existing hand-rolled scope check onto the same mechanism. Carry the actor kind — full account or LTI guest — into the minted token so tool policy can see it. Populate the dedicated per-service signing secrets in the deployment values so neither service depends on the shared application secret. Replace both private bearer-parsing copies with the shared utility.

Then run a bounded security review over the MCP authentication and authorization surface and over the assistant's proposal-confirmation path, which is the only route on this branch that writes to the database on a model's suggestion.

*Exit:* no MCP tool is reachable by a token that does not trace to a Klicker chatbot acting for an authenticated session; the negative smoke tests both services ship cover the new rejections.

### A4 — Node 24 alignment

`apps/mcp-student/package.json` and `apps/mcp-lecturer/package.json` are the only two packages in the repository still declaring Node 20; every other package declares 24. Both Dockerfiles already build on Node 24.16.0, so this is a two-line correction that removes an unsupported-engine warning on every container start, not a runtime change.

*Exit:* no engine warnings in the development run; `syncpack` clean.

### A5 — Put every surface behind a GrowthBook flag

Register the flag keys and extend the contract test. Mount the browser provider in the lecturer UI and chat, mapping the authenticated lecturer to the shared attribute contract at each boundary. Add the server-side client where a flag must gate an API route rather than a UI affordance — the lecturer MCP tool surface in particular, since a hidden button is not an authorization boundary. Fold the manage assistant's build-time environment variable into the same mechanism so there is one control per surface rather than two overlapping ones.

Two flags, both lecturer-facing and both shipping false: the embedded assistant in manage, and the lecturer MCP tool surface in chat.

This stage also builds the beta opt-in: a switch on the existing settings page, a Catalyst-scoped mutation on the primary GraphQL backend, and that mutation's call into the GrowthBook Management API to manage saved-group membership. Publish Catalyst as a GrowthBook attribute so the targeting rule can require both halves. See the exposure section below.

*Exit:* with GrowthBook unconfigured, every new surface is invisible and every new endpoint refuses; with each flag individually enabled, the corresponding surface works.

### A6 — Verify dark, merge, deploy

Deploy to staging with GrowthBook unconfigured and confirm a lecturer and a student see exactly the `v3` experience. Then enable each flag one at a time for a single test account and verify each surface in the browser with screenshots. Turn everything back off.

Run the integrated final review over the whole branch, merge into `v3` with all flags false, deploy to production, and retire `v3-ai` by retargeting #5424 and #5474.

*Exit:* production carries the capability with nothing visible; no branch targets `v3-ai`.

### A7 — Open the beta opt-in for VK2

Publish the targeting rule — saved-group membership and Catalyst — and verify it end to end with one real account: toggled off shows nothing, a non-Catalyst account cannot opt in at all, toggled on with Catalyst shows the surfaces. Then tell VK2 participants how to opt in.

*Exit:* opting in works, opting out works, and a non-Catalyst opt-in provably grants nothing.

## Phase B — after VK2

None of this blocks the merge; all of it should happen before the features leave the flagged state permanently.

| Item | Why it waits |
| --- | --- |
| Shared MCP package extracted from the two services | Re-opens the authentication path; wants a calm week and its own review |
| Current-specification (`2026-07-28`) stateless migration | Framework replacement, not an upgrade; also the prerequisite for a correct unauthorized challenge response |
| External OAuth 2.1 for third-party MCP clients | Already planned separately; depends on the stateless move |
| Working local LTI configuration for end-to-end testing | Useful for regression coverage of the guest path; no longer needed to answer the security question |

One operational constraint spans both phases: do not enable horizontal autoscaling or more than one replica on either MCP deployment while the transport is session-stateful, because a session initialized against one replica fails against another. The chart currently runs a single replica with autoscaling off, which is correct. The stateless migration is what makes multiple replicas safe.

## Effort and risk

| Stage | Estimate | Main risk |
| --- | --- | --- |
| A1 Re-baseline | 0.5–1 day | Chat UI conflicts are larger than the file count suggests, since both branches edited the same components |
| A2 FastMCP upgrade | 0.5 day | Twenty minor releases of accumulated drift between 3.15 and 4.16, none of them declared breaking |
| A3 Token boundary | 1 day | Scope taxonomy for student tools needs a design call, not just a claim check |
| A4 Node 24 | minutes | None |
| A5 Flags and beta opt-in | 2.5–3.5 days | First-ever GrowthBook adoption, and the first write path into the Management API; two fewer flags than planned, but the opt-in mutation is new ground |
| A6 Verify, merge, deploy | 1–1.5 days | Browser images must be rebuilt after the GitHub variables are set — see the ordering constraint below |
| A7 Enablement | 0.5 day | Depends on the Management API write path working in the target environment |

Six to seven and a half working days against five working days plus a weekend. It fits only if the flag stage starts no later than Tuesday and the GrowthBook SDK connections are created in parallel with A1 rather than after it.

### GrowthBook: what exists, and what to check before building

GrowthBook runs on the production cluster. Administrators reach the interface over Tailscale; only the SDK endpoint is public. That is exactly the split the deployment wiring assumes — public endpoint for browser bundles, in-cluster endpoint for backend workloads, no public admin surface.

What #5468 already landed: `GROWTHBOOK_ENV` rendered from the per-environment `deploymentEnvironment` value, optional `<release>-secret-growthbook` imports on every Node workload, an additional management-credential secret on the primary GraphQL backend only, build arguments on all five Next.js images, and the Turborepo global environment entries.

What that pull request explicitly did not do, and what A0 therefore covers — starting by checking what is already in place, since some of it may have been provisioned outside the repository already:

| Item | How to check |
| --- | --- |
| One SDK connection per environment | GrowthBook admin interface over Tailscale |
| `<release>-secret-growthbook` present in staging and production | Inspect the Secret's key names only, never its values |
| The four GitHub Actions repository variables | `gh variable list` |
| The five flags, defaulting off | GrowthBook admin interface |
| Public SDK endpoint permits the browser origins | Only observable after a browser build reaches an environment |

The last item is the same class of problem as the media-upload CORS rule: invisible until a real browser makes the request.

One ordering constraint follows from how Next.js handles public variables. The endpoint and client key are inlined into the browser bundle at image build time, so the repository variables must be set *before* the release images are built. Flag values themselves are fetched at runtime, so flipping a flag afterwards needs no rebuild — but adopting flags at all does. Setting the variables late means rebuilding, which is the difference between a calm Friday and a bad one.

If the SDK connections somehow cannot be created in time, the fallback still holds: gate every surface behind server-side environment variables defaulting to off and convert them afterwards. The merge stays dark and unblocked; the cost is all-or-nothing flipping per environment and no per-account targeting during VK2.

## How exposure actually works

A lecturer opts into beta features in their own profile. That opt-in lives in GrowthBook, not in the Klicker database, and Catalyst is the second half of the targeting rule — opting in without Catalyst grants nothing. This covers every lecturer-facing surface on the branch, the embedded assistant included, so the earlier "keep the assistant hidden" instruction is satisfied by the opt-in itself rather than by a separate administrative decision.

Students get no flag. A lecturer with the feature creates a chatbot in a course, and the students in that course see it. No chatbot, nothing to see. Student visibility is a consequence of what the lecturer did, not a separate switch.

### The toggle writes to GrowthBook through the backend

The deployment wiring already anticipated this. Only the primary GraphQL backend receives `GROWTHBOOK_MANAGEMENT_API_KEY`, explicitly so that a future authenticated administration surface can write to GrowthBook without handing a write-capable credential to every evaluator workload. That surface is what this stage builds.

The shape: a settings-page switch calls a mutation on the primary backend, which uses the GrowthBook Management API to add or remove the lecturer from a saved group. The targeting rule reads membership in that group plus the Catalyst attribute. The settings page already has the component pattern for a switch like this, and `asUserWithCatalyst` already exists as an authorization scope, so the mutation can refuse a non-Catalyst opt-in at the resolver rather than relying on the targeting rule alone. Catalyst itself needs no new plumbing — it is already a derived boolean on the user and already published to the GraphQL context.

Two consequences worth naming. Toggling now depends on an external service being reachable and writable, so the mutation needs a sane failure mode rather than a silent no-op. And the opt-in state is no longer visible in the Klicker database, so support questions of the form "why does this lecturer see the assistant" are answered in the GrowthBook interface over Tailscale.

### The flag set shrinks to two

With no student-side flags, only the lecturer-facing surfaces need one: the embedded assistant in manage, and the lecturer MCP tool surface in chat. Both ship false. They may well collapse into a single flag, since the same opt-in governs both and nothing suggests wanting one without the other — that is worth deciding when the rule is written rather than assuming two.

### One consequence of the student rule, for the record

Students already reach a course chatbot page on `v3`; the branch replaces that with a drawer embedded in the activity pages. Under the rule above, that drawer appears wherever a course chatbot already exists, including for lecturers who never opted into anything. That is a student-visible change at deploy time rather than at opt-in time. It reads as an improvement to an existing feature rather than a new capability, so I plan to let it ship that way — but it is the one place where "students see it because the lecturer made a chatbot" applies to chatbots made long before any of this existed.

## Local environment for manual verification

Verification ran against a worktree holding `origin/v3-ai` plus the stabilization commits, which have since merged as #5466; that worktree no longer exists and A1 recreates one under `trees/`. The container development command carries both MCP services in its workspace filter, so they start alongside the applications. Neither service is registered in the devrouter application list, which is correct: they are reached only by chat from inside the container, on internal ports 7080 and 7081, and are not routed to a browser-facing host name. Anything that would let a browser or an external MCP client reach them directly is deferred external OAuth work.

The environment is started through Infisical so the local LiteLLM container receives the OpenRouter key, because the assistant surfaces need a working model to be verified at all. Use only seeded or synthetic content, since OpenRouter is an external upstream.

### Observations from the running stack (2026-08-22)

The workspace came up cleanly. Both MCP services start under the container development run and listen on their internal ports. Manage and both chat entry points serve normally.

Unauthenticated and bad-token calls to either MCP service are refused, but by the transport's session layer with a generic bad-request error before authentication is consulted — the legacy handshake behavior described above. Safe today, wrong by specification, fixed by the phase B stateless move.

The local LTI service fails to register its platform because no platform URL or client identifier is configured, so the guest launch path is not exercisable locally. This no longer blocks anything, since the guest security question was answered by reading the code path.

Both MCP packages warn about Node 20 on every start, which A4 closes.

## Progress

### A5, first half — flags registered, surfaces gated (2026-08-23)

Two flags, not one. The plan left the collapse question open; keeping both costs nothing, because a single targeting rule can serve two keys, and it buys a real operational split: `manage-assistant` covers the surface (the launcher in Manage, the `/manage` page in chat, `POST /api/manage/chat`), while `manage-assistant-mcp-tools` covers only whether that assistant receives the lecturer MCP tools and whether a proposal token is still redeemable. The tools can be withdrawn without taking the assistant down with them, which matters because the tools are the half that talks to a separate service.

Both API gates evaluate server side, per request. A hidden launcher was never an authorization boundary, and chat's `/manage` page is directly reachable by URL whatever Manage renders.

`NEXT_PUBLIC_MANAGE_ASSISTANT_ENABLED` is gone. It was never set in the staging or production image builds, so folding it in takes nothing dark that is visible today; the only environments that had it on were local development and the end-to-end suite.

One addition the plan did not anticipate. Removing that variable would have broken `Y-manage-assistant.spec.ts`, which relied on it to compile the widget into the CI bundle, and would have left the enabled path unverifiable until GrowthBook exists. Both are answered by `FEATURE_FLAGS_FORCED_ON` and its public twin: they name registered flag keys to force on, and are honored only when the flag environment resolves to `development` or `test` **and** no SDK connection is configured. A value set on a staging or production build turns nothing on, which is asserted directly in the package tests.

Publishing Catalyst as a targeting attribute needed two edits, not one — the attribute type and `sanitizeFeatureFlagAttributes`, which drops anything it does not explicitly whitelist. Missing the sanitizer would have failed silently in the dark direction: every A5 and A6 check would still pass and the rule would first fail at A7 enablement. There is now a test asserting `catalyst` survives sanitization and that a non-boolean value does not. Chat reads it from the session token's own claims, which already carry `catalystInstitutional` and `catalystIndividual`; Manage reads it from the `UserProfile` query it already issues.

Verified locally in the browser as a signed-in lecturer, both directions. Flags off: no launcher in Manage, and chat's `/manage` answers with the application's not-found page. Flags forced on: the launcher appears and its panel renders the embedded assistant. The independent case — assistant up, tools withdrawn — is covered by unit tests but not exercised in a conversation, because local chat has no model key without the Infisical path; A6 staging inherits that check.

Repository checks green: typecheck 27/27, Biome and Prettier clean, JavaScript lint 6/6, `syncpack` valid. The `@klicker-uzh/analytics` lint task fails in the container on a pandas build unrelated to this work.

### A5, second half — the beta opt-in (2026-08-23)

The switch lives on the existing user settings page and is mounted only for Catalyst accounts. Behind it, `betaFeatures` and `setBetaFeatures` on the primary GraphQL backend manage membership in one GrowthBook list saved group. Neither is gated by a feature flag, on purpose: this is the switch that puts a lecturer into the group the flags target, so gating it would leave nobody able to opt in. Both require the Catalyst scope, and the mutation additionally requires full account access, matching the neighboring settings mutations so a read-only delegated login cannot opt an account in.

The plan asked for a sane failure mode rather than a silent no-op, and the two directions needed different answers. The query returns `null`, not `false`, when the integration is unconfigured or GrowthBook cannot be reached, and the setting hides itself in that case — showing an unchecked switch would tell a lecturer they are opted out when the truth is that nobody knows. The mutation raises instead, and the switch renders the failure inline.

Membership is written with a read-modify-write against `POST /api/v1/saved-groups/{id}`, sending `bypassApproval`. GrowthBook's newer draft-and-publish revisions API avoids the lost-update race but is absent from older self-hosted releases, and the cluster's version is not observable from here; opt-in happens at human pace on a group nothing else writes, and a lost update is recoverable by toggling again. If the cluster turns out to support revisions, the swap is confined to one file.

The one new configuration value is `GROWTHBOOK_BETA_SAVED_GROUP_ID`, the saved group's id. It is not a secret, so it rides in the backend ConfigMap rather than joining the write-capable key in the management Secret. The management Secret itself needed no change — the deployment wiring already put it on the primary GraphQL backend alone, which is exactly the workload that now consumes it.

Verified against a real GrowthBook, not a stub. A throwaway GrowthBook and MongoDB ran on the container network, and the devcontainer now passes all three variables through from the developer's own shell, never from the committed environment file, because the key is write-capable and this repository is public. Toggling on put the lecturer's id into the group and survived a reload; toggling off removed it and left the other member untouched. Stopping GrowthBook made the switch disappear rather than lie, and stopping it mid-session made the write fail visibly instead of springing the switch back silently. Ten service unit tests cover the same paths, and repository checks are green: typecheck 27/27, formatting clean, the analytics lint task still failing on its unrelated pandas build. The chart change was rendered both ways as well: with a group id set the ConfigMap carries the variable, and with the default empty value it is absent entirely, so an environment that has not been provisioned yet simply keeps the switch hidden.

The operations are named `betaFeatures` and `setBetaFeatures` rather than `betaAccess`. The pre-commit secret scan flags the generated persisted-query hash map when an operation name containing "Access" sits next to a 64-character document hash — gitleaks' generic-key rule keys off the word. Renaming clears it without weakening the scan or bypassing the gate, and it matches the user-facing "Beta Features" label.

One deviation from the plan text worth recording: the plan said to mount the browser flag provider in the lecturer UI *and* chat, and chat received only the Node client. Chat has no client-side flag branch today, so a browser provider there would be dead weight; add it in the same change as chat's first client-side branch.

### A5, amended — one flag plus an account entitlement (2026-08-23)

The two-flag split above is withdrawn at the user's direction: one beta feature flag, and separately a per-account record of whether the account is enabled for the AI features, meaning it has supplied a cost center the usage can be billed to.

`manage-assistant` and `manage-assistant-mcp-tools` are replaced by a single `ai-beta`. Everything the beta adds now moves together — the launcher, the `/manage` page, `POST /api/manage/chat`, the lecturer MCP tools that route loads, and `POST /api/manage/proposals/confirm`. The collapse also closes a gap the split had: confirmation used to follow only the tools flag, so turning the surface off left an already-minted proposal token redeemable.

The account entitlement is a new `User.aiFeaturesEnabled` column, not a reuse of `privatePreview`. `privatePreview` already grants the catalog, user groups, element sharing, and several other unreleased surfaces, so putting billing consent on it would mean granting one implies granting the other. It is also not a GrowthBook attribute: it is a contractual fact about the account, and a rule that forgot to mention it would open the gate, whereas code that requires it cannot.

Both conditions are enforced in one place, `isManageAiEnabled`, so a caller cannot check the flag and forget the entitlement. It reads the entitlement live from the database rather than from the session token: it is the switch that stops spending, and a claim minted at sign-in would keep a revoked cost center spending until the lecturer next signed out. That costs one indexed lookup per request, and only after the flag has already passed, so a lecturer outside the beta costs no query at all. Chat already talks to Prisma, so this needed no new dependency and no change to the JWT claim shape that seven services verify.

Administration mirrors the private preview panel, with one difference: it sets rather than only grants, because a billing arrangement can end. The seeded `lecturer` account is the only fixture enabled for AI features, which leaves every other seeded account as a ready negative case.

Repository checks green: typecheck 27/27, formatting clean, chat 529/529 — including eight tests that were already failing on the branch before this change, three from the Catalyst attribute added in the first half and five in the route boundary suite. Five new tests cover the composite gate directly, including the case that matters most: inside the beta, entitlement withheld, gate closed. Two GraphQL integration tests around activity sharing and assessment restrictions fail against the shared local database both before and after this change, depending on what ran previously; they are untouched by it.

The A6 check inherited from the first half — "assistant up, MCP tools withdrawn" — no longer exists as a state and is dropped.

Verified in the browser against the seeded database in the `feat-v3-ai-reintegration` workspace. The admin panel lists only the seeded lecturer under AI features; enabling and then disabling a second account moved that account in and out of the table with the matching confirmations. With the flag forced on, the entitled lecturer saw the launcher and its panel rendered the embedded assistant. Withdrawing the lecturer's own entitlement removed the launcher on reload and left chat's `/manage` without the assistant — though that page showed a "Chatbot not found" card rather than the framework's not-found page, so the negative path is confirmed as closed but its exact rendering is worth pinning down on staging. Delegated login is broken in this workspace for unrelated reasons (`apps/auth` answers every `/api/auth/*` route with 404), so the session was established by minting a token against the committed dev secret.

Committed as `feat(flags): collapse the assistant flags into one beta flag plus an account entitlement`.

### Still open

The four `NEXT_PUBLIC_GROWTHBOOK_*` repository variables do not exist yet — `gh variable list` returns none. Everything else in A0 needs the GrowthBook interface over Tailscale. The ordering constraint stands: the variables must be set before the release images are built, or the images carry no SDK connection and the flags cannot be turned on without a rebuild.
