# Derive the standard knowledge-base binding from KB links

## Approval summary

**Why and what changes?** A chatbot that answers from a course knowledge base (KB)
today needs one stored Doc Query MCP configuration row per chat mode. Lecturers
see these as duplicate "MCP entries" for Tutor and Explainer, while Quizzer and
custom modes silently inherit them. On `v3-ai`, `KBChatbot` already records which
KB a chatbot uses, and the per-mode rows are a copy of it written by the KB
attach flow. This plan makes the enabled `KBChatbot` links the only source of the
standard `doc_query` binding. Chat derives one binding for every mode at request
time. Stored `ChatbotMCPConfig` rows remain only for custom MCP servers.

**What stays unchanged?** The scope-token transport, the scoped production route,
the KB attach and detach UI, custom MCP servers, and every published chatbot's
retrieval behaviour during the transition.

**What could change the decision?** A read-only production audit on 2026-10-14
found that only 18 of the 40 chatbots with an enabled KB row have a matching
`KBChatbot` link. 21 point at legacy Doc Query corpora that have no Klicker `KB`
record, and 1 has a KB record but no link. The plan therefore backfills a Klicker
`KB` record for each legacy corpus, reusing the corpus ID that the scope token
already carries. No corpus is shared between lecturers, so each record has one
clear owner.

Today a missing per-mode row also hides that mode. Once mode visibility comes
only from the mode configuration, 12 published chatbots would gain standard
modes they do not offer now: 4 tutor-only chatbots would gain Explainer, 4
custom-mode chatbots would gain Tutor, and 4 more would gain Tutor, Explainer
and Quizzer. Two product rulings remain, with recommendations:

- Legacy corpora become visible KBs in the owning lecturer's KB list
  (recommended: yes, because it shows what grounds the chatbot).
- The backfill writes explicit mode flags that keep every chatbot's offered
  modes exactly as they are today (recommended), instead of letting the 12
  chatbots gain modes.

**How will we know it is done?** Every published KB chatbot resolves its binding
from links in staging and production. Unit and route tests cover the derived
binding. The manage UI shows one knowledge-base binding instead of per-mode
rows. A post-soak audit finds no enabled per-mode KB rows that Chat still reads.

**What does approval authorize?** Implementation, tests, docs, ADR, local
commits, task-branch pushes and draft PRs into `v3-ai`, plus dry runs of the
backfill against development and staging. Withheld: the production backfill
apply, production row disabling or deletion, marking PRs ready, merging and
deployment. Each of those needs a separate, named approval.

## Execution details

### Evidence

- `KBChatbot` (`packages/prisma/src/prisma/schema/knowledge.prisma`) links
  `kbId` and `chatbotId` with `isEnabled`. `attachKbToChatbot`
  (`packages/graphql/src/services/knowledge.ts`) disables other links, upserts
  the link and writes Tutor and Explainer `KB` rows with
  `{ required: true, toolAlias: 'doc_query', kb_id }`. Detach and KB deletion
  disable the rows when no enabled link remains.
- The `kb_id` scope claim equals `KB.id`. Doc Query indexes Klicker-native KBs
  under the same UUID, so a backfilled `KB` record with the legacy corpus UUID
  keeps the scope token identical.
- Deleting a KB queues external deletion only for its `KBResource` rows. A
  backfilled record without resources is therefore soft-deleted in Klicker only;
  slice 3 adds a test that pins this.
- Chat reads bindings through `resolveEffectiveMCPConfigurations`
  (`apps/chat/src/lib/server/effectiveChatModes.ts`) and asserts scope in
  `resolveMcpScope` (`apps/chat/src/services/mcpScope.ts`). Callers: the chat
  route, the owner preview route, the chatbot layout and the bootstrap route.
- Manage shows stored rows in `ChatbotDetails.tsx` and in the publication review
  `tools` list (`packages/graphql/src/services/chatbots.ts`). Lecturers cannot
  edit rows; only operators and seeds write custom MCP rows.
- Production audit, 2026-10-14, values-free (counts only, enabled `KB` rows):

  | Group | Chatbots | Stored modes |
  | --- | ---: | --- |
  | Linked Klicker KB | 14 | Tutor + Explainer (11 published, 3 draft) |
  | Linked Klicker KB | 4 | `assistant` custom mode only |
  | Legacy corpus, no `KB` record | 13 | Tutor + Explainer |
  | Legacy corpus, no `KB` record | 4 | Tutor only |
  | Legacy corpus, no `KB` record | 4 | `default` and three `tutor*` variants |
  | Klicker KB without link | 1 | one custom mode |

  Every binding uses a single `kb_id`; none uses `kb_ids`. No chatbot has a link
  without an enabled row. The 40 chatbots use 30 distinct KB IDs; 4 IDs are
  shared by 2–4 chatbots, always of one owner, and no existing `KB` record has
  a different owner than its chatbots.
- Mode configuration of the 13 published chatbots without a stored Explainer or
  standard-mode row: 4 tutor-only (legacy flags, all standard modes on), 4
  `assistant` (typed flags, Tutor on), 4 `default`/`tutor*` (legacy flags, all
  standard modes on), 1 `ethik-rollenspiel` (all standard modes off). The only enabled non-`KB` rows are 4 `Klicker-compat`
  rows on the two chatbots paused on 2026-10-13.
- PR [uzh-bf/klicker-uzh#6501](https://github.com/uzh-bf/klicker-uzh/pull/6501)
  lets Explainer inherit Tutor's row. It is the interim step; this plan makes it
  unnecessary once slice 2 lands, and slice 2 removes its inheritance branch if
  #6501 merged first.
- [uzh-bf/klicker-uzh#6506](https://github.com/uzh-bf/klicker-uzh/pull/6506)
  (on `v3-ai` since 2026-10-14) stops forcing a retrieval call on the first step
  of custom modes. The binding stays required; this plan keeps that split.

### Binding contract

- **Source:** enabled `KBChatbot` links whose `KB` is not deleted and whose KB
  owner equals the chatbot owner. One link yields `kb_id`; several yield sorted
  `kb_ids` (at most 32, the existing bound). An owner mismatch or an
  out-of-bound set fails closed as `503 REQUIRED_MCP_UNAVAILABLE`.
- **Server:** the active MCP server named `KB`. The deployment's
  `docQuery.scopedMcp` binding keeps routing that server to the scoped route.
- **Derived configuration:** `allowedTools: ['doc_query']`, parameters
  `{ required: true, toolAlias: 'doc_query', kb_id | kb_ids }`, priority 0,
  tagged with the selected mode. It applies to Tutor, Explainer, Quizzer and
  every offered custom mode.
- **Mode control:** a mode's visibility comes only from the standard and custom
  mode configuration. There is no per-mode KB opt-out after the transition. The
  backfill freezes today's visible modes into explicit flags first, so no
  chatbot's offered modes change.
- **Custom modes:** the binding stays required, and #6506's optional first-step
  retrieval for custom modes is unchanged.
- **Transition rule:** when a chatbot has a derived binding, Chat ignores its
  stored `KB` server rows. Without a derived binding, stored rows behave as
  today. This keeps unmigrated chatbots unchanged and prevents conflicting
  scope assertions.
- **Custom MCP rows:** unchanged semantics for every server other than `KB`.

### Primitive impact

| Primitive | Disposition | Contract delta |
| --- | --- | --- |
| Knowledge base (`KB`) | Extend | Can represent a legacy Doc Query corpus without uploaded resources |
| KB link (`KBChatbot`) | Extend | Becomes the authoritative standard `doc_query` binding |
| Chatbot MCP configuration | Narrow | Holds custom MCP bindings only; `KB` rows retire |
| Chat mode | Reuse | Visibility independent of MCP rows |

### ADR

The gate passes: the source of truth for retrieval authorization moves, it
surprises a reader of the per-mode rows, and it trades a visible per-mode
opt-out for one binding. Slice 1 adds the next free ADR (currently `0052`),
"The KB link is the standard knowledge-base binding", and amends ADR 0021's
inheritance bullets to reference it. Reopen if a course needs different KBs per
mode.

### Delivery topology

Four sequential PRs into `v3-ai`, each mergeable alone because the transition
rule keeps both sources valid. A native stack is not used: stack roots must
target `v3` for the final AI review, and these layers are independently safe.

1. **This branch:** plan, ADR and the derived binding in Chat (slices 1–2).
2. Writers, seeds, operator scripts and the backfill script (slices 3–4).
3. Manage and publication review show the KB binding (slice 5).
4. Retire stored `KB` rows after a release soak (slice 6, separately approved).

### Slices

Execution mode: solo (main session owns implementation and review).

1. **ADR and contract docs.** ADR 0052, ADR 0021 amendment, and
   `docs/chat-platform.md` binding section. Acceptance: docs reviewed against the
   contract above. Commit: `docs(adr): make the KB link the standard knowledge-base binding`.
2. **Derive the binding in Chat.** One loader in `apps/chat/src/lib/server/`
   reads enabled links with the chatbot and returns the derived configuration
   merged with non-`KB` rows. The chat route, owner preview route, layout and
   bootstrap route use it; `resolveMcpScope` receives the merged list unchanged.
   Acceptance: `pnpm --filter @klicker-uzh/chat test` and `check` in the
   container. Commit: `enhance(chat): derive the knowledge-base binding from KB links`.
3. **Writers stop copying.** `attachKbToChatbot`, detach and KB deletion stop
   writing `KB` rows. `seedMCPServers.ts` and `apps/chat/scripts/local-mcp-seed.mjs`
   create a `KB` record plus link for the synthetic chatbot. The cohort activation
   and canary scripts write links. Acceptance: graphql and prisma-data tests in
   CI; local `mcp` profile turn returns `KLICKER_LOCAL_MCP_OK` in Tutor,
   Explainer and Quizzer. Commit: `enhance(knowledge): bind KBs to chatbots through links only`.
4. **Backfill script.** `packages/prisma-data/src/scripts/kb-link-backfill.ts`
   with dry run by default, a manifest fingerprint, values-free receipt and one
   transaction. For each enabled `KB` row without a matching link it creates the
   missing `KB` record (ID = `kb_id`, owner = chatbot owner, name from the
   chatbot's course) and the link. For every chatbot with a stored `KB` row it
   computes the standard modes the current resolver offers and writes typed
   `standardModeConfig` flags that match them. It never enables a mode.
   Acceptance: unit tests on a synthetic fixture; dry run against development
   and staging reports the expected groups. Commit:
   `chore(prisma-data): add the KB link backfill`.
5. **Manage shows one binding.** `ChatbotDetails.tsx` and the publication review
   list show "Knowledge base: <name>" for derived bindings and list only custom
   MCP rows below. Acceptance: browser screenshots (`$rs-build-screenshot-gallery`)
   for a linked chatbot, a custom-MCP chatbot and the review page.
   Commit: `enhance(manage): show the knowledge-base binding once`.
6. **Retire stored rows** (separate package). After one release cycle with no
   chatbot reading stored `KB` rows, disable them, then delete them in a later
   release. Requires named production approval.

### Test portfolio

| Risk or behaviour | Obligation | Seam | Slice |
| --- | --- | --- | --- |
| Derived binding authorizes exactly the linked KB set in every offered mode | add new | loader + `resolveMcpScope` unit | 2 |
| Owner mismatch or deleted KB never yields a binding and fails closed | add new | loader unit | 2 |
| Stored `KB` rows are ignored when links exist and used when none exist | add new | route test with both shapes | 2 |
| Scope assertions accept the single derived configuration for every offered mode | add new | `resolveMcpScope` unit with derived input | 2 |
| Backfill keeps each chatbot's offered modes identical | add new | prisma-data script test against the current resolver | 4 |
| Custom MCP rows keep exact per-mode semantics | extend existing | `effective-chat-modes.test.ts` | 2 |
| Attach and detach no longer write rows and still gate access | extend existing | graphql knowledge tests | 3 |
| Deleting a backfilled KB never queues external corpus deletion | add new | graphql knowledge test | 3 |
| Backfill is idempotent and refuses unexpected state | add new | prisma-data script test | 4 |

No test pins UI copy; slice 5 relies on screenshots.

### Verification

Run tests and typecheck inside the devcontainer for slices 2–4 and CI for the
graphql live-database suite. Staging builds from `v3-adaptive-learning`, so
staging evidence for a merged `v3-ai` PR waits for the `v3-ai` →
`v3-adaptive-learning` sync. Browser verification for slice 5 with
`agent-browser` against the worktree stack. Production evidence for later
packages: re-run the read-only parity audit; it must report every enabled `KB`
row matched by a link before slice 6 starts.

### Authority, terminal state and pauses

- **Authority:** as in the approval summary.
- **Terminal:** slices 1–5 merged-ready as draft PRs with green CI and staging
  dry-run evidence; slice 6 parked for its own approval.
- **Pause:** the two product rulings above; any backfill dry run that reports a
  group outside the audited table; any chatbot whose derived binding differs
  from its stored `kb_id`.

## Progress

- Status: plan drafted 2026-10-14 on `enhance/chat-kb-binding-from-kb-links`
  from `origin/v3-ai` at `be6ae67368`. Awaiting approval and the two rulings.
- Planning: solo mode; no separate planner pass.
- Next action: on approval, start slice 1.
- PR: draft, see the PR that carries this file.
