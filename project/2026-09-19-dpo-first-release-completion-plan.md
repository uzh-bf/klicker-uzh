# DPO first-release completion plan

## Approval summary

Complete the first DPO release with transparent account disclosures, current privacy-policy acceptance, independent research and Learning Analytics (LA) choices, durable persistence, and accessible settings. Cover normal and assessment signup, existing PWA participants, registered chat participants, and persisted chat guests. Guests receive a short first-use explanation and the same choices before sending messages. Refusing both optional purposes permits ordinary use after acknowledgement.

Keep the shared database and participant contract on `v3` through PR #5970. Put chat-specific integration in a focused companion targeting `v3-ai`, consuming that foundation through the established branch synchronization. Preserve the existing authentication identity order and the separate per-chatbot disclaimer. Replace student-facing examples of individual LA rows with group-only explanations and synthetic illustrations. Publish the supplied final privacy-policy wording alongside the release.

The current follow-up is limited to notices, policy acknowledgement, independent choices and their persistence/settings. Existing analytics containment remains in the foundation. Live containment and any retained-derived-data reconciliation remain separate deployment prerequisites; they do not add analytics or cleanup implementation to this follow-up. Research exports, assessment exports and KB confirmations remain later work.

The user approved these product boundaries on 19 September 2026 and narrowed the immediate follow-up to notices and acceptance on 20 September. The current request updates this plan only. Prior implementation authority remains bounded by that narrowed scope. Task-branch commits and ordinary PR delivery are covered by standing implementation authority; target merges, protected-branch synchronization, deployment, and real-data cleanup require their named authorization. Completion of the notices package means verified source and PR evidence, with unresolved deployment prerequisites reported separately.

## Release sequencing — STG, then PRD, then next steps

The notice and persistence layer is merged into both `v3` and `v3-ai`. The remaining work is split into three ordered stages. Each stage keeps its own named-authority gate; completing one stage does not authorize the next.

### Stage 1 — Promote to STG for testing

Goal: get the merged notice/acceptance layer onto staging so the student-facing behavior can be tested before the semester starts.

Entry state, verified 20 September 2026:

- `origin/v3` at `11e48f2aeb` contains the DPO squash `d3ab5f1c04` (PR #5970 merged 19:01Z).
- `origin/v3-ai` at `4be34ed26d` contains `a4960ba1bd` plus the participant data-use export fix through merge PR #6208.
- `origin/v3-audit` at `ddfa6ee4d7` contains the layer through integration merge PR #6199. Its two parents are the prior `v3-audit` tip `96ed33f8c7` and the integration head `64e5c584f0`; it is a true merge commit, not a squash.
- `origin/stg-release` remains at `55efc535a6`, so the merged layer is not yet promoted or serving.

Integration branches and release-line hops use merge commits. Never squash a `v3` → `v3-ai`, `v3-ai` → `v3-audit`, or comparable integration PR, because flattening it hides the synchronization boundary and can make later conflict resolution silently drop line-only work.

#### Stage-1 promotion and rollout evidence, 21 September

The integration hops retained merge ancestry. #6199 merged as `ddfa6ee4d7` with parents `96ed33f8c7` and `64e5c584f0`; it was not squashed. #6211 merged as `330364bb12` with parents `6ecaac08eb` and `7be454c69a`. #6203 merged as `cd308e7bae` with parents `330364bb12` and `dda8029041`, making it the `v3-audit` candidate.

The first automatic promotion attempt failed because the controller rejected GHCR's trusted `307` blob redirects. The focused controller fix on `rs/stg-promoter-redirect-debug` follows only trusted blob redirects, drops the authorization header when forwarding to storage, and still fails closed otherwise. Diagnostic dry-run `35555539472` passed at controller SHA `f1b3d30a88`; authorized apply run `35555663257` then fast-forwarded `stg-release` from `55efc535a6` to `cd308e7bae`. Its receipt records exact-head CI, image builds and scans, and a first-attempt apply with no failures. Separately, #6214 landed the durable `v3` controller fix as `a2258352dd` and adds blob-digest validation; #6215 then carried it into `v3-audit` as merge `7cc37fce83`. The debug branch remains promotion-run evidence, not an additional vehicle. At that checkpoint STG was pinned to the verified `cd308e7bae` receipt; the later `v3-audit` head required its own promotion and STG verification before PRD.

Argo refreshed and synced `app-klicker` at `cd308e7bae`, ran the PreSync migration from the matching migrator image, and reported the application healthy after that rollout. At 03:00 to 03:01 UTC on 21 September, the PWA, assessment, auth, API, response API, chat, worker and MCP pods ran images tagged `cd308e7bae` with no restarts. Startup readiness warnings and the brief HTTP `503` responses occurred during pod replacement; PWA, assessment and auth subsequently returned HTTP `200`.

##### Final Stage-1 candidate: `7cc37fce83`

The later `v3-audit` integration merge #6215 (`7cc37fce83`) then passed the complete exact-head gate and became the current STG candidate. On 21 September, `origin/v3` was `812e4105` from #6205, `origin/v3-ai` was `c8b41c18`, and both `origin/v3-audit` and `origin/stg-release` were `7cc37fce83`. Promotion run [`35557429167`](https://github.com/uzh-bf/klicker-uzh/actions/runs/35557429167) used controller `a2258352`, validated candidate and applied release as `7cc37fce83`, moved from `cd308e7bae` in one apply attempt, and read back the new `stg-release` SHA as verified. Receipt artifact `10620753219` records green exact-head CI and image builds; all rollout image tags name `7cc37fce83`. PWA, assessment and auth returned HTTP `200`; the API root `/health` path returned the expected `404`.

##### STG notice acceptance, 21 September

Live PWA checks used the synthetic `teststudent` account on the `7cc37fce83` STG build. The existing-user renewal at `/de/account/data-use` showed Research collapsed with its recorded choice, Learning Analytics expanded and marked as requiring a decision, and an unchecked acknowledgement. The Research section expanded independently and retained the approved German wording and policy link. Selecting LA refusal and acknowledging enabled submission; submission returned to `/editProfile`, and a fresh load showed Research allowed and LA refused. The profile section exposed both independent choices and the policy links.

The unauthenticated normal signup at `/de/createAccount` showed Research collapsed and allowed by default, Learning Analytics expanded and unanswered, and acknowledgement unchecked, leaving account creation disabled. The four informational disclosures, Research and Learning Analytics could all be open simultaneously. Their wording described account/course/activity data, lecturer and participant visibility, group-only lecturer Learning Analytics reports, processing purposes, retention and deletion. Links targeted the German privacy policy and Learning Analytics explanation.

The unauthenticated assessment data-use route redirected to the assessment Edu-ID login with a valid return target and stated that Edu-ID authentication is required. Verifying the expanded assessment account wording therefore remains gated on an authorized Edu-ID test account. The public privacy-policy and Learning Analytics links target `www.klicker.uzh.ch`, but that host timed out from both the browser and shell during this check and no docs service is exposed on the application STG hosts; live publication therefore remains unproven. These two items remain part of Stage-1 acceptance.

Actions, in order:

1. ~~Land PR #6211, the focused audit Rollup transform fix on `v3-audit`. It unblocks the exact-head rebuild exposed by #6199 after the old cached build replay no longer applied. Use a merge commit; preserve exact-head CI before merge.~~ Done as a merge commit.
2. ~~Let the staging promoter independently re-validate the exact `v3-audit` head and move `stg-release`. Promotion activation is a named-authority action.~~ Done manually after the controller redirect fix.
3. Test on STG: normal signup, assessment creation and first entry, existing-user renewal, profile settings, and the public privacy-policy and student LA pages. Distinguish merged, promoted, serving and E2E-proven; an artifact on the branch or a moved release ref is not live acceptance. Normal signup, existing-user renewal and profile persistence are now live-verified; assessment entry needs an authorized Edu-ID test account, and public policy/LA publication needs a reachable updated docs deployment.

Deployment prerequisite carried into this stage: prove live optional-processing containment and any required retained-LA reconciliation before the new promises and choices are exposed. Source containment alone is not live containment.

#### Stage-1 conflict finding: preserve the v3-audit SSR logging (resolved)

Two vehicles target `v3-audit` with `v3-ai`: the auto-sync #6203 (CONFLICTING, head `v3-ai`) and the owner-authored #6199 (`rs/v3-audit-sync-20260920e`). An earlier #6199 head resolved the two DPO pages to the `v3-ai` side and silently dropped code that exists only on the `v3-audit`/staging line: the SSR request logging (`createSsrRequestLogging`, `logFailure`, `initializeApollo(undefined, ctx, requestContext)`) and the `requestContext` propagation in `apps/frontend-pwa/src/lib/apollo.ts`. That logging comes from `1b368fb255` (`enhance(logging): complete server-side app adoption`), an ancestor of `v3-audit` and `stg-release` but of neither `v3` nor `v3-ai`, so a naive `v3-ai`-side resolution reverts it. A corrected resolution was prepared on `rs/v3audit-integrate-20260920` (merge `29312dd770`, parents `96ed33f8c7` + `a4960ba1bd`) and pushed without a PR.

**Resolution:** #6199 is the single vehicle. Its updated head `ccd6009c64` restores the SSR logging and request-context propagation, keeps the DPO notice/choice behavior, and contains both `v3-ai` tip `a4960ba1bd` and `v3-audit` tip `96ed33f8c7`, so it supersedes both the defective resolution and the prepared branch. `rs/v3audit-integrate-20260920` is retained only as evidence and can be deleted after #6199 lands. Landing #6199 and the staging promotion are covered by the user's 20 September authorization to deploy and verify on STG.

### Stage 2 — Release to PRD

After STG validation, promote the validated artifact to production along the existing release path. STG sign-off does not itself authorize the PRD release, which keeps its own approval. Confirm that the exact validated `v3-audit` head is what is promoted, re-check migration compatibility and rollback behavior (a rollback must not erase saved choices, acknowledgement history or audit events), and re-run the applicable post-deploy health evidence.

#### PRD preparation checklist

Production runs at `*.klicker.uzh.ch` on hand-edited pinned image tags in `deploy/env-uzh-prd/values.yaml` (currently `v3.4.0-alpha.80`) with `replicaCount: 2` for web/API services. The Prisma migration runs automatically as the ArgoCD `PreSync` hook because `migrator.enabled: true`, and the migrator tag auto-tracks the backend tag, so a tag roll needs no separate migrator pin. Prepare, do not execute, the following:

- [ ] **STG acceptance recorded.** The exact `v3-audit` head that passed STG verification is written here with its promotion receipt artifact, and the disclaimer surfaces are confirmed serving that head. A later `v3-audit` advance means repeating STG verification for the new head before PRD.
- [ ] **Live containment evidence attached.** Values-free evidence that LA writers are stopped, in-flight work cannot recreate derivatives, retained derivative tables and pending withdrawals are reconciled or scheduled, and the four optional analytics reads are contained in the running staging deployment. Source containment alone does not satisfy this gate.
- [ ] **Release version prepared.** Run the repository release script from the root to generate the version and `CHANGELOG.md` (never hand-edit package versions), pass `--skip.tag` during PR preparation, and create the tag only at the approved merged release commit.
- [ ] **PRD values update drafted on `v3`.** One reviewable change rolls the pinned tags in `deploy/env-uzh-prd/values.yaml` to the validated release. Keep `migrator.enabled: true`; a rollback to a pre-migrator tag is the only case that requires setting it back to `false`. The staging/production values-parity gate must pass with the image reference as the only exclusion.
- [ ] **Migration and rollback reviewed.** Confirm the pending DPO migrations are additive and safe under the `PreSync` hook, and that a rollback preserves saved research/LA choices, acknowledgement history and `ParticipantDataUseEvent` audit records. Note the assessment database is covered only if its backend Secret targets the migrated database.
- [ ] **Reviews complete.** Required CI green on the exact heads, and `/final-review` posted on the unstacked PR under the standing approval. A pending or provider-failed review is not a pass.
- [ ] **Post-deploy evidence planned.** Health checks, the disclaimer surfaces serving the new head on `*.klicker.uzh.ch`, and a persistence read-back confirming choices survive a renew. Mixed-version behavior during the rolling update is reviewed, not assumed.

Executing this checklist — the release commit/tag, the `v3` values change, and the PRD rollout — remains a separate named-authority action.

### Stage 3 — Next steps, after the PRD release

Resume the deferred packages below. They are preserved, not cancelled, and none is required for the STG or PRD notice release:

1. Chat notices companion on `v3-ai`: registered renewal, simplified first-use guest notice, returning-guest renewal and guest-accessible settings.
2. Public-explanations follow-up: publish the guest-present-tense availability claim only once the companion is live.
3. KB upload/import/replacement and audience-change confirmations.
4. Research and assessment exports.
5. LA product: course activation, eligible computation, group-only reports, withdrawal processing and recomputation, and operational monitoring.

This sequencing supersedes the earlier framing that treated the notice package and the deferred features as one continuous execution run. The plan's implementation contracts and acceptance evidence below still apply within each stage.

## Status and source of truth

- **Execution status:** the core notice/persistence layer is merged into `v3` (squash `d3ab5f1c04`, PR #5970, 20 September 2026) and into `v3-ai` (PR #6201, merge `a4960ba1bd`). The remaining work follows the three release stages above: promote `v3-ai` → `v3-audit` to STG and test, release to PRD, then resume the deferred packages. Chat completion, the deferred exports/KB/LA work and final authenticated/locale/mobile proof remain open; historical runtime checkpoints below are not the current source status.
- **Owner:** main task owns integration, unresolved decisions, acceptance evidence, and release boundaries. One owner per package below; parallel execution is optional where write sets are disjoint.
- **Artifact home:** this `project/` directory in the existing task worktree. This is the current execution plan for the first release and supersedes older statements postponing chat onboarding.
- **Historical progress:** the 6 September DPO roadmap and PR #5819 execution plan remain historical records. Preserve their broader deferred work; do not import those broad branches into this release.
- **Review record:** native planner approved the 19 September plan after one correction pass. Local evidence: `project/_local/reviews/2026-09-19-dpo-first-release-plan-hardening.md`. The 20 September source/document review and narrowed follow-up are recorded below; affected verification and the final review must cover the subsequently delivered source heads.

### Current follow-up — notices and acceptance, 20 September 2026

This amendment supersedes the older package scheduling where it would start analytics, retained-data cleanup or broader DPO work. It records the final-document review and the user's instruction to focus on notices and acceptance. The implementation contracts below remain binding within that scope. Main owns this amendment and its source/authority consistency review; this documentation update does not claim fresh runtime verification or an additional independent review.

**Evidence baseline.** The review covered core head `ec94ed06de`, target `v3` at `e1d8e185e8`, and `v3-ai` at `65cebe131f`. A fresh fetch for this amendment confirms the same heads: the core task is 30 commits ahead / two behind `v3`, and aligned with its published task branch. The new target includes OAuth audience fix #6071. All 13 German disclaimer blocks match the accepted-change DOCX text after formatting normalization. The German website policy matches substantively, with three spelling/grammar corrections. Keep this wording; review the English translation for equivalent meaning. The DOCX editable final text is the copy source; its embedded older screenshots guide layout only. Keep the originals and extracts outside public Git history.

#### Immediate work, in order

1. **Core notices and saved choices — core owner, `v3`; merged, carried into Stage 1.** The normal signup, assessment entry, PWA completion and profile implementations, the persisted research and LA choices, the reworked privacy policy, the group-only student LA pages and the shared writer seam are delivered in `d3ab5f1c04`. Stage 1 tests this behavior on STG; the Stage-1 conflict resolution in `createAccount.tsx` and `editProfile.tsx` must preserve research allowed/collapsed, LA unanswered until an explicit choice, unchecked acknowledgement, whole-row design-system collapsibles, independent open sections and design-system buttons, with both optional refusals still permitting normal use.
2. **Verify the separate assessment account flow — core owner, during Stage 1.** The user confirmed on 20 September that normal and assessment accounts are intentionally separate. Retain the shared acceptance contract without new context fields or migrations. Test first assessment entry and renewal for an existing incomplete assessment account within that separate account boundary on STG. Confirm the assessment variant comes from trusted context and includes identity, answers/results, audit logs, lecturer access and retention restrictions. Preserve saved research/LA values and timestamps on renewal unless changed. Local synthetic fixtures must model the separate accounts; local mode switching over one fixture database is not evidence of production account reuse.
3. **Complete the chat notices companion — chat owner, Stage 3 only.** Implement the already agreed registered-account renewal, simplified first-use guest notice, returning-guest renewal and guest-accessible settings using the shared writer and choice component. This is deliberately not part of the STG or PRD notice release. Preserve the resolved participant/persona, existing auth precedence and per-bot disclaimer. Save acknowledgement and both choices before allowing chat content operations; enforce this on direct requests as well as in the UI. Cancel must exit without a message/model call. Both refusals, reload/relaunch, embedded entry and settings changes must retain the same participant and persisted choices. Follow the existing foundation → synchronization → companion dependency; do not merge the broader DPO branches or duplicate their migrations.
4. **Finish public explanations and notice verification — core/docs owner, Stage 1 for capture, Stage 3 for the guest-availability claim.** Keep the approved policy text, locale-correct links and concise group-only LA explanation. The current EN/DE student pages say guests already receive choices before their first message; make that availability statement accurate for the release containing the pages, and publish the present-tense claim only with the working companion (Stage 3). Do not change the DPO policy to hide an unfinished feature. Capture normal creation, assessment creation/first entry, PWA renewal, profile settings, registered chat and guest onboarding/settings in relevant DE/EN desktop/mobile states. Verify keyboard use, simultaneous open sections, default choices, failure/retry feedback, safe return and public help/policy access. Reuse unchanged valid behavior evidence; screenshots alone do not prove persistence. Update both PR descriptions with exact scope and remaining dependencies.

#### Completion evidence for this follow-up

| Boundary | Required evidence before marking complete |
| --- | --- |
| Normal, LTI/Edu-ID and assessment entry | Correct notice for the trusted context; explicit acknowledgement and LA choice; either optional refusal accepted; reload/API read confirms values, version and timestamps. Assessment uses its intentionally separate account. |
| Existing users and profile settings | Missing/stale acknowledgement or incomplete choice metadata prompts completion; recorded refusals survive renewal; settings update each purpose independently; stale/uncertain writes cannot overwrite a newer decision. |
| Registered and guest chat | Same participant across entry, renewal and settings; direct content requests blocked before completion; first-use/cancel/relaunch exercised; account and bot acknowledgements remain independent. |
| Copy and presentation | Accepted-change document comparison retained as review evidence; DE/EN meaning, design-system interactions and responsive captures reviewed; every surface captured both in its untouched default state and with all disclosure sections expanded. No maintained tests pin prose or screenshot contents. |
| Delivery | Core and companion retain their respective bases and shared contract; required checks pass on the delivered heads; actual review results and visual limitations recorded. A pending review is not a pass. |

**Terminal condition:** notices, acknowledgement, canonical persistence, settings and public information are implemented and verified in their scoped PRs, with the companion's integration dependency explicit. Report core completion separately if chat is still waiting for foundation synchronization. This terminal condition does not include target merges, deployment or completion of the deferred DPO roadmap. The next implementation action is core target integration and focused notice verification; this planning amendment itself performs neither.

#### Review findings outside the immediate implementation

- **LA deletion/collection:** the source currently queues a withdrawal but has no verified deletion consumer. Existing Python/read containment is preserved. Collector changes, withdrawal workers, reconciliation tooling, live cleanup, activation and computations are outside this follow-up. Before deployment, separately prove effective inactivity and resolve any retained derivatives so the policy promise is true. A saved preference or queued withdrawal is not evidence of completed deletion. This gate does not prevent completing the notices source package.
- **Assessment retention:** normal and assessment accounts are intentionally separate, as confirmed by the user on 20 September. The cross-mode reuse/deletion concern is not an implementation requirement for this package. Verify the existing assessment-mode deletion restriction with the separate assessment fixture; retain the approved notice without adding retention machinery.
- **Later features:** research/assessment exports, KB confirmations, LA products and gamification changes remain in the deferred packages below. The document review creates no new authority to implement or activate them.

### Verified baseline — 19 September 2026

| Item                  | Verified state                                                                                                                        | Consequence                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Core PR               | [#5970](https://github.com/uzh-bf/klicker-uzh/pull/5970), open, non-draft, base `v3`, head `553fce6793c7f2153f49cabfad52cda9fc09fb91` | Preserve current PR state; audit the complete diff, not only new changes.                         |
| Task checkout         | `trees/rs-dpo-release-stack`, branch `rs/dpo-release-1-disclaimers`                                                                   | Reuse for core source and this plan.                                                              |
| Target                | `origin/v3` at `b15ac7434e9a427ff00d3b2868ef4821fd0d1bb7`; task is 26 ahead and 4 behind                                              | Refresh and deliberately integrate the resolved target before final proof.                        |
| AI target             | `origin/v3-ai` at `fde799a07884e2dd05a234c974f52cb4eb858168`                                                                          | Chat implementation must use this branch's current auth/guest contracts.                          |
| Existing broader work | Core PR #5819 and AI PR #5825 have preserved worktrees                                                                                | Reuse reviewed ideas selectively; do not ship deferred features through wholesale merges.         |
| Checks                | Previous head had passing required checks; final external AI review remained incomplete after provider failure                        | Reuse unchanged local proof only where applicable; obtain new exact-head CI after source changes. |

The dirty devcontainer/devrouter files, `packages/prisma-data/package.json`, `turbo.json`, and untracked `packages/prisma-data/src/scripts/local-eduid-link.ts` are separate local Edu-ID work. Exclude them from this package. Preserve the primary checkout's branch and other worktrees. This planning task neither starts nor stops a runtime.

## Scope and branch placement

| Required for this release                                            | Owner / target                             | Explicit completion boundary                                                                              |
| -------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Normal signup, assessment entry, PWA policy renewal, profile choices | Core / `v3`, PR #5970                      | Existing screens, server enforcement, persistence and recovery verified.                                  |
| Shared consent state, version, revision and audit contract           | Core / `v3`, PR #5970                      | One canonical writer; explicit false counts as completed; no parallel chat schema.                        |
| Website privacy policy and student LA explanations                   | Core / `v3`, PR #5970                      | Final German source and English meaning reviewed; public explanation accessible before acceptance.        |
| Registered chat renewal and guest onboarding/settings                | Chat / focused `v3-ai` companion           | No content submission or model use before account-level completion; both refusals permit use.             |
| Deployment prerequisite, outside the current notices implementation | Release owner                             | Preserve source containment; prove live optional-processing containment and any required retained-LA reconciliation before deployment. |

### Deferred packages, preserved for continuation

1. **KB confirmations:** upload/import/replacement and audience-change confirmation, direct API enforcement and ingestion proof. Resume against the already improved KB implementation after this release.
2. **Research and assessment exports:** permission checks, purpose eligibility, download behavior and audit evidence. No new exporter is required to save choices.
3. **LA product:** course activation, eligible computation, group-only reports, withdrawal processing/recomputation and operational monitoring. Minimal containment in this release is a prerequisite, not completion of this package.
4. **Retained points and group semantics:** retain previously settled behavior; gamification group averages include all members. Do not interpret LA opt-out as a change to gamification or course access.

No unrelated OAuth mocks, auth refactoring, new retention duration, analytics activation UI, provider migration, or infrastructure redesign belongs in the first release.

## Binding behavior

### Account and consent primitives

The existing `Participant` is the subject of the choices. Reuse its research/LA values, choice metadata, current disclosure acknowledgement, revision and append-only `ParticipantDataUseEvent`. Database Boolean defaults alone are not evidence of a recorded decision. An explicit `false` with complete metadata is a completed choice.

Research initially displays allowed for a new or unanswered account, with a visible state and an accessible opt-out. LA starts unanswered and requires an explicit yes/no. Submission requires an unchecked mandatory acknowledgement. Never silently persist the research default on page load, expand/collapse, authentication, or guest creation. Save acknowledgement and both choices atomically through the shared writer.

On policy renewal, retain recorded choices and choice timestamps unless the participant changes a value. Never silently turn a refusal into permission. Profile changes to a purpose do not implicitly renew policy acknowledgement. A stale revision or uncertain write must reload canonical state and require renewed acknowledgement where appropriate rather than overwrite another tab's changes. A retry after a successful write must remain safe.

Select one coordinated disclosure revision for the release. The currently implemented identifier is `2026-09-08`; it identifies disclosure semantics, not the website publication date. During copy reconciliation, decide whether the newly introduced guest presentation adds a material disclosure change requiring a bump. PWA, chat and server must agree on the accepted revision and completion predicate. Avoid different contracts under one identifier and avoid an unnecessary second renewal during the same rollout.

### Surface contracts

| Surface                                      | Required presentation                                                                                                                                   | Required behavior                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Normal signup, including Edu-ID continuation | Existing concise approved normal disclosure; data categories retained; independent choices                                                              | Required acknowledgement; both refusals still create a usable account.                                                          |
| Assessment account creation/entry            | Same collapsible structure, with assessment identity, responses/results, audit logs, authorized lecturer access and account/data retention restrictions | Correct assessment variant from trusted context; refusal does not block assessment; self-deletion restrictions remain enforced. |
| Existing PWA account                         | Mandatory completion/renewal route; saved choices retained                                                                                              | Return safely to the intended route after success; no redirect loop through privacy/help/logout.                                |
| Registered chat account                      | Mandatory account-policy completion in the chat entry flow                                                                                              | Preserve resolved identity and requested bot/thread; completion must not trigger guest fallback.                                |
| First-time chat guest                        | Short guest-account notice, privacy link, independent choices, unchecked acknowledgement, start/cancel actions                                          | Persist choices on the resolved guest participant before chat use; cancel causes no chat message/model call.                    |
| Returning chat guest                         | Renew only when version or choice metadata is incomplete                                                                                                | Reuse existing persona and choices; do not recreate a guest to evade the gate.                                                  |
| Settings                                     | Saved research and LA values, relevant consequences and links                                                                                           | PWA profile and guest-accessible chat settings write the same canonical record with revision protection.                        |

PWA's current completion page satisfies the blocking renewal requirement; do not replace it with a modal only to match the conversational word “popup.” Chat may use an in-app dialog/screen, with accessible focus handling and no dismiss-to-chat bypass. A forced completion surface must retain a meaningful cancel/exit path.

### Guest copy and identity

Use a short German introduction, translated equivalently into English:

> **Chat als Gast nutzen**
>
> Für diesen Chat wird ein Gastkonto angelegt. Du musst keinen Namen und keine E-Mail-Adresse angeben. Deine Chatnachrichten und die für den Betrieb erforderlichen Nutzungsdaten werden gespeichert und deinem Gastkonto zugeordnet.
>
> Du kannst unabhängig entscheiden, ob deine Daten für Forschung und Learning Analytics verwendet werden dürfen.

Follow this with the shared purpose choices, a linked privacy-policy acknowledgement and **Chat starten** / **Abbrechen**. Reuse approved research and LA wording; this introduction supplements the supplied account text where the guest workflow differs. Do not describe guests as anonymous or promise that messages cannot contain personal information. Do not add a new terms-acceptance requirement accidentally while adapting the guest form.

The current LTI guest key is derived from the launch subject and course. The same subject/course reuses a persona; another course can have another participant record. Choices therefore apply to that guest persona. Do not promise cross-course synchronization or link guests to registered accounts in this package.

A minimal guest identity/participation record may already exist when LTI launch completes. Explain this honestly; do not rewrite authentication to defer identity creation. Before acknowledgement, allow only operations needed to resolve identity, present/save choices, view policy/help, or exit. Block new messages, attachments, content processing, model calls and optional-purpose processing. Token expiry is not a retention policy and does not prove deletion of a guest account or chat history.

### Authentication and chatbot disclaimer composition

Keep authentication, account completeness, bot/course authorization, and bot-specific disclaimer as separate checks. In particular, do not fold consent completeness into `isActiveAccountParticipant` or another predicate that resolves missing/invalid identity and can fall back to a guest. Preserve session → linked account → guest launch precedence and existing runtime token precedence.

Registered and guest chat requests use a structured completion-required response after identity validation. The client preserves the intended destination and opens the appropriate completion surface. Unknown/expired identity follows existing authentication failure handling; it must not become a consent bypass or silently switch participant.

The existing `ChatUsageCredits.acceptedDisclaimerId` and `acceptedDisclaimerAt` remain the per-chatbot disclosure record. Completing account policy does not accept the bot disclaimer, and accepting the bot disclaimer does not complete account policy. Compose the sequence as identity/access resolution → account completion → bot-specific disclaimer → chat use. A changed bot disclaimer independently prompts again.

Ordinary anonymous live-quiz participation and its temporary participants are not the persisted chat-guest use case. Preserve their existing behavior. `Participation.isActive` remains a leaderboard flag, never a substitute for consent or access authorization.

### Processing and deletion truthfulness

This section records the deployment prerequisite, not additional work in the current notices package. The reviewed policy describes LA as separately enabled and automatically deleted when deactivated. Current source blocks Python analytics imports and the four optional GraphQL analytics reads, but `ParticipantAnalyticsWithdrawal` has no verified consumer and live containment is unproven. A first recorded false for a legacy account may create no withdrawal if the old Boolean was already false.

The release must therefore keep deferred LA processing inactive and prevent access to disallowed derivatives. Inventory collectors, scheduled/pending jobs, recomputation, read/export paths and any optional chat telemetry. The first-release default is whole-path LA containment, not selective activation for opted-in participants. Stop or effectively block scheduled, queued, running and directly invoked derivation, and contain derivative reads/exports. Use an existing suitable switch if one exists; otherwise implement the smallest explicit containment. Findings requiring selective activation or a broader analytics implementation require a plan amendment before that work. `Course.areAnalyticsValid` is cache validity, not course LA activation. Do not repurpose it.

Preserve operational responses, scoring, assessment audit logs and chat history needed to provide the requested service. Do not equate them automatically with optional LA derivatives. Do not activate new research processing or telemetry by saving preferences. Any already active research-use path must respect recorded eligibility or remain contained until its later implementation.

Before release, determine whether retained derived LA data or pending withdrawals exist using authorized, values-free evidence. If they exist, prepare an idempotent, scoped reconciliation/cleanup with a dry-run and clear source/derived boundaries. Legacy first refusals must be covered. Actual retained-data deletion requires a separate named approval with target, backup/recovery limits and affected data classes. Disabling reads alone is not proof of deletion; a queued request is not completed deletion. The launch prerequisite is proof that writers are blocked, in-flight work cannot recreate derivatives, required scoped reconciliation/deletion is completed, and reads remain contained. Apply this before exposing the new choices and policy promises. If this cannot be resolved, report a release blocker instead of making the policy or UI promise untrue.

## Shared implementation seam

Include the following preparation on `v3` before merging the foundation; chat consumes it after normal synchronization. These are proposed edits, not claims that the files already exist.

| Seam                            | Concrete implementation boundary                                                                                                                                                                                                       | Contract                                                                                                                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical writer                | Keep implementation in `packages/graphql/src/services/participantAccountDataUse.ts`; narrow its context parameter to the existing Prisma client and verified user `sub`/`role` fields it actually uses                                 | GraphQL passes its existing context; chat constructs that small context only after validating its participant identity. Keep role validation, transaction, revisions, timestamps and errors in one implementation.                                 |
| Server-only package entry       | Add `packages/graphql/src/participant-data-use.ts` as a narrow re-export; extend existing `packages/graphql/rollup.config.js` in both normal and instrumented-test entry lists to emit `dist/participant-data-use.js` and declarations | Chat imports this server entry only; do not pull the GraphQL schema or Prisma into browser code and do not add a new package/dependency. Verify emitted path and transitive imports.                                                               |
| Shared choice presentation      | Move the reusable choice view to `packages/shared-components/src/participant/ParticipantDataUseChoices.tsx`; keep PWA `ParticipantDataDisclosure.tsx` as its normal/assessment composition                                             | The moved view remains browser-only and uses existing design-system controls and shared translations. PWA and chat are the two concrete callers. Avoid a generic consent-form framework.                                                           |
| Chat transport                  | New `apps/chat/src/app/api/chatbots/[chatbotId]/data-use/route.ts`                                                                                                                                                                     | GET reads canonical state; POST completes acknowledgement and choices; PATCH changes one recorded purpose. Existing verified participant/bot access and origin protections apply even before completion. No request accepts a participant ID.      |
| Chat composition                | New `apps/chat/src/components/ParticipantDataUseGate.tsx`, integrated into existing `assistant.tsx`                                                                                                                                    | One normal/guest presentation and settings mode; use the shared choice view and existing request helper. Keep bot-specific disclosure separate. Extend existing `apiGuards.ts`, without altering identity resolution, to apply account completion. |
| Conditional reconciliation tool | Only if inventory proves no existing tool can satisfy retained-data cleanup: `packages/prisma-data/src/scripts/reconcile-participant-analytics-withdrawals.ts`                                                                         | Dry-run by default; explicit scoped execution, idempotency, derivative-only allowlist, no output containing participant content. Exact table inventory and live execution authority must be resolved before implementing destructive mode.         |

The transport returns the canonical purpose values and metadata, acknowledgement version/time, revision, current required version and completion status. POST accepts the existing completion input (`expectedRevision`, `disclosureVersion`, two Booleans, `acknowledged: true`). PATCH accepts one purpose, its Boolean value, disclosure version and expected revision using the existing choice-update semantics; it never renews acknowledgement.

Map existing domain error codes without changing their meaning: invalid input → HTTP 400, stale revision → 409, completion required → 403, lock timeout → 503 with recoverable UI, forbidden → 403; expired/missing authentication retains the current 401 behavior. Do not convert database/transport errors into success or default consent values. GET and successful writes return current canonical state; on conflict or uncertain response the client rereads it. Version mismatch uses the existing invalid-input response and refreshes required-version metadata before resubmission.

The new completion route bypasses only the account-completion check, never identity or bot/course authorization. Existing content routes remain protected: `chat`, `practice/submit`, `knowledge-graph`, thread/message/attachment/feedback/title operations and bootstrap reads must be classified explicitly. Do not gate unrelated lecturer preview/manage routes through participant logic. Public policy/help are accessible without loading protected history.

## Delegation map and stop conditions

Current planning uses standard mode because the exact main-model identifier is not established. The native `planner` owns read-only plan hardening. Resolve the active execution mode again when implementation begins; the following assignments avoid duplicate ownership and require no new user-visible tasks.

| Slice                                              | Assigned owner                                                            | Dependency / boundary                                                                                                     | Stop condition                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Package 0 and shared server seam                   | Main                                                                      | Auth/data decisions are tightly coupled to existing source; no external dispatch of private documents                     | Inventory or public-contract change exceeds this plan: report the concrete amendment before dependent work.          |
| Core UI and docs in Package 1                      | Native `executor`, bounded write set assigned after Package 0             | Only approved copy/behavior and public synthetic artifacts; main owns original private documents and final reconciliation | Shared contract unresolved; continue unrelated copy review locally.                                                  |
| Core containment in Package 2                      | Main                                                                      | Requires classified operational-versus-derived data boundaries                                                            | Live access or destructive reconciliation lacks named authority; complete dry-run/source work first.                 |
| Chat seam and AI-specific containment in Package 3 | Main                                                                      | Requires foundation availability through authorized target integration; authentication coupling justifies local ownership | Wait for foundation integration; continue independent core/doc work. No duplicate schema or workaround branch merge. |
| Package 4                                          | Main, with configured simplifier/reviewer roles at their applicable gates | Integrated source and available verification environment                                                                  | Preserve exact head and report missing browser/provider/CI capability; passing unrelated checks cannot replace it.   |

The executor is a native bounded subagent, not a new peer task. If its provider cannot receive the required context within the repository privacy boundary, keep that work in main and record the reason. Main must still verify its output. The reviewed plan is not a command to dispatch all roles at once.

## Implementation packages

### Package 0 — Reconcile source, copy and release inventory

**Owner:** main. **Dependencies:** none. **Acceptance:** an exact-head inventory identifies what already works, remaining changes, active optional-processing paths and unresolved release evidence.

- Fetch remote state; reconfirm PR bases, protected branches, task dirt and ownership. Integrate current `v3` into the core task branch once needed for readiness, with a normal merge and explicit source SHA. Preserve unrelated work.
- Review PR #5970's complete range against this plan. Reuse passing behavior coverage; do not recreate the implementation or pull in broad PR #5819/#5825 changes.
- Compare the German disclosures and policy with the supplied DOCX files using accepted tracked changes. Review English for equivalent meaning. Keep documents and extracted private originals outside public Git history. Do not test prose using exact-string snapshots.
- Resolve the common disclosure revision, policy URLs and rollout compatibility. Inventory live configuration only within authorized systems; no cluster connectivity or production content discovery is implied.
- Record current collectors, eligibility checks, derivative stores, read paths and withdrawal processing. Unknown live activation remains unknown until verified.

### Package 1 — Finish the shared foundation and student information

**Owner:** core. **Target:** PR #5970 / `v3`. **Acceptance:** all core journeys work with durable choices, accurate notices and public explanations; migration and API compatibility are reviewed.

Primary files are `apps/frontend-pwa/src/components/participant/{ParticipantDataDisclosure,DataUseSettings}.tsx`, `packages/shared-components/src/participant/ParticipantDataUseChoices.tsx`, the existing signup/profile and `pages/account/data-use.tsx` routes, `packages/util/src/participantAccountDataUse.ts`, `packages/graphql/src/services/participantAccountDataUse.ts`, and `packages/graphql/src/lib/participantAccountGate.ts`.

- Close verified defects in normal/assessment signup, renewal and profile settings with the smallest changes. Keep design-system buttons and independent collapsibles with whole-row triggers. Research starts collapsed; show its choice without requiring expansion. All sections can remain open together.
- Recheck the existing schema/migration rather than add another consent model. Review Prisma-generated provenance, schema equivalence, custom SQL necessity and immutable-audit/cascade semantics. Add a migration only if a demonstrated schema gap requires one; use the repository's generated migration workflow.
- Reuse the atomic writer and revision contract. Expose only the smallest server-side reusable boundary required by chat; do not create parallel mutation variants or duplicate locking/audit transactions.
- Review `apps/docs/docs/datenschutz.mdx`, `apps/docs/docs/privacy_policy.mdx`, and the LA use-case content in `apps/docs/src/constants.tsx`. Replace/remove the individual-student performance-table illustration and claims, preserving useful group-level examples. Any replacement uses synthetic group data.
- Provide a direct, locale-correct LA explanation link available before acceptance. Explain what the choice covers, group-level presentation, where it can be changed, and current availability honestly. Privacy and LA information must not depend on completing the gate they explain.

### Package 2 — Enforce minimal optional-processing containment

**Scheduling:** outside the current notice-only follow-up. Preserve completed source containment. The remaining operational work below is a separate deployment prerequisite; do not begin new collector, withdrawal or cleanup implementation as part of notice completion.

**Owner:** core, coordinated with chat for AI-specific paths. **Target:** respective existing branch owners. **Dependencies:** Package 0 inventory. **Acceptance:** no inventoried optional writer/read path violates recorded choices or deferred activation; required retained-derivative reconciliation is complete and pending/in-flight work cannot recreate it.

- Cover `apps/analytics/src/modules/participant_analytics/get_participant_responses.py`, relevant scheduling/recomputation entry points, `packages/graphql/src/services/analytics.ts` and their GraphQL reads. Preserve operational data flows and gamification.
- Disable the whole deferred LA path at its effective boundaries; do not add selective LA activation in this release. Test direct invocation and reads, not just hidden UI. Handle queued work without introducing a new analytics platform.
- Reconcile pending withdrawal records and legacy first-false cases in the release inventory. Prepare minimal cleanup tooling only if existing mechanisms cannot satisfy the required disposition. Keep real-data execution separately authorized.
- Measure the shared LA advisory-lock behavior for synthetic existing-user renewal and LA-settings changes. Initial signup avoids this lock and must remain independent. The existing five-second timeout must fail atomically with recoverable UI. Change lock granularity only if evidence shows a real onboarding problem; independently review any locking change.
- Document deploy-time containment settings, rollback behavior and evidence required to prove them. Do not infer live containment from source flags alone.

### Package 3 — Add registered and guest chat completion

**Owner:** chat. **Target:** focused companion on `v3-ai`. **Dependencies:** stable shared contract from Package 1; production delivery follows foundation integration. **Acceptance:** registered and guest browser/API journeys persist the same records and enforce both independent disclosure layers.

Primary seams on `v3-ai` are `apps/chat/src/lib/server/apiGuards.ts`, `apps/chat/src/lib/server/ltiGuest.ts`, the chat request routes, `apps/chat/src/components/assistant.tsx`, and `apps/chat/src/services/disclaimers.ts`. The guest identity module should need little or no change; it is evidence for persona scope, not a refactoring target.

- Add authenticated status/completion/settings transport using the shared canonical service. Derive participant identity from verified server context; never trust a submitted participant ID. Preserve existing origin, scope and bot/course protections, including embedded usage.
- Add the account-completion guard to every content-use entry point identified by inventory, including attachments and alternate message/thread routes. Allow only narrowly required completion/help/exit operations before acknowledgement. Recheck current persisted state on requests, not only a cached token claim.
- Reuse common choice components through an existing shared package where both apps need them. Extract only browser-safe presentation; keep Prisma and server functions out of client bundles. Do not copy independent form or persistence implementations.
- Show the registered-user renewal and simplified guest notice. Preserve bot/thread/return destination safely. Keep pending requests from automatically sending on acknowledgement unless the user explicitly resumes sending.
- Provide chat-accessible guest settings with canonical values, revision handling and relevant withdrawal consequences. Reuse this entry point for registered chat users if it avoids unnecessary navigation without expanding scope.
- Preserve and compose the bot-specific disclaimer. Verify all combinations: account missing only, bot disclaimer missing only, both missing, both current, and either changing later.

### Package 4 — Integrated proof and release preparation

**Owner:** main. **Dependencies:** Packages 1 and 3 for notice-source completion; Package 2 evidence and any required retained-data reconciliation additionally gate deployment. **Acceptance:** reviewed PRs, exact-head checks, browser evidence, compatible branch sequence and a truthful release checklist distinguishing source completion from deployment readiness.

- Run the feature-wide tests below in the repository's required runtime. Use synthetic local identity fixtures; do not alter production OAuth/authentication for test convenience. Host Git/forge commands and host Playwright retain their repository boundaries.
- Capture actual DE/EN desktop/mobile screenshots and interaction evidence for normal signup, assessment entry, existing-user renewal, profile choices, registered chat, guest onboarding/settings and student LA information. Record current source SHA, route, viewport and fixture provenance; publish permitted synthetic evidence through the project forge workflow.
- Perform simplification and final review under the active execution-mode rules. Resolve ordinary review feedback before final AI review; a provider failure is a pending gate, never a successful review.
- Update whole-branch PR descriptions with scope, migration/rollout consequences, screenshots, tests and remaining release gates. Preserve #5970's current non-draft state; any new companion starts draft. Do not request human reviewers automatically.
- Record completed and deferred work in this plan. Supply the exact merge/deployment/cleanup sequence for separate authorization when code and evidence are ready. Do not declare deployment complete from source or CI alone.

## Branch and rollout sequence

Keep core and AI ownership separate. Native GitHub stacks are supported, but a `v3` foundation and a `v3-ai` consumer are not a native parent/child stack simply because the consumer depends on the foundation. This plan changes no stack topology. Use a cross-PR dependency until the established `v3` → `v3-ai` synchronization carries the shared contract.

1. Finish and verify PR #5970 against fresh `v3`. Prepare the focused chat change against current `v3-ai` with its dependency explicit. If shared code is unavailable there, limit preparation to contract/design work until authorized foundation integration; do not duplicate migrations or combine the broad DPO branches into a verification branch.
2. After separately authorized merge of the verified core head, synchronize `v3` into `v3-ai` by the repository's normal merge convention. This target-branch push needs named authority. Follow the repository's integration-PR exception for substantive conflicts.
3. Refresh the chat task branch from the integrated `v3-ai`, complete browser/API proof and exact-head CI, and merge only with separate authorization. Verify shared schema, version, defaults and writer are identical.
4. Prepare ordered deployment: compatible database foundation; verified optional-processing containment and required retained-data reconciliation; then reachable updated policy/docs and core API/PWA/chat gates. Containment must precede exposure of the new promises and choices. If deployment is staggered, old chat must be contained or held back from user traffic until it can enforce the shared choices. Do not announce end-to-end completion during the gap.
5. Promotion beyond `v3-ai` follows `v3-ai` → `v3-audit` through the required integration PR and exact-head checks. Any deployment, live cleanup or branch promotion requires its own approved targets and effects.

A rollback must not erase saved choices, acknowledgement history or audit events. Preserve additive schema and containment while reverting incompatible UI/server changes. Review mixed-version behavior and migration rollback limitations before production approval; never regain availability by silently bypassing completion.

## Feature-wide acceptance portfolio

Use behavior and structured protocol assertions. Do not pin translations, prose, screenshot hashes or demonstration records. Reuse existing tests when they already observe the invariant.

| Boundary                | Required cases                                                                                                                                                                                                       | Primary evidence                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Atomic persistence      | Both false; each independent combination; initially unanswered LA; metadata completeness; stale revision; duplicate retry; event failure rollback; acknowledgement renewal preserving unchanged choice timestamps    | Existing `participantAccountDataUse.integration.test.ts` and `participantDataUse.integration.test.ts`, extended only for gaps |
| Core admission          | Existing token becomes incomplete after version change; direct API bypass denied; allowed completion/help/logout; both refusals permitted; ordinary temporary live-quiz behavior preserved                           | Existing GraphQL gate and subscription tests plus focused regressions                                                         |
| Normal/assessment UX    | Signup, trusted assessment variant, first login, reload, keyboard, multi-open sections, collapsed research, two-tab conflict/uncertain response, safe return path, assessment deletion restriction                   | Existing `playwright/tests/A-login.spec.ts`, assessment deletion tests and browser walkthrough                                |
| Chat admission          | Registered versus guest identity retained; no consent-driven fallback; direct message/attachment routes denied before completion; expired/scoped tokens; embedded origin/session behavior; both refusals permit chat | Existing chat guard/LTI/embed tests plus minimal completion regressions and real browser paths                                |
| Guest lifecycle         | First launch, cancel, same-persona return, different course persona, renewal, guest settings, persisted refusal after reload and relaunch                                                                            | Synthetic LTI/browser fixture; canonical database/API assertions without outputting tokens                                    |
| Two disclaimer layers   | Account only/bot only/both required; neither accepts the other; changed account version and changed bot disclaimer each prompt independently                                                                         | Chat service tests and browser sequence                                                                                       |
| Optional processing     | Python/GraphQL containment implemented; regression tests added; live state unknown                                                                                                                                   | Verify source in the runtime, then obtain scoped deployment/data inventory evidence.                                          |
| Shared release contract | Migration upgrade from pre-feature state; schema equivalence; common version and false semantics; PWA settings reflected in chat and vice versa; mixed-version rollout behavior                                      | Disposable database upgrade and integrated cross-app verification after target synchronization                                |
| Student information     | Public links before acknowledgement, DE/EN meaning, group-only examples, usable small-screen and keyboard presentation                                                                                               | Human copy review and browser captures; no exact-copy unit tests                                                              |

### Frozen test dispositions

The matrix above defines cases; this table defines the maintained test changes. New paths are proposals. Do not create additional suites merely to match implementation modules; amend this portfolio only for a demonstrated uncovered behavior.

| Risk                                                                 | Disposition                                                                                                                                     | Exact location                                                                                               |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Shared persistence, revision and audit                               | Extend existing only for the reduced server context/second caller                                                                               | `packages/graphql/test/participantAccountDataUse.integration.test.ts`                                        |
| Advisory lock, withdrawal and contention                             | Extend existing                                                                                                                                 | `packages/graphql/test/participantDataUse.integration.test.ts`                                               |
| Normal/assessment onboarding and settings                            | Extend existing for uncovered flows; reuse current passing cases                                                                                | `playwright/tests/A-login.spec.ts`; `packages/graphql/test/assessmentAccountDeletion.test.ts`                |
| Chat status/write transport, direct bypass and two disclosure layers | Add new, one integrated behavior suite                                                                                                          | `apps/chat/test/participant-data-use.integration.test.ts`                                                    |
| Identity precedence and guest-persona reuse                          | Extend existing only where the new guard affects behavior                                                                                       | `apps/chat/test/lti-guest.test.ts`; `apps/chat/test/pwa-embed.test.ts`; `apps/chat/test/authedFetch.test.ts` |
| Registered/guest UI, settings and relaunch                           | Extend existing                                                                                                                                 | `playwright/tests/Y-chat.spec.ts`                                                                            |
| Contained derivative reads and reconciliation outcomes               | Extend existing consent integration suite using minimal synthetic derivatives; add cleanup cases there only if tool is required                 | `packages/graphql/test/participantDataUse.integration.test.ts`                                               |
| Whole-path collector inactivity                                      | None: bounded executable verification of disabled entry points, scheduler/queue disposition and no post-containment synthetic derivative writes | Package 2 evidence; no new Python test framework                                                             |
| Migration and mixed-version upgrade                                  | None: existing disposable-database migration procedure and integrated browser/API checks                                                        | Package 4 evidence, recorded with exact revisions                                                            |
| Policy wording, translations, illustrations and layout               | None: final-document comparison, browser interactions and screenshots                                                                           | Review evidence only; no prose-pinning assertions                                                            |

Use a bounded synthetic cohort of 20 existing participants with five concurrent renewal/settings requests, then one deliberate advisory-lock hold beyond the configured five-second lock timeout. Require no deadlock, duplicate event, lost update, partial transaction or unhandled client state; every uncontended request completes and every timed-out request remains unchanged and succeeds after lock release and explicit retry. Record latency without claiming production capacity. Verify initial signup and research-only settings do not wait for the global lock. Expand this exercise only for an observed failure or a separately established production load requirement.

## Decisions and release gates

| Item                       | Default / disposition                                                                                 | When it blocks                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Guest policy and choices   | Agreed: persisted guests receive simplified notice and both choices                                   | Binding implementation requirement, not a new legal question to ask again.    |
| Guest retention            | No new duration inferred; account persistence and cookie expiry distinguished                         | Any new promise or cleanup policy requires a verified policy decision.        |
| Disclosure revision        | Reconcile material copy changes and select one common revision                                        | Before implementing version checks or publishing final copy.                  |
| Existing LA operation/data | Verify activation and retained derivatives; keep deferred processing contained                        | End-to-end release readiness until evidence and disposition exist.            |
| Retained-data deletion     | Prepare concrete dry-run/target/data-class scope if required                                          | Execution requires named authority; do independent source work meanwhile.     |
| Final review provider      | Last recorded attempt failed before reviewing due to provider limit                                   | Final-review gate remains pending until a permitted route actually completes. |
| Merge and deployment       | Exact PR heads, dependency sequence, policy availability, containment and rollback must be reviewable | Never inferred from approval of this planning document.                       |

## Progress and continuation

| Package                      | Status on 20 September (superseding the 19 September view)                                                        | Next concrete action                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Planning                     | Complete: planner approved; narrowed follow-up recorded; this sequencing update folds in the merged state         | Execute Stage 1 below.                                                                      |
| Core notices/persistence     | Merged: `v3` squash `d3ab5f1c04`; `v3-ai` merge `4be34ed26d`; `v3-audit` merge `ddfa6ee4d7`                      | Land audit CI fix #6211, then promote and test on STG.                                       |
| Optional processing          | Python/GraphQL containment merged; live state unproven                                                            | Prove live containment and any retained-LA reconciliation before exposure (Stage 1 gate).   |
| Chat                         | Not implemented; deferred to Stage 3                                                                              | Implement after the PRD release, against current `v3-ai` contracts.                         |
| Documentation                | Bilingual student pages, policy and group-only examples merged with the layer                                     | Verify rendering and links on STG; hold the guest present-tense claim until Stage 3.        |
| Release                      | Source merged and synchronized; not yet promoted or deployed                                                       | Stage 1 promote to STG, Stage 2 release to PRD, then Stage 3.                                |

The user subsequently authorized working through the full plan with a goal, and on 20 September set the release order: **STG first, then PRD, then the next steps.** The core layer is merged, so the goal's immediate terminal condition is now the STG/PRD rollout of the notices layer, with the deferred packages resuming as Stage 3. Each stage keeps its own named-authority gate. Stop only the dependent branch when an external capability or separately gated action blocks it, and preserve exact source/evidence for continuation. Do not advance into Stage 3 merely because the notice release has shipped.

### Execution checkpoint — 19 September 2026

- Integrated `origin/v3` at `03cfbd6f21602bf2bc7e7df1dd8d324b6d789c2c` into the task branch with normal merge `0a950d4bef79ba1aa90daf2201f4c8688be1de64`. No target branch was pushed. Current `v3-ai` baseline observed: `e752c70db39e0120fd2f47d8e7d3e98180e373af`.
- Shared server seam implemented in the working tree: narrow verified identity/Prisma context, separate server build entry, shared browser choice component with explicit assessment context. Registered and guest chat implementation still waits for the approved foundation-integration dependency.
- DE/EN student help pages are `/lernanalyse` and `/learning_analytics`; consent links now point there. Removed the lecturer example containing individual student rows. Existing normal/assessment DOCX wording was compared with accepted tracked changes; no substantive wording change was needed. Policy paragraph comparison found formatting differences and the existing correction of the source typo `verwendete` to `verwendet`.
- Keep disclosure revision `2026-09-08`: this package preserves the same purpose/retention contract; guest presentation explains the existing persisted persona rather than introducing a new purpose. Any later material change to that contract requires a coordinated version bump.
- Containment source now rejects Python analytics package import and returns no data from the four optional GraphQL analytics reads. A host-side dependency-free import check confirmed rejection before database initialization. Source containment is not live containment; old processes, notebooks and in-flight jobs still require separately authorized operational verification and stop/cleanup effects.
- Added behavior tests for the standalone canonical service, denied derivative reads and a 20-account/five-concurrent completion/settings cohort. Existing timeout/retry tests remain. Container tests/builds and browser proof have not run for these changes.
- Native docs executor completed the bounded three-file change. Main inspected its diff, linked the pages and visually inspected the existing illustrations. Retained the course-level activity chart; removed the quiz screenshot as well because its feedback panel exposes a one-person result (`N = 1`). No private source documents were sent to the executor.
- Runtime diagnosis: Devrouter 0.0.77 rejects installed Devsy 1.19.0, requesting 1.16.2; `ensure` retained its recovery candidate. `doctor` reports this exact checkout's full profile stopped. The requested shared-tool compatibility repair is pending user authorization; no downgrade, lifecycle-lock bypass or runtime deletion was performed.
- Four pre-existing additive migrations remain in #5970 (foundation, two indices, withdrawal queue). Do not rewrite potentially applied history without verifying provenance/application state. The migration-count/provenance check remains open until the disposable runtime is available.

#### Release inventory to finish before activation

The Python `src` import boundary covers the eight initialization scripts and maintained notebooks that import `src.modules`. The derivative model set is `ParticipantAnalytics` (with `CompetencyAnalytics`), `AggregatedAnalytics` (with `AggregatedCompetencyAnalytics`), `ParticipantCourseAnalytics`, `AggregatedCourseAnalytics`, `ParticipantPerformance`, `InstancePerformance`, `ActivityPerformance`, `ParticipantActivityPerformance`, and `ActivityProgress`. These are distinct from operational `QuestionResponse`, `QuestionResponseDetail`, points, assessment records and `ChatMessage`.

The four GraphQL read services are `getCourseActivityAnalytics`, `getCourseWeeklyActivity`, `getCoursePerformanceAnalytics`, and `getActivityAnalytics`; all now short-circuit before reading derivatives. A reviewed source allowlist is not authority to delete those tables. Required remaining evidence is values-free counts and runtime/job status in the named deployment; classify any additional writer/read path before release. If records require reconciliation, prepare the scoped dry-run and obtain named execution approval; first-false legacy participants cannot be handled by draining the existing true-to-false queue alone.

No new cleanup script has been created because retained-data presence and the authorized target have not been established. The plan's conditional script remains available if the inventory proves it necessary. Ordinary deployment of the consent UI must remain blocked until effective writer/in-flight containment and any required deletion are proved.

Verification checkpoint: repository-native Biome formatting passed for the eight
changed implementation/test modules; Prettier passed for the plan, bilingual docs
and engineering documentation; `git diff --check` passed. Biome lint also reported
pre-existing `noThenProperty` on Yup's required `then` API and existing
`noExplicitAny` warnings; no unrelated lint rewrite was retained. The docs
executor's check used host binaries (not container validation); main's formatter
checks likewise do not substitute for required container builds/tests. The two
retained dashboard images were inspected visually by main before the quiz example
was removed. No application runtime or new browser screenshots are available.

The implementation remains uncommitted while required container checks are
blocked. The target-integration merge is the only new commit; no push or PR-body
update has been made and #5970 is not claimed ready. All unrelated Edu-ID local
changes are preserved. The native goal is blocked pending host-tool repair approval; its full objective
is not complete.

Runtime release attempt: `devrouter stop` for the exact task checkout failed with
`Retained container population or immutable identity changed.` Although the
preceding doctor report described the full profile as stopped, final provider and
route release cannot be claimed. Recovery state is preserved. No raw container
mutation, ownership-record edit, lock bypass or deletion was attempted. Host-tool
compatibility and ownership proof must be repaired through the lifecycle manager
before runtime-dependent work resumes.

### Continuation source audit — 19 September 2026

Previous goal turn: **progress**, with shared source, containment, documentation
and tests changed. This continuation confirmed the working tree and source seams;
no repair approval has arrived and no failed runtime operation was retried.

Added the remaining planned regression case: initial account creation with both
purposes refused must complete and append exactly one audit event while another
transaction holds the analytics advisory lock. This complements existing
research-only nonblocking and settings timeout/retry coverage. It remains unrun
pending the container. Verified that PWA Tailwind already scans shared component
sources and the documentation site serves its docs at `/`, so the moved view and
new direct links follow existing source configuration. These checks do not prove
browser behavior or generated package output.


### Blocked audit — 19 September 2026

The same host compatibility/ownership blocker has persisted across the initial
goal execution and two continuations. The first two turns made source progress;
no remaining independent step can satisfy the required container/browser gates.
No repair approval has arrived. The installed Devrouter remains 0.0.77; the
recorded ensure/doctor failure rejects Devsy 1.19.0 and retained-runtime ownership
proof remains unresolved. No active verification process is being awaited.

Mark the goal **blocked**, preserving the complete objective and local changes.
Resume on approval of the pending host-tool compatibility repair or evidence that
a compatible managed runtime has been restored. Then run the focused checks,
review/commit/push the core package, and obtain the separately named foundation
merge/synchronization authority before implementing the dependent chat package.
No core or chat implementation completion, PR readiness, deployment, retained-data
cleanup or runtime release is claimed.

### Execution checkpoint — 20 September 2026

The status table above records the 19 September view; this checkpoint supersedes it.

- **Runtime recovery.** Devrouter 0.0.80 does not fix the earlier blocker. `ensure` fails with `Managed Compose configuration changed for service 'oidc'`: the identity check compares `docker compose config --hash <service>` with the container label `com.docker.compose.config-hash`, and the two can never agree for a service declared as `network_mode: service:app`. Reproduced in isolation and on the worktree's `oidc` service, while the other eight services match byte for byte. `devrouter stop --delete` additionally refuses once a container has been replaced ("Retained container population or immutable identity changed"). Working sequence: `devrouter workspace journal settle <path>` -> `devrouter workspace down <workspace> --keep-worktree --repo <primary>` -> `devrouter stop` -> `devrouter ensure`. The runtime then reports ready with no drift (compose project `default-rs-c4ea9`).
- **App data.** Post-create did not rerun on the recreate, so `prisma:reset:raw --force`, `prisma:push:raw` and `prisma-data seed:raw` were run manually in the container. The application database is `klicker_test` (100 tables, 52 participants, 6 courses). Running the graphql test suite wipes it; reseed before browser work.
- **Layer 1 published.** `36b5c8e71c` is committed and pushed on `rs/dpo-release-1-disclaimers` (PR #5970, base `v3`) after integrating `origin/v3` at `03cfbd6f21` through merge `0a950d4bef`. The commit carries the release scope only: the three creation and renewal entrances, persisted research and LA choices, the participant settings surface, the reworked privacy policy, the group-only student LA pages, the shared writer seam for the later chat companion, and LA containment (the Python analytics package refuses to import and the four optional analytics reads short-circuit). Exports, LA activation and computation, and the KB upload disclaimer stay deferred.
- **PR refresh.** #5970 was rewritten around the layer-1 scope, with an inline screenshot block holding three synthetic signup captures at head `36b5c8e7` (published as GitHub user attachments that resolve as `image/png`) and with the release gates recorded in the description.
- **Verification on the current head.** Container production compiles for `frontend-pwa`, `frontend-manage`, `frontend-control`, `auth` and `chat`; the `backend-docker` rollup build, the documentation build and a PWA typecheck pass; a forced rebuild of `graphql`, `shared-components`, `i18n` and `util` passes (9/9). The repository pre-push build cannot run while the dev servers are up: Next 16 writes `.next/dev/types/validator.ts`, the app tsconfig includes it next to the build's `.next/types/validator.ts`, and the typecheck fails on a duplicate `PagesPageConfig`; the failure reproduces in the untouched `frontend-control` app, so the equivalent container checks were run and CI covers the clean build.
- **Open gates.** LA containment still needs values-free live evidence (writers stopped, no in-flight recreation, retained derivative tables and pending withdrawals reconciled or scheduled under separate approval). Exact-head CI and `/final-review` must rerun on the new head; the two most recent `/final-review` attempts failed at the provider with HTTP 403 "Key limit exceeded". Merging #5970 into `v3`, the `v3` -> `v3-ai` synchronization and any deployment keep their named authority, and the chat companion (registered and guest onboarding) remains dependent on that synchronization.
- **Local environment caveat.** In the routed stack the PWA renders server-side authenticated pages, but client-side GraphQL requests are rejected as `Unauthorized` even with a valid `participant_token` cookie that the server-rendered path accepts. Captures of the authenticated surfaces therefore need either the assessment-mode Edu-ID mock restart or a fix to the local cookie path; the public disclaimer surfaces capture normally.
- **Preserved local work.** The uncommitted Edu-ID/mock-OIDC devcontainer changes (`.devcontainer/*`, `.devrouter.yml`, `packages/prisma-data/*`, `turbo.json`) and `apps/backend-docker/.env` (`ASSESSMENT_MODE=true`, assessment subdomain pointing at the worktree PWA host) remain untouched and out of #5970.

### Execution checkpoint — 20 September 2026 (evening): release sequencing

The notice/persistence layer is now merged upstream, and the plan's goal is restructured into the STG → PRD → next-steps order the user set.

- **Merged state, verified live.** `origin/v3` = `11e48f2aeb`, containing the DPO squash `d3ab5f1c04` (PR #5970, merged 19:01Z). `origin/v3-ai` = `a4960ba1bd`, containing `d3ab5f1c04` through the `v3` → `v3-ai` synchronization (PR #6201, merged 19:38Z). `origin/v3-audit` = `96ed33f8c7`, 20 commits behind `v3-ai` and without the DPO layer; staging builds from `v3-audit`.
- **Stage-1 entry action.** PR #6203 (`v3-ai` → `v3-audit`) is CONFLICTING, with conflicts confined to the DPO-touched pages `apps/frontend-pwa/src/pages/createAccount.tsx` and `apps/frontend-pwa/src/pages/editProfile.tsx`. Resolve on a task branch and land through #6203; this hop always uses an integration PR. The staging promoter then independently re-validates the exact `v3-audit` head before moving `stg-release`.
- **Gated actions retained.** The #6203 merge, the `stg-release` move, the PRD release and any retained-data cleanup each keep their named authority. This documentation update performs none of them.
- **Deferred to Stage 3.** The chat notices companion, KB confirmations, research/assessment exports and the LA product are explicitly not part of the STG/PRD notice release.
