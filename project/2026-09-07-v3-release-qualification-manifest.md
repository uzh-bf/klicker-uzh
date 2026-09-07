# V3 candidate qualification manifest

## Status and identity

Local qualification is in progress. This is not permission to publish or deploy.

| Reference                                | Value and evidence                                                                                                                                                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selected candidate                       | `7c73ed231ce89885f634d37fece86c621424f617`                                                                                                                                                                                                                                |
| Inclusion                                | [Beta preference and sole AI approval](https://github.com/uzh-bf/klicker-uzh/pull/5799) merged September 7 at 15:52:46 UTC; the candidate descends from [the disclaimer fix](https://github.com/uzh-bf/klicker-uzh/pull/5696), `b8a3e9f04d02b90165c4647c52a179c1ab7c632a` |
| Local package                            | `rs/v3-release-qualification`; plan commit `2b0b6e42e7b1fdf27a4298c6c7eb599f7f868b8a`; no upstream or PR                                                                                                                                                                  |
| Executable qualification SHA             | `83ed4ca36a3d18a882e70ecd7646d283ea1f7ba8`; application source unchanged from candidate; release paths corrected and one admission regression added                                                                                                                       |
| General production source reference      | `v3.4.0-alpha.73`; source comparison only, not live deployment proof                                                                                                                                                                                                      |
| Chat-only source reference               | `v3.4.0-alpha.73.3`; not the database baseline                                                                                                                                                                                                                            |
| Proposed next version                    | Dry-run currently proposes `3.4.0-alpha.74`; not yet authorized for publication                                                                                                                                                                                           |
| Release SHA, tags and production digests | Pending separate source-publication approval and build receipts                                                                                                                                                                                                           |

The primary checkout is not the execution workspace. The task worktree was created directly at the selected candidate, without integrating or altering the former PR branch. The former PR's remote branch was removed upstream; its local worktree and user input remain preserved.

## Combined-tree delta and review reuse

Against reviewed beta head `3b019cb2023c431faf69abceeb81ca1135f1fb8d`, the candidate changes 14 paths. Thirteen concern staging promotion, final-review automation and their documentation; one restores the disclaimer button's `primary` prop and documents its dark-mode requirement. No other application/package source, Prisma migration, lockfile, package manifest or Turbo configuration changes.

The staging controller tests and final-review tests ran locally against the candidate: 80 passed, zero failures or skipped tests. The execution used Node 24.16.0 in a network-disabled, automatically removed checks container. It made no forge, registry, deployment or provider requests. These tests validate controller logic, not live staging state.

The beta integrated review remains applicable to unchanged content. Its report is retained in the former worktree at `project/_local/reviews/2026-09-07-pr5799-integrated-addendum.md`. The disclaimer PR reports a dark-scheme browser/CSS measurement; local qualification must retain that evidence boundary rather than claim a new browser run.

## Exact-candidate producing runs

| Evidence                                                                                        | Observed result and boundary                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Codebase checks](https://github.com/uzh-bf/klicker-uzh/actions/runs/34140529675)               | Success; actual steps passed dependency install, formatting, syncpack, lint, schema sync, command checks, package build and TypeScript checks. Advisory checks are not mandatory-clean claims. |
| [Unit suites](https://github.com/uzh-bf/klicker-uzh/actions/runs/34140529720)                   | Success; producing logs show 55 Chat files and 611 tests passed. This includes the approval admission seam.                                                                                    |
| [GraphQL suites](https://github.com/uzh-bf/klicker-uzh/actions/runs/34140529833)                | Success; producing logs show 45 files and 868 tests passed, including beta preference and authorization suites.                                                                                |
| [Combined-candidate Playwright](https://github.com/uzh-bf/klicker-uzh/actions/runs/34140530007) | Success; shared build, all eight hosted shards and aggregate passed. Producing logs report 977 passed, one flaky test passing on retry, and five skipped tests.                                |
| [Earlier beta-head Playwright](https://github.com/uzh-bf/klicker-uzh/actions/runs/34134801680)  | All eight shards and aggregate passed on `3b019cb2023c`. Useful unchanged-source proof, not a replacement for the active combined run.                                                         |

The merged PR's hosted final-review context was ERROR and GitGuardian was FAILURE in the post-merge readback. Merge is not evidence that these checks passed or were independently resolved. No review retry, budget increase, suppression or waiver was performed by this package.

## Migration inventory

Source range: `v3.4.0-alpha.73..7c73ed231ce89885f634d37fece86c621424f617`. Exactly seven files were added under `packages/prisma/src/prisma/schema/migrations/`; no existing migration was modified or deleted in that comparison. Live pending counts remain unknown.

| Migration directory                                | Effect                                                                  | SHA-256                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 20260820151622_chatbot_lifecycle_and_ai_capability | Adds lifecycle and old approval fields; publishes existing chatbot rows | `9f62c80f0ffd370883714951979eba253798fe3c1ac1c5359e9e3ad9feae6b2b` |
| 20260822075407_chat_account_usage                  | Adds monthly owner/class accounting with owner cascade                  | `c1bc7173ffe97c30c12def7077a2125612c87cb6396be5ef5f4090a4ae7e2ddb` |
| 20260823120459_ai_features_enabled                 | Adds sole AI approval, default false                                    | `b94d6d3e0771ec1134b3a1bad3944466b01791fc4c5aaaaf319a79edae8f98c8` |
| 20260826012006_chat_turn_lifecycle_claim           | Adds attempt ID and lifecycle; existing messages default completed      | `09d17934e122596531ffaa23c0cacf36f8928674bafbc1608cf3c210e277dd94` |
| 20260902100000_course_deletion_request             | Adds nullable course deletion-request time                              | `de653de148f265a2dedbf71f4205b4c0304c7ee92e46c05aaf1471e785af9f1b` |
| 20260903120000_chatbot_standard_mode_config        | Adds nullable standard-mode JSON configuration                          | `c178fe11a9c00ff9851a2a818f6e7e46bd3d9fa958c8c5e85dd19049a6e9946f` |
| 20260906212500_beta_preference_and_ai_approval     | Drops old approval column; adds beta preference default true            | `5a06b77b048f9c0a1359ede0f3c78242aa30975bc9149bf6e2aadec46512893c` |

The six migration files shared with inspected v3-ai `654621094c63` are byte-identical. Extra v3-ai migrations are not part of this candidate. No migration has been generated or edited by this qualification package.

Prisma/Analytics schema parity passed in the candidate CI. This does not prove the deployed Analytics client matches it. ADR 0041's complete-only-reader floor and the removed-column compatibility gate both remain active.

## Acceptance matrix

| Observable requirement                                                      | Existing seam and evidence                                                                                                                                     | Remaining qualification                                                                                       |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Beta preference persistence and default-on behavior                         | GraphQL beta enrollment service/schema suites pass; fresh isolated SQL probe proves existing/new row defaults, opt-out persistence and independent AI approval | SQL probe is a focused two-migration behavior check, not the full migration rehearsal                         |
| Opt-out defeats permissive rollout                                          | `chatbotAuthoringAuthorization.test.ts` exercises DB beta false against allowed rollout                                                                        | Reuse exact-candidate GraphQL run                                                                             |
| Intended authoring without AI approval                                      | DRAFT creation integration case with fresh default-false owner; exact-candidate GraphQL run passed                                                             | Covered for draft authoring, not model use                                                                    |
| Unapproved owner cannot start model work under either budget setting        | `account-usage-route.test.ts` asserts 403, protocol code and no provider/MCP/credit work for both settings                                                     | Covered by exact-candidate Chat run                                                                           |
| Approved owner can use Chat; participant access survives owner beta opt-out | Added POST regression with AI approval true and beta false; 29 focused tests passed                                                                            | Synthetic model boundary only                                                                                 |
| Login, Live Quiz, assessment, workers and disclaimer                        | Combined Playwright passed with the caveats below; reused disclaimer browser proof                                                                             | No live deployment or provider proof; worker behavior covered through CI activity flows, not live queue drain |

The added regression in `apps/chat/test/account-usage-route.test.ts` verifies participant admission when the owner has AI approval and `betaEnabled: false`. The real POST handler returns 200 and calls the mocked model stream once. Its focused suite passes all 29 tests in the network-disabled Node 24 checks container. This is synthetic admission proof, not a real provider request. Independent simplification and slice correctness reviews of `07e99dd2..83ed4ca3` found no actionable changes.

Authoring without AI approval is covered by the passing `manageChatbots.test.ts` DRAFT-creation integration case. `test/helpers.ts:87` creates fresh users without an AI flag override, so the database's false default applies. The case enables the authoring rollout and verifies the persisted DRAFT owner and modes. This proves draft authoring, not publishing or provider validity.

The five Playwright skips are German activity-wizard recovery cases in `W4-activity-wizard-safety.spec.ts`: selected library elements (line 478), duplicate/conversion drafts (652), mounted snapshot isolation (777), storage cleanup failure (876), and edit-mode snapshots (1038). They are not claimed as tested. The flaky case is the Live Quiz description check in `O1-live-quiz-core.spec.ts:3214`, which passed on retry. The retained disclaimer proof is the merged PR's dark-mode browser/CSS measurement; no fresh browser run is claimed.

## Local toolchain receipt

Pinned checks image: `klicker-beta-guard-checks:local`, image ID prefix `12a2392a3821`; Node 24.16.0 and pnpm 11.5.0 verified. Existing dependency files were mounted read-only from the former task worktree; no frozen-install claim is made for that mount. Candidate CI supplies independent frozen-install/build evidence.

The plan commit used focused container Prettier (explicitly bypassing the repository's project-document ignore), host identity and staged gitleaks checks, and reused candidate CI quality checks. The host hook was disabled for that commit so it did not invoke container-dependent checks on the host. No hook configuration was changed.

Release dry-run is Git-coupled host tooling. The first host attempt used Node 22.23.0 and is excluded from qualified proof. A repeat with pinned host Node 24.16.0 reproduced the missing-file issue. The installed `standard-version` 9.5.0 silently ignores ENOENT in its bump lifecycle. The configured script's flags are `--dry-run --prerelease alpha`; direct CLI invocation uses those exact flags to avoid pnpm replacing Linux-managed dependencies.

Final dry-run at `83ed4ca36a3d18a882e70ecd7646d283ea1f7ba8` passed with pinned Node 24.16.0. Assertions verified all 21 configured bump targets were processed and compared every package checksum, changelog, HEAD, tag refs and Git status before and after: unchanged. It proposed `3.4.0-alpha.74` and emitted only the known DEP0176 warning.

## Pending release fields

Integrated final review remains pending. Production image digests, topology/ledger, approvals, provider validity, rehearsal, backup/recovery and activation remain separately gated in the cutover packets.

## Source image and client inventory

All references below are source at the candidate, not running deployment receipts. Registry prefix: `ghcr.io/uzh-bf/klicker-uzh/`. Each repository has a corresponding `.github/workflows/v3_*prd.yml` build; workflows produce ARM and AMD variants, while the checked-in PRD values select ARM. New-release run IDs, tags and digests are pending for every row.

| Image repository before architecture suffix | PRD source consumers and reference                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `hatchet-worker-general`                    | General worker; alpha.73                                                                               |
| `hatchet-worker-response-processor`         | General and assessment workers; alpha.73                                                               |
| `auth`                                      | Auth; alpha.73                                                                                         |
| `chat`                                      | Chat; alpha.73.3                                                                                       |
| `frontend-pwa`                              | Participant PWA; alpha.73                                                                              |
| `frontend-manage`                           | Lecturer UI; alpha.73                                                                                  |
| `frontend-control`                          | Controller; alpha.73                                                                                   |
| `backend-docker`                            | Primary and assessment GraphQL; alpha.73                                                               |
| `olat-api`                                  | OLAT API; alpha.73                                                                                     |
| `lti`                                       | LTI; alpha.73                                                                                          |
| `response-api`                              | General and assessment response APIs; alpha.73                                                         |
| `frontend-assessment`                       | Assessment PWA; alpha.73                                                                               |
| `analytics`                                 | PRD build exists; no image entry in these PRD values. Deployment owner/topology unresolved             |
| `backend-docker-migrator`                   | Backend workflow builds from `packages/prisma/Dockerfile`; omitted tag defaults to primary backend tag |

Chart and values source: `deploy/charts/klicker-uzh-v3` and `deploy/env-uzh-prd/values.yaml` at the candidate. Actual deployed revisions remain unknown. The migrator is a PreSync wave -1 Job and consumes `<release-fullname>-secret-backend-graphql` only. This does not prove that assessment shares its database.

Runtime references follow each app's `<release-fullname>-secret-<component>` and corresponding ConfigMaps. Assessment uses distinct backend, response-API and response-worker Secret references. Chat has its own Secret reference. General and assessment clients must therefore be reconciled individually, not inferred from repository reuse. Analytics has a separate generated Prisma schema; administrative and independently deployed clients require a live inventory. All clients and rollback images must prove their generated schema does not select the removed approval column.

Auth, Chat, manage, control, PWA and assessment PRD workflows supply `NEXT_PUBLIC_ENV`, `NEXT_PUBLIC_GROWTHBOOK_API_HOST` and `NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY`. The latter two use repository variable references ending `_PRD`; tag builds select `production`. Verify the producing run's inputs without exposing values. Primary backend retains the optional `secret-growthbook-management` reference; no management configuration was removed.

## Corrected release-tooling evidence

Commit `07e99dd2cedad11aa1dff36ff981ab79289f0b73` corrects seven missing path separators and the moved LTI/Hatchet package paths. No new package is added to the existing intended set. All 21 configured files exist and parse with the intended package names. The corrected pinned Node 24.16.0 / standard-version 9.5.0 dry-run processes all 21 and proposes alpha.74. Assertions compare all 21 package checksums, CHANGELOG.md, HEAD, tag refs and working-tree status before and after: unchanged. The old standard-version dependency emits DEP0176; no upgrade is included.

Container Biome and direct Prisma/Analytics parity checks pass. This mechanical path correction does not arm a simplifier; release behavior and completeness receive integrated final review. No release command without `--dry-run`, version commit, tag or publication occurred.

## Focused synthetic SQL evidence

Fresh PostgreSQL 15 container `542bfc724b8f897dd6c95d2e77b69926a66292570ba3205b38e708b1502648d8` used network `none`, zero published ports and tmpfs PGDATA. Repository bootstrap created the restricted marked test identity on this fresh target. The probe checked database/session identity, restricted role and marker before creating its test-owned minimal table. It applied the exact AI-approval and beta-preference SQL files, verified defaults on an existing and a new row, then verified opt-out persistence and independent approval. All assertions passed.

This deliberately tests only the relevant defaults and separation; it does not establish whole-schema/client compatibility or upgrade rehearsal. The exact container is stopped with state `exited`; tmpfs synthetic data is gone. No retained database, port forward or managed devrouter runtime was touched. The stopped container object remains; no cleanup deletion was inferred.
