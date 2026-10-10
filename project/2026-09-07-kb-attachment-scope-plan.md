# Keep managed KB attachment and Chat scope consistent

## Approval summary

Normal KB attachment provisions a reserved KB tool binding without its required scope parameters. Fresh Chat retrieval fails closed; replacement leaves any old scope unchanged. Set the single-KB scope in both create and update branches of the existing transaction. Preserve ownership locks, the single-enabled-KB relationship, tool allowlist, modes and detach semantics. No schema, credentials, migrations, live data or gateway configuration changes.

The user approved preparation of this source fix. Deliver a regression-tested and independently reviewed draft PR targeting v3-ai; no merge or deployment. Live UI and migrated-data acceptance remain in the unified KB roadmap. Isolated database/runtime availability gates tests and readiness, never justifies use of a shared database.

## Execution details

Repository: KlickerUZH. Reuse trees/kb-attachment-scope on fix/kb-attachment-scope, based on origin/v3-ai d03d4830622984d43e6712e30f06673a7f2b85cf. The primary checkout is dirty and excluded. Full-path regression package; parent owns contracts and final proof, trusted executor owns packages/graphql/src/services/knowledge.ts and packages/graphql/test/knowledge.test.ts only.

Write parameters {required:true, toolAlias:'doc_query', kb_id:kbId} on create and update. Tests feed the actual persisted configurations into apps/chat/src/services/mcpScope.ts's resolver after fresh attachment, replacement, and detach. Preserve unrelated bindings. Ensure replacement cannot resolve the old KB. Use existing test-owned synthetic fixtures and repository-native tooling; no new dependency or copied scope logic. Resolve test alias imports without changing production architecture. Existing source contains no parameter default.

Run focused GraphQL knowledge tests on an isolated synthetic test database, relevant type/format checks, then simplifier and risk review of the committed slice, followed by integrated final review. Tests must fail without the source fix. No new browser acceptance is claimed by this backend regression package. Pause on a new contract decision, unavailable isolated runtime, or unresolvable required review capability; continue independent source work.

## Progress

2026-09-07: implemented in f5f32a0208. Both create and update persist the required single-KB scope. The isolated synthetic database suite passed all 63 knowledge tests; removing the two source additions made the regression fail, then the original source was restored. GraphQL checks, scoped formatting, diff checks, Gitleaks and focused Opengrep passed.

All hook checks passed with the required environment split: 40 container build/typecheck tasks plus lint and auxiliary checks; 68 host workflow/Devrouter tests. The combined host hook failed on container toolchain outputs; the combined container hook required the host-only Devrouter executable. Equivalent checks ran in their correct environments before committing.

Native slice review found no correctness or scope-isolation issues. Simplifier and final reviewer identified a redundant old-KB exclusion assertion; removed it and the unused helper return, retaining exact equality assertions for both modes. Final review also requested this progress reconciliation. These assertion-only and documentation corrections preserve the tested behavior; prior verification and reviews remain applicable, with final diff inspection of the correction.

Runtime fix-kb-attachment-scope was stopped through devrouter; its recorded container is exited and exact worktree route count is zero. No live data, migration, deployment or browser acceptance was performed. API tunnels are now listening; live reconciliation remains separate. Remaining delivery: ordinary branch push and draft PR targeting v3-ai, followed by human review and required CI. No merge authority.
