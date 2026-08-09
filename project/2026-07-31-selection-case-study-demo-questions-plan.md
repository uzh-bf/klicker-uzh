# Selection and Case Study Demo Questions Finalization Plan

> This artifact records the implementation contract, decisions, and verification evidence for PR #5261. Source and test files are authoritative for executable detail; this plan intentionally describes behavior instead of copying their bodies.

## Goal

When a new lecturer submits first-login settings with `seedDemoElements: true`, create the complete selection and case-study demo bundle, its shared answer collection, and the final untimed Demo Live Quiz block. The flow must be atomic and safe under concurrent first-login requests.

## Approved contract

- Keep `changeInitialSettings` and `seedDemoQuestions` as the entry points.
- Claim `User.firstLogin` with a conditional `updateMany` inside one bounded Prisma interactive transaction.
- Run the legacy demos, the relational bundle, permission recomputation, Demo Live Quiz creation, and final user update on the same transaction client.
- If another request loses the claim, return the fresh user without seeding.
- If any seed step fails, roll back the claim and all seed writes so a later request can retry.
- Preserve the existing opt-out and completed-first-login behavior.
- Create one `Demo Teaching Activities` collection with six entries, Selection and Case Study elements, and a sixth untimed quiz block with Selection first and Case Study second.
- Do not change the Prisma schema, GraphQL contract, frontend, dependencies, or deployment configuration.

## Finalization decisions

- Context7 was unavailable. The installed repository types and the official [Prisma transactions documentation](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) were used to confirm interactive transactions, bounded `timeout`/`maxWait`, nested writes, relation `connect`, and relation `include`.
- Use `maxWait: 10000` and `timeout: 30000`. The final focused database suite completed in 3.13 seconds.
- Remove the relational helper's nested transaction. It receives `PrismaTransactionContextWithUser` and uses the root transaction client.
- Use local relation and case-solution builders to remove the duplicated blocks that caused the previous Sonar failure.
- Treat late seed failure as all-or-nothing. This is a deliberate contract change from the previous partial-seed behavior and is covered by a late Prisma validation-failure/retry test.
- Keep browser evidence in `/private/tmp`; screenshots are verification artifacts, not repository data.

## Files and responsibilities

| File | Responsibility |
| --- | --- |
| `packages/graphql/src/services/accounts.ts` | Authenticate/authorize the first-login flow, claim the user atomically, invoke the seeder, and finalize settings. |
| `packages/graphql/src/services/demoQuestions.ts` | Create the shared collection and relational Selection/Case Study demo elements using the supplied transaction client. |
| `packages/graphql/test/accounts.test.ts` | Verify opt-in, opt-out, completed-first-login, shortname conflict, rollback/retry, concurrency, resource relations, quiz snapshots, and empty results. |
| `docs/data-and-migrations.md` | Document the third request-driven seed path and its transaction boundary. |
| `docs/log/2026-08-04-demo-selection-case-study-seeding.md` | Record the dated wiki change. |
| `project/2026-07-31-selection-case-study-demo-questions-design.md` | Store the approved behavior and acceptance criteria. |

## Implementation checklist

- [x] Confirm the Prisma transaction API and record the documentation fallback.
- [x] Add the shared answer collection and six entries.
- [x] Add Selection with two inputs and the two correct entries.
- [x] Add Case Study with four items, three criteria, two cases, and all sample ranges.
- [x] Recompute owner permissions through the transaction client.
- [x] Add the relational elements to the final Demo Live Quiz block.
- [x] Add assertions for persisted resources, relation IDs, permissions, snapshots, and empty results.
- [x] Preserve opt-out and completed-first-login behavior.
- [x] Preserve the shortname-conflict path with `firstLogin` still available.
- [x] Prove rollback/retry after a deliberate late Prisma validation failure.
- [x] Prove concurrent identical requests create one complete bundle.
- [x] Extract the relational builder into `demoQuestions.ts`.
- [x] Replace source-copy plan sections with this behavioral plan.
- [x] Update the wiki and dated log.
- [ ] Complete the final review gates and record their exact range.
- [ ] Read back GitHub CI and Sonar for the published head after explicit push authorization.

## Verification record

All commands below were run against the linked `review-pr5261` DevPod unless stated otherwise. Browser verification used a seeded disposable database; the focused suite then reset it to its isolated test fixture state.

### Local checks

- Focused command: `vitest run test/accounts.test.ts` with the in-memory local Hatchet token. Result: 7 tests passed in 3.13 seconds; expected Redis connection-refused noise was emitted because the optional Redis services were not running.
- `pnpm --filter @klicker-uzh/graphql check`: passed.
- `pnpm --filter @klicker-uzh/graphql build`: passed; only existing Pothos and circular-dependency warnings were emitted.
- `pnpm run check:all`: blocked by the DevPod analytics lint environment; pandas 2.2.2 could not build because the container has no `cc`, `gcc`, or `clang`. The repository-wide checks that completed before that failure passed, including formatting, syncpack, AGENTS checks, Prisma sync, and the changed GraphQL package check.
- `opengrep scan --config auto packages/graphql/src/services/accounts.ts packages/graphql/src/services/demoQuestions.ts packages/graphql/test/accounts.test.ts`: 0 findings.
- Markdown Prettier checks passed.

The repository `test:local` wrapper was not used in the DevPod because it expects Docker inside the container. The focused Vitest command is the equivalent disposable-database path.

### Browser checks

Using `agent-browser` with delegated local access (`lecturer` / `abcd`) at `https://manage.klicker.review-pr5261.localhost`:

- The first-login form accepted demo generation and created `Demoquestion SE` and `Demoquestion CS` in the library.
- Selection editor showed `Demo Teaching Activities (6 entries)`, two inputs, and `Live poll` plus `One-minute paper` as correct options.
- Case Study editor showed the shared collection, four items, three criteria, two cases, and the configured sample ranges.
- Activity details showed block 6 without a time limit, with Selection before Case Study.
- After clearing the initial development diagnostics, the final browser readback produced no new console or page errors.

Evidence files:

- `/private/tmp/pr5261-library-after.png`
- `/private/tmp/pr5261-selection-editor.png`
- `/private/tmp/pr5261-case-study-editor.png`
- `/private/tmp/pr5261-demo-live-quiz-block6.png`

## Branch and review state

- Repository: `/Users/rschlae/Git/klicker/klicker-uzh`
- Worktree: `/Users/rschlae/Git/klicker/klicker-uzh/trees/pr5261-finalize`
- Branch: `review/pr5261`
- Existing delivery path: PR #5261, `https://github.com/uzh-bf/klicker-uzh/pull/5261`
- Target: `v3`
- Live base incorporated by merge commit: `014ac216a`
- Implementation commits: `508a3dccd`, `8aa0942d2`, and `a445253e2`.
- Exact integrated review range: `30df9e9d67c0bc8f2067960478f821f4944d94d8..40b3e0de6`, persisted in `project/_local/reviews/2026-08-09-pr5261-integrated-final.md`.
- Current worktree state: clean after the refactor commit; do not push without explicit authorization.

## Publication boundary

The branch has not been pushed after finalization. Sonar and GitHub checks therefore remain unverified for the final head. Push, PR-body update, ClickUp mutation, merge, and deployment require explicit user authorization.
