# Chat system-prompt versioning execution plan

Status: ready for Gate 1 approval. No implementation has started.

Planning review: the configured native planner returned
`DONE_WITH_CONCERNS` on 2026-08-23. This plan accepts its three required
corrections: use the exact U3 stack tip rather than stale `v3`, make the
foundation include writers and compatibility proof rather than schema alone,
and block release while any active JSON-only provisioner remains. It also
preserves two verified current behaviors that the draft review would otherwise
have changed:

- a non-empty `systemPrompts` object exposes exactly its own mode keys;
  built-in modes are used only when that object has no keys;
- the migration preserves the legacy JSON bytes instead of expanding a null
  tutor fallback into an explicitly returned prompt.

## Goal

Record which authored mode-prompt version and exact effective system
instructions produced every newly persisted successful or aborted assistant
message. Store each full prompt once in an immutable catalog and store only an
effective-prompt reference on each message.

The first release is internal. Database, analytics, and evaluation consumers
may use the lineage. Participant and lecturer APIs and user interfaces do not
expose it.

## Non-goals

- No inference or backfill for historical messages.
- No participant or lecturer prompt/version API or UI.
- No draft versions, prompt diff UI, new approval workflow, or tombstones.
- No versioning of mode labels/descriptions, model settings, tools, or response
  examples as authored prompts.
- No prompt-cache identity change.
- No removal of `Chatbot.systemPrompts` in this package.
- No changes to the separately owned Informatik-und-Wirtschaft provisioner
  branch.
- No push, PR/stack mutation, ready marking, merge, deployment, live
  reconciliation, or cleanup under the initial execution authority.

## Execution contract

- **Owner:** this task is the execution orchestrator for both new local layers.
- **Approval:** Gate 1 approval of this plan authorizes rebasing the empty task
  branch onto the exact U3 tip, creating the dependent P2 branch in the same
  worktree, in-scope edits, the isolated DevPod lifecycle, migrations against
  its disposable synthetic database, repository-native checks, required child
  reviews, plan/Progress updates, and scoped local commits.
- **Withheld:** push, native GitHub stack or PR mutation, marking ready, merge,
  deployment, live database checks or writes, changes to the separately owned
  provisioner branch, branch/worktree deletion, and cleanup.
- **Terminal:** two clean locally committed branch tips, separate layer checks,
  integrated verification, required reviews, and final Progress evidence.
- **Pause:** a changed U3 topology, an unresolved writer, an ADR number
  collision, malformed production-shaped legacy data that cannot be migrated
  deterministically, an integrity contract Prisma/PostgreSQL cannot enforce
  safely, or a required reviewer/runtime capability that reaches a terminal
  failure.

## Plan identity and freshness

- Repository: `/Users/rschlae/Git/klicker/klicker-uzh`
- Task worktree:
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/rs/chat-system-prompt-versioning`
- P1 branch: `rs/chat-system-prompt-versioning`
- P2 branch: `rs/chat-effective-prompt-provenance`
- Required P1 base: `origin/rs/chatbot-u3-usage-lanes` at
  `d386d1644c1b85e35e962ea15992656a4b320181`
- Current remote `v3` after the 2026-08-23 refresh:
  `35142c81acb89740949e2a499f5d2081a122feee`
- Current divergence: `v3` has 4 commits not in U3; U3 has 59 commits not in
  `v3`.
- Existing native stack #5476:
  PR #5460 -> PR #5475 -> PR #5480 -> PR #5490.

The task branch currently points at an older `v3` and is two commits behind
the refreshed remote. It is not an implementation baseline. Immediately before
the first mutation, fetch again, confirm the task worktree is clean, inspect
any U3 movement, and rebase the empty task branch onto the exact accepted U3
tip. Do not modify any existing stack branch.

Publishing remains blocked until the existing stack owner refreshes or accepts
the U3/current-`v3` divergence and dispositions PR #5460's current
GitGuardian failure.

## Grounding facts

- `Chatbot.systemPrompts` is one mutable JSONB field. No message records which
  value or built-in fallback generated it.
- PR #5460 makes PostgreSQL authoritative for chatbot configuration, extracts
  `systemPromptCompiler.ts`, and preserves current replacement/fallback
  behavior before later persona work.
- Compilation currently resolves the authored base, then conditionally appends
  the doc-query citation contract, then unconditionally appends the language
  contract.
- The final text is known only after the actual MCP tool set is resolved.
- U3 calls image-description `generateText` before the main `streamText`.
  Provenance must therefore be persisted before both call sites.
- U2's `finalizeChatTurn` transaction is the single successful/abort
  assistant-message and account-usage seam.
- The prompt-cache digest includes deployment and tool definitions and is
  absent for custom routing. It is not the effective system-prompt identity.
- Participant message history uses an explicit projection and DTO. Keeping the
  new field out preserves the public contract.
- Current prompt writers are the development seed, the Playwright fixture, and
  PR #5460's `createChatbot`. The separately owned optional provisioner
  scripts still write JSON directly.
- The Analytics app has no current prompt query, but its Prisma schema must
  remain synchronized. The Prisma Data chatbot usage workbook is the existing
  internal export seam.

## Settled domain contract

### Chatbot mode

A chatbot mode is a first-class, chatbot-owned operating style with a stable
UUID, an immutable per-chatbot key, presentation metadata, and an
enabled/disabled/retired lifecycle.

- `ENABLED` modes may generate.
- `DISABLED` modes retain lineage and may be enabled again.
- `RETIRED` modes retain lineage and cannot be reactivated by the v1 service.
- A mode key is never renamed. A replacement mode receives a new identity.
- Name and description are mode presentation fields. Editing them never creates
  an authored prompt version.

### Mode prompt version

A mode prompt version is one immutable authored instruction/persona revision
for one mode.

- Version numbers are positive and monotonic within the mode.
- Every accepted authored change creates and activates the next version,
  including a change whose text equals an older version.
- There are no drafts and no version reactivation in v1.
- Tools, model settings, labels/descriptions, and response examples are
  excluded.

### Effective system prompt

An effective system prompt is the exact final `instructions` string supplied
to the assistant model after all system-instruction composition.

- Identity is `(modePromptVersionId, sha256(exact UTF-8 text))`.
- Equal final text under different authored versions remains distinct
  provenance.
- Equal final text under the same authored version reuses one immutable record.
- If future response examples are physically inserted into system
  instructions, they create a different effective record without creating an
  authored version. Examples delivered as messages, tools, or skills remain
  outside system-prompt provenance.
- Model choice and non-rendered tool configuration do not affect identity.

### Historical and deletion behavior

- Existing messages keep a null effective-prompt reference. Null means unknown,
  never inferred.
- Disabling or retiring a mode keeps its versions and effective prompts while
  the chatbot exists.
- Deleting a chatbot cascades its modes, versions, effective prompts, threads,
  and messages. There are no tombstones.

## Data model

### `ChatbotMode`

| Field | Contract |
| --- | --- |
| `id` | UUID primary key and stable identity |
| `chatbotId` | Required chatbot FK, cascade with chatbot |
| `key` | Immutable string, unique within chatbot |
| `name` | Nullable presentation name; not prompt-versioned |
| `description` | Nullable presentation description; not prompt-versioned |
| `status` | `ENABLED`, `DISABLED`, or `RETIRED` |
| `activePromptVersionId` | Nullable only to permit atomic mode/version creation |
| timestamps | `createdAt`, `updatedAt` |

Use `@@unique([chatbotId, key])`. A composite same-mode foreign key must
prevent an active pointer from referencing another mode's version. The pointer
uses deferred/no-action semantics that permit the owning chatbot cascade while
blocking individual deletion of an active version; verify this against
PostgreSQL rather than assuming Prisma's generated action is safe. An
update-blocking database trigger prevents changing `key`.

A null active pointer is structurally possible during a transaction or after
manual corruption. Runtime resolution always fails closed. Every supported
writer must commit with one same-mode active version.

### `ChatbotModePromptVersion`

| Field | Contract |
| --- | --- |
| `id` | UUID primary key |
| `modeId` | Required mode FK, cascade with mode |
| `version` | Positive per-mode integer |
| `authoredPrompt` | Exact authored instruction/persona text, PostgreSQL `TEXT` |
| `createdAt` | Creation timestamp; no `updatedAt` |

Use `@@unique([modeId, version])` and the composite uniqueness required by
the same-mode active pointer. Do not add content uniqueness. A database trigger
rejects updates to `modeId`, `version`, or `authoredPrompt`. Deletion is
unsupported except through the owning chatbot cascade.

### `ChatbotEffectiveSystemPrompt`

| Field | Contract |
| --- | --- |
| `id` | UUID primary key |
| `modePromptVersionId` | Required authored-version FK, cascade with version |
| `sha256` | Lowercase 64-character SHA-256 hex |
| `systemPrompt` | Exact final system-instruction text, PostgreSQL `TEXT` |
| `createdAt` | Creation timestamp; no `updatedAt` |

Use `@@unique([modePromptVersionId, sha256])`. A database trigger rejects
updates to identity or text. On reuse, compare the stored and candidate strings
byte-for-byte. A hash match with different text is corruption or collision and
fails closed.

### `ChatMessage`

Add nullable `effectiveSystemPromptId`, its optional relation, and an index.
Use `onDelete: SetNull` so an unsupported catalog deletion cannot delete
message history independently. New assistant finalization requires a non-null
ID in application code; historical and user messages remain nullable.

## Canonical default and compatibility projection

Move the authored tutor text into one server-only shared module owned by
`@klicker-uzh/prisma`, beside the catalog service. The existing Chat app
prompt module reuses that constant and keeps presentation descriptions outside
the authored text. The constant is used only to initialize a mode. Generation
after P2 never consults a rolling default.

The P1 migration embeds a frozen copy of the tutor text. That literal is
historical migration data, not a second rolling source. The migration proof
compares the resulting tutor v1 with the shared constant at introduction time;
future default changes intentionally require explicit new versions and do not
rewrite the old migration.

Keep `Chatbot.systemPrompts` as a compatibility projection for at least one
full release:

- new tables are authoritative;
- accepted authored changes update the active pointer and explicit JSON prompt
  atomically;
- existing descriptions and unrelated mode entries are preserved;
- null/empty tutor fallback remains a semantically equivalent legacy sentinel
  during the compatibility release, avoiding a new prompt-text response in the
  current participant config endpoint;
- do not change the canonical fallback constant during that mixed-version
  release;
- do not enable, disable, or retire modes while old and new runtimes are mixed.

The initial backfill preserves current supported-mode behavior:

- if `systemPrompts` is an object with at least one key, materialize exactly
  those mode keys;
- otherwise materialize the built-in fallback keys, currently only `tutor`;
- an explicit empty tutor prompt snapshots the tutor fallback;
- an explicit empty non-tutor prompt snapshots the empty string;
- do not add tutor to a chatbot whose non-empty JSON does not expose tutor.

## Transactional writer contract

Add one internal catalog service in
`packages/prisma/src/chatbotPromptCatalog.ts`. It accepts the repository's
transaction client and exposes no GraphQL prompt-authoring operation yet.

### Initial mode creation

In one transaction:

1. lock the chatbot;
2. create or validate the stable mode;
3. create version 1;
4. set the same-mode active pointer;
5. update the semantically equivalent JSON compatibility projection when an
   explicit projection is required;
6. commit only when all invariants hold.

An idempotent initializer may no-op only when identity, active text, and the
legacy projection are semantically equivalent. A disagreement fails and
requires explicit reconciliation; it never invents history.

### Accepted authored change

In one transaction:

1. lock the chatbot, then the mode, in that stable order;
2. reject a missing or retired mode;
3. calculate `MAX(version) + 1`;
4. insert the new immutable version even when text is unchanged;
5. update the active pointer;
6. update only that mode's explicit JSON prompt while preserving presentation
   metadata and other modes;
7. commit atomically.

The chatbot lock serializes JSON changes across different modes and prevents a
lost read-modify-write update. Presentation/status helpers do not create prompt
versions.

Update PR #5460's `createChatbot`, the development seed, and the Playwright
fixture to create valid catalog state. Existing prompt compiler behavior
remains active throughout P1.

## Expand, catch-up, and audit

### P1 expand migration

The first migration:

- creates the mode enum, catalog tables, constraints, immutability/key
  triggers, nullable message FK, and index;
- validates that legacy `systemPrompts` is null or an object and that each
  materialized mode entry is null or an object with string/null prompt and
  description values;
- backfills the exact current mode set and version-1 fallback semantics;
- stores presentation description on the mode;
- sets every active pointer to its own version 1;
- leaves legacy JSON unchanged;
- leaves every historical message reference null;
- performs no destructive drop, rename, or narrowing.

Malformed input aborts the migration transaction before partial catalog state
commits.

### P2 catch-up migration

P2 includes a data-only catch-up migration before runtime cutover. It
initializes deterministic catalog rows for chatbots created by old pods during
the P1 PreSync-to-new-pod window. It fails on an existing catalog/JSON
disagreement and never rewrites an authored history.

This closes the normal deployment race. It does not make an independent
JSON-only operational writer safe.

### Audit script

Add a values-free, dry-run-by-default Prisma Data audit/bootstrap script. It
reports counts and booleans only for:

- chatbots with no materialized current modes;
- enabled modes without a same-mode active version;
- active pointers with sequence gaps or cross-mode targets;
- active authored text that is not semantically equivalent to its legacy
  projection;
- messages whose effective reference crosses chatbot lineage;
- malformed or unsupported legacy JSON.

An explicit `--apply` may initialize only wholly missing, deterministic
catalogs. Any disagreement remains fail-closed. This task runs the script only
against its disposable synthetic database; live use needs separate authority.

## Runtime cutover

P2 orders the request path as follows:

1. authenticate and parse;
2. load the chatbot, requested mode, its active authored version, and MCP
   configuration;
3. require mode `ENABLED`, a non-null same-mode active pointer, and immutable
   authored text;
4. reject an already claimed assistant-message ID;
5. resolve the request's actual MCP tools;
6. compile the exact final instructions from authored text, the conditional
   citation contract, and the unconditional language contract;
7. resolve the model, allow-list, participant-credit fallback, account usage,
   and owning thread;
8. hash and persist/validate the effective prompt;
9. build independent prompt-cache metadata when default routing uses it;
10. run image-description `generateText`, persist the user message, and start
    `streamText`.

The effective resolver runs for custom routing as well as default routing.
Failure to resolve or persist mode/version/effective provenance returns a
stable internal server error before either model call. The effective record
may exist without a message when later validation or generation fails; it is a
valid immutable catalog entry and needs no garbage collection in v1.

Pass `effectiveSystemPromptId` into `finalizeChatTurn`. Its transaction
writes the reference with the assistant message and account usage for both
success and abort.

The duplicate path may return `duplicate` only when role, thread, chatbot,
owner, and the same non-null effective ID all match. A null or different
effective ID is a turn conflict and never charges again. If finalization
fails, no assistant row is persisted; existing response-stream error behavior
otherwise remains unchanged.

Keep the participant history projection and `ApiMessage` DTO unchanged.
Internal request telemetry may include IDs and the stored SHA-256, but never
full prompt text.

## Internal export contract

Extend
`packages/prisma-data/src/scripts/2026-06-16_analyze_chatbot_usage.ts` with
relational provenance:

- authored-version rows: pseudonymous chatbot key, mode key/status, version
  ID/number, active flag, and creation time;
- effective rows: effective ID, authored-version ID, SHA-256, and creation
  time;
- message metadata: pseudonymous message key and nullable effective ID.

Prompt text is never repeated in message rows. Full authored/effective text is
included once per catalog row only under a dedicated opt-in content flag,
written to the operator-selected output directory, and never printed to the
console. Historical nulls stay explicit.

## Stack topology

| Layer | Local base | Branch | Independently shippable contract |
| --- | --- | --- | --- |
| P1 catalog foundation | exact U3 `d386d164` | `rs/chat-system-prompt-versioning` | additive catalog, initial backfill, canonical default, atomic writers, compatibility behavior, fixtures, audit; old runtime still generates from JSON |
| P2 runtime provenance | verified P1 tip | `rs/chat-effective-prompt-provenance` | catch-up migration, authoritative runtime resolution, effective records, assistant FK finalization, internal export |

This dependent extension avoids parallel edits to the same schema, route, and
U2 finalizer. It does not mutate any existing branch in stack #5476.

If the existing stack merges before publication, re-evaluate and ask before
rebasing these layers onto current `v3`. Publishing into or alongside stack
#5476 remains withheld.

## Feature-wide test portfolio

| Consequential risk | Obligation and primary seam |
| --- | --- |
| Legacy migration changes prompt meaning | Isolated U3-to-P1 migration fixture: null/empty JSON, explicit and empty tutor, explicit empty custom mode, non-empty JSON without tutor, descriptions, malformed values, active pointers, and historical null messages |
| Mixed-version creation leaves missing rows | Simulate old-pod chatbot creation after P1 migration; P2 catch-up creates exactly version 1 and stops on disagreement |
| Catalog identity mutates or crosses modes | PostgreSQL tests for immutable key/content/text, same-mode active pointer, cascade behavior, and message `SetNull` |
| Accepted changes lose versions | Database tests for initial creation, identical re-authoring, concurrent monotonic versions, rollback, metadata-only changes, and JSON semantic parity |
| Runtime consults a rolling fallback | Compiler tests accept resolved authored text and contain no request-time default lookup |
| A model runs without provenance | Route tests cover default/custom routing, image description, disabled/retired mode, missing/wrong active version, effective-write failure, and hash mismatch; neither `generateText` nor `streamText` is called |
| Effective identity is too broad or narrow | Same version/text deduplicates; changed final text differs; equal final text under two authored versions differs; non-rendered tool/model changes do not affect identity |
| Success/abort or retry loses identity | Extend account-usage integration and route lifecycle tests: both terminal paths store the FK, post-abort end skips, same-ID retry does not recharge, different/null prompt identity conflicts |
| Internal fields leak publicly | Exact participant history key assertion and unchanged DTO/GraphQL surface |
| Export duplicates prompt content | Two messages share one effective catalog row; one historical message stays null; content appears once only when opted in |
| Chatbot/mode lifecycle loses lineage | Disable/retire retains versions; chatbot deletion removes modes/catalog/messages; no tombstones remain |

## Slices and commit boundaries

### S0 — approved plan checkpoint

- Write this plan only.
- After Gate 1 and the authorized rebase, commit:
  `docs(project): add chatbot prompt versioning plan`.
- No implementation begins before approval.

### P1 / S1 — immutable catalog and migration

- Add the shared default, enum/models/message FK, expand migration, analytics
  mirror, triggers, and migration proof.
- Add ADR 0037 after rechecking all open refs.
- Update `CONTEXT.md`, `docs/domain-model.md`,
  `docs/data-and-migrations.md`, ADR discovery, and the data-model skill.
- Acceptance: migration preserves the exact supported-mode and prompt
  semantics; malformed data aborts; historical messages remain null; schema
  and analytics mirror agree.
- Commit: `enhance(chatbot): add immutable prompt catalog`.

S1 crosses architecture and data-integrity boundaries. Run simplifier and one
slice reviewer over the immutable commit; fix accepted findings in a follow-up
commit without rewriting S1.

### P1 / S2 — transactional writers and compatibility

- Add the initializer/version writer, status/presentation helpers, dry-run
  audit, and supported writer updates.
- Update `createChatbot`, development seed, and Playwright fixture.
- Acceptance: initialization is atomic and idempotent only on an exact
  semantic match; identical changes increment; concurrent changes serialize;
  projection updates preserve unrelated metadata.
- Commit: `enhance(chatbot): version authored prompts atomically`.

Run simplifier and a data-integrity/idempotency slice review. Then verify P1
independently over `d386d164..P1`.

### P2 / S3 — authoritative runtime and effective records

- Create P2 from the verified P1 tip.
- Add the catch-up migration and effective-prompt resolver.
- Change the compiler to accept resolved authored text and reorder all model
  paths behind the provenance barrier.
- Update compiler, route, custom-routing, image-description, and failure tests.
- Update `docs/chat-platform.md`, the HITL roadmap, testing guidance when
  materially changed, and relevant skills. The wiki bundle intentionally has
  no central log file.
- Acceptance: no assistant model call occurs without a persisted and validated
  effective record; participant response shape is unchanged.
- Commit: `enhance(chat): persist effective prompt provenance`.

Run simplifier and one architecture/data-integrity slice review.

### P2 / S4 — assistant lifecycle linkage

- Require the effective ID in U2's finalizer input, assistant create, and
  duplicate validation.
- Cover successful, aborted, duplicate, and mismatch paths.
- Acceptance: every newly persisted assistant output references the exact
  effective record and charging remains once-only.
- Commit: `enhance(chat): link assistant turns to effective prompts`.

Run simplifier and one idempotency/data-integrity slice review.

### P2 / S5 — internal analytics/evaluation export

- Extend the existing usage analysis with IDs, catalog rows, explicit unknowns,
  and opt-in prompt content.
- This bounded public-repository task may use one native executor after the P2
  schema is stable. It owns only the script and focused tests; the main session
  reviews and integrates it serially.
- Acceptance: prompt text occurs once per catalog row, never per message or
  console output; pseudonymous message keys and null history remain intact.
- Commit: `enhance(analytics): export prompt provenance`.

Run simplifier and a privacy/data-boundary slice review.

### S6 — integrated verification and closeout

- Run separate P1 and P2 checks, integrated top checks, exact diff/secret/PII
  inspection, and the final reviewer.
- Update this plan's Progress with exact commits, commands, results, review
  dispositions, and remaining release blockers.
- Commit documentation/evidence only when needed:
  `docs(project): record prompt provenance verification`.

## Verification

Use the exact task DevPod and stop it after the final runtime-dependent check.
The plan approval explicitly covers destructive reset/reseed only for that
isolated disposable database with synthetic fixtures.

P1 verification:

- generate the Prisma client;
- apply the isolated U3 baseline, insert representative legacy fixtures, and
  deploy P1 migrations once;
- rerun the idempotent initializer/audit and verify no changes;
- run `pnpm run prisma:sync` and the sync check;
- run focused catalog/GraphQL database tests;
- run affected package checks and builds;
- validate ADR/wiki links and format changed Markdown.

P2 verification:

- prove the P1-old-pod-to-P2 catch-up fixture;
- run the complete Chat unit suite and account-usage integration suite;
- run focused Prisma Data script tests and package check;
- run `pnpm run check:all`;
- run `pnpm run build`;
- run bounded Opengrep on changed runtime/data files if the installed binary is
  available;
- inspect staged content for secrets and real personal data before every
  commit.

No browser or Playwright journey is required because this package adds no
user-visible UI, selector, authentication flow, or participant API field. The
Playwright fixture must still compile under repository checks.

Each substantive slice receives the full-path simplifier. Each data,
architecture, idempotency, or privacy boundary receives one slice reviewer.
After all corrections and verification, run one final reviewer over
`d386d164..P2`. Reviewer advice is verified before application.

## Rollout, rollback, and release conditions

These are recorded for later delivery; no deployment is authorized here.

P1 release conditions:

- the existing U1-U3 stack base is refreshed or accepted by its owner;
- PR #5460's GitGuardian failure is cleared or explicitly dispositioned;
- all active prompt writers are inventoried;
- the optional JSON-only provisioner is adapted in its owned branch or disabled;
- after old pods drain, the values-free audit reports no missing catalog,
  pointer, projection, or sequence invariant.

P2 release conditions:

- P1 has completed at least one environment rollout;
- P2 catch-up and post-rollout audit are clean;
- no JSON-only writer remains;
- no mode status transition occurs while P1 and P2 pods are mixed;
- both image-description and main model call order are proven;
- source, migration, deployed revision, and live runtime evidence remain
  separate.

Rollback is app-only:

- never roll migrations back or delete catalog data;
- rolling P1 back uses the unchanged legacy JSON path;
- rolling P2 back returns generation to P1's JSON path;
- messages generated during a rollback window may remain null/unknown and are
  never inferred later;
- removing `systemPrompts` is a later contract migration after old-consumer
  proof and separate approval.

## Estimate

Approximately 7-10 engineering days if the isolated migration environment and
existing U3 tests remain healthy. Add 1-3 days if the existing stack needs a
conflict-heavy refresh or the separately authorized provisioner must be
adapted.

## Progress

- 2026-08-23: product/domain grill completed. The user approved authored and
  effective identities, historical nulls, first-class mode lifecycle,
  fail-closed provenance, separate example semantics, and chatbot-scoped
  deletion.
- 2026-08-23: authoritative reads covered `v3`, PR #5460, stack #5476, U3
  schema/runtime/finalizer, prompt writers, analytics export, ADR claims, and
  repository skills.
- 2026-08-23: configured planner returned `DONE_WITH_CONCERNS`; all three
  required corrections are incorporated and its behavior-changing tutor/JSON
  suggestions are dispositioned above.
- Current boundary: waiting for Gate 1 approval of this plan. No implementation
  file, branch base, remote branch, PR, deployment, or live data has changed.
