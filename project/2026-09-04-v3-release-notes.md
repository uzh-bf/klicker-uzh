# V3 release notes draft

Proposed version: `v3.4.0-alpha.74`. The repository-native alpha dry-run succeeds and compares against the general `v3.4.0-alpha.73` release. The Chat-only `alpha.73.3` tag is a separate hotfix comparison, not the database baseline. This draft is not a published release or a deployment approval.

## Changes included in current v3

- Manage: clearer question-library states, scanning and actions; improved element creation; interrupted activity-wizard recovery; required course-copy start dates.
- Practice: course practice-pool discovery, completion that stays in course context, and focused practice embeds with progress and feedback fixes.
- Chatbots: lecturer draft authoring, guided setup, publication requests and approval controls. Existing published chatbot access remains based on course Participation, irrespective of leaderboard opt-in.
- Chat: scoped Doc Query support, grounding and course-language policies, Quizzer formative checkpoints, account usage accounting, and lifecycle/access hardening.
- Account: discoverable beta enrollment, controlled by the beta-signup flag; account usage visibility and its protected query remain behind ai-beta.

## Database payload

The release contains four new additive Prisma migrations, from 179 to 183. No historical migration SQL is edited or deleted. Analytics schema mirrors match.

| Migration                           | Effect                                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Chatbot lifecycle and AI capability | Adds publication states and owner capability fields; backfills existing chatbots to PUBLISHED; new chatbots default to DRAFT |
| Chat account usage                  | Creates an initially empty monthly owner/class usage table with decimal budgets and usage                                    |
| Chat turn lifecycle claim           | Adds lifecycle status defaulting to COMPLETED and an optional attempt identifier                                             |
| Course deletion request             | Adds the nullable timestamp used by asynchronous course deletion                                                             |

The runtime migration runner is a separate mechanism; its registry remains empty. The Prisma migrator image is built alongside the backend and its deployment hook applies the SQL during a later rollout, not when this release is tagged.

Local verification reports all 183 migrations applied. The Chat test suite passes all 564 tests with PostgreSQL accounting integration enabled, including concurrent charging, duplicate claims, late callbacks and transaction rollback. Auth adapter and assessment identity persistence tests also pass. These are isolated synthetic-database checks, not production deployment evidence or proof of historical migration generation.

## Local release hardening

The preparation branch patches Next.js to 16.2.11 and next-auth to 4.24.15, preserving unrelated dependency versions. Frozen installation, full repository checks, and production/test-mode builds of all six affected apps pass. The dependency review found no blocking defect. These changes are committed locally but are not yet merged into v3. The citation test now waits for the streamed answer's layout to overflow before checking follow-scroll behavior; it passes three consecutive Chromium runs with retries disabled.

Focused browser verification passes for student sign-in, lecturer session routing, return-target protection, expired-session recovery, beta enrollment discovery and opt-out, hidden usage without its flag, and Chat access/recovery. The lecturer test injects a synthetic session cookie; a separate browser check completes the actual delegated credentials form and reaches the authenticated Manage library. Control's five-test quiz workflow passes without retries after a bounded repair of stale local generated routes. The initial cross-app run had two dependent Control failures; the passing rerun does not hide that diagnostic history. Auth's stale API-route cache also needed bounded repair before the real login check. No application source changed for the local runtime repairs.

## Feature and compatibility notes

- ai-beta is not a universal chatbot-authoring gate. Catalyst/full-access authoring can create drafts; publication still requires separate entitlement and approval.
- beta-signup controls discovery and new enrollment without preventing existing members from opting out. This package changes no remote flag or cohort configuration.
- The lifecycle-attempt flag does not disable IN_PROGRESS message rows. Older readers do not preserve the new lifecycle and publication contracts; do not describe a blanket old-image rollback as compatible.
- Cached Manage clients using the old synchronous course-deletion mutation must refresh. A process failure between marking deletion and publishing its event can leave a course hidden. Abandoned Chat claims likewise need guarded recovery. These known limitations are recorded separately from tagging readiness.

## Remaining release actions

| Item                                                                                     | Required disposition                                                                                                                                                  |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local Next.js/next-auth security patch and citation assertion fix                        | Complete verification and review, then publish and merge the hardening PR after explicit approval                                                                     |
| [Chat disclaimer dark-mode fix](https://github.com/uzh-bf/klicker-uzh/pull/5696)         | Preserve the already-deployed hotfix in v3 before replacing the Chat image; merge is not yet authorized                                                               |
| [Tornado development dependency update](https://github.com/uzh-bf/klicker-uzh/pull/5724) | Optional maintenance: current production Analytics uses uv sync --no-dev, excluding the notebook dependency chain that brings Tornado                                 |
| [Scoped Doc Query activation stack](https://github.com/uzh-bf/klicker-uzh/pull/5709)     | Do not import the conflicting feature stack; relevant runtime support is already merged                                                                               |
| Tag and GitHub release                                                                   | After required source changes are merged and checks pass, explicitly authorize the release commit/tag and publication; verify all required tag-triggered image builds |

The alpha dry-run uses the expected general alpha baseline and does not accidentally select a Chat-only maintenance tag. GitHub's existing release workflow matches stable version tags, so do not assume an alpha tag alone creates its GitHub Release entry. Verify or create that entry explicitly during authorized publication. No deployment, backup exercise or calendar freeze is part of this preparation package.
