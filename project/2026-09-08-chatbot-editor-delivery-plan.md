# Deliver the chatbot editor and owner preview

## Approval summary

Deliver the four completed editor and preview commits against current `v3-ai`.
Lecturers receive clearer editing tabs, editable disclaimer starting content,
correct footer scrolling, and temporary preview conversations that obey saved
mode and model settings. Preserve current ownership, beta access, publication,
participant persistence, and retrieval-scope enforcement.

The user approved integration, affected checks, final review, and PR publication.
Active multiple-KB attachment editing is a separate planning deliverable, not a
dependency of this editor delivery. No merge, deployment, production promotion,
usage-enforcement activation, or unrelated workspace changes are authorized.
After an authorized merge, STG validation must precede production promotion.

## Execution details

Worktree: `trees/rs/chatbot-editor-delivery`, branch `rs/chatbot-editor-delivery`.
Target: `v3-ai`, verified at `df1ea25580136bf1dc70b05dc8e18a633374b371`.
Do not merge the whole previous validation branch or unrelated `v3` changes.
The original `trees/rs/chatbot-c1-standard-modes` worktree and its five local
modifications remain untouched.

Source commits: `7631d124ed`, `8771a4a55b`, `3fcf8af4e9`, and `e705a40c05`.
The previously approved editor-improvements plan and its September 6 slice
reviews remain source evidence. This user-approved delivery scope supersedes
their former integration/publication restrictions and multi-KB completion gate.

| Work | Owner | Acceptance |
| --- | --- | --- |
| Integrate existing source | Main | Four commits' changes retained; current beta gate and `kbIds` projection preserved |
| Verify integrated behavior | Main | Preview policy tests, Chat/Manage types, scoped formatting, browser editor and temporary preview checks |
| Integrated final review | Native final reviewer | Complete committed diff, applicable correctness, security, architecture and maintainability lenses |
| Separate multi-KB plan | Native planner; main arbitrates | Reuse existing ownership and retrieval contracts; explicit migration and concurrency boundaries |

Main retains integration, credentials, runtime ownership and publication because
these are coupled authority-sensitive actions. No new implementation slice is
planned; bounded corrections may be delegated when needed. Earlier simplifier
and preview slice-review reports apply to unchanged behavior. Final review is
still required for this integration.

Test obligations extend existing coverage only. Preview route tests protect
saved modes, fixed and selectable model/effort policy, owner-only access,
stateless handling and missing required Quizzer tools. Browser proof covers
tabs, disclaimer save/reload, scrolling, saved configuration and temporary
conversation switching/reload. Existing publication and KB-scope tests remain
authoritative for unchanged backend contracts.

Runtime checks use this isolated checkout and synthetic fixtures. Inject the
upstream through the host Infisical operator. Host browser/Playwright tooling
must not replace container dependencies. Stop the exact runtime after checks.

## Progress

The four source changes are staged on the current target. The only manual
integration conflict retained the newer lecturer beta-access gate and applied
the footer layout fix. The target's plural retrieval projection is retained.
Whitespace, scoped Biome, authoring-test Prettier, Chat TypeScript, Manage
TypeScript and all 15 owner-preview route tests pass. The two existing Manage
preview-access/URL Node tests pass.

The cold optional authenticated MCP fixture failed startup without disclosing
credentials. Supported shutdown and restart with `manage,chat,ai` succeeded on
the same container with no recreation and no drift. This run does not prove
real KB retrieval. Browser-only GrowthBook test routing enables AI beta for
local editor verification; no remote feature flag was changed. The unmocked
route correctly blocked authoring when the flag was unavailable.

Remaining: finish integrated browser acceptance, commit the package, obtain
integrated final review, publish the draft PR and finish the separate KB plan.
STG and production remain unvalidated.
