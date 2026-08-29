---
type: Execution Plan
title: Align question-generation source identity with native graph artifacts
description: Preserve strict evidence validation while mapping native knowledge-graph sources to the canonical resourceId.md filenames emitted by the graph worker.
timestamp: '2026-08-29'
tags:
  - knowledge-base
  - knowledge-graph
  - question-generation
  - provenance
---

# Align question-generation source identity with native graph artifacts

Status: approved and in execution

## Plan identity

| Item | Value |
| --- | --- |
| Repository | `uzh-bf/klicker-uzh` |
| Target | `origin/v3-ai@609000ea9626e3fef2e713768ca2a796cac2f9a4` |
| Worktree | `trees/rs/qg-source-filename-contract` |
| Branch | `rs/qg-source-filename-contract` |
| Execution owner | This task |

## Goal

Make native knowledge-graph question generation accept evidence emitted against the graph worker's canonical `${resourceId}.md` source artifact. Keep the existing strict, extension-aware source matching so evidence cannot refer to an unrelated file.

The first successful outcome is one focused regression, the smallest source mapping correction, matching engineering guidance, repository-native verification, independent provenance review, and one draft PR against `v3-ai` with exact-head CI evidence.

## Evidence and decision

- The successful demo graph build registered resource `2be66612-f874-4100-afe4-036e142f82b6` from an original PDF.
- The graph worker canonicalized the source artifact to `2be66612-f874-4100-afe4-036e142f82b6.md`, as required by its native-source contract.
- Klicker's question-generation snapshot retained the original `.pdf` basename, so the strict artifact parser rejected the worker's `.md` evidence as unregistered.
- Native graph source descriptors do not send a custom output name. Their stable provider-side filename is therefore `${resourceId}.md` for both uploaded and URL resources.

Decision: map every native question-generation source snapshot to `${resourceId}.md`. Do not relax evidence validation, strip extensions, accept arbitrary basenames, or alter provider contracts.

## Product primitive and ADR gates

This is an internal provenance-contract correction. Knowledge bases, graph builds, generated elements, permissions, lifecycle states, and user controls do not change. The Manage UI will continue to show the human title and may show the canonical artifact filename beneath it.

No ADR is required. The change aligns Klicker with an existing provider contract, introduces no new domain concept, and is reversible.

## Non-goals

- No graph-worker or question-generation provider change.
- No weakening of strict source, digest, build, page-range, or evidence validation.
- No database migration, GraphQL schema change, new dependency, or UI redesign.
- No merge, deployment, staging retry, second graph build, production action, secret access, cleanup, deletion, or force-push.
- No integration of the unrelated primary-checkout branch or legacy `dev` branch.

## Execution contract

- The user's approved goal authorizes the named source, tests, documentation, plan, local runtime verification, conventional commits, normal branch push, draft PR creation against `v3-ai`, review corrections, and exact-head CI readback.
- The isolated worktree remains on the recorded fresh `v3-ai` base. Later target drift is reported at the merge boundary rather than integrated repeatedly.
- The exact task runtime may be started only for repository-native tests and browser proof. It must be stopped and verified stopped when runtime-dependent checks finish.
- The primary checkout is unrelated and remains untouched. Its current `docs/chatbot-hitl-config-roadmap` branch is one commit ahead and 122 commits behind `origin/v3`; integrating it is outside this plan.
- Pause on an unexpected provider-contract change, migration requirement, material UI redesign, source outside the named seams, or a need to cross any withheld boundary.

## Skill and review routing

- `$diagnosing-bugs` established the failing cross-system contract before implementation.
- `$rs-sliced-development-workflow` owns this full-path, one-slice package and its finish gate.
- `$klicker-graphql-api` owns service and package verification guidance.
- `$klicker-testing-verification` owns focused and package-level evidence.
- `$klicker-wiki-maintenance` requires a durable worker-contract note in `docs/async-and-workers.md` and a matching troubleshooting note in the GraphQL skill. Reserved `docs/index.md` and `docs/log*` paths remain absent.
- `$rs-local-runtime-lifecycle` and `$devrouter` own the exact local runtime start, browser proof, and shutdown.
- `$rs-model-routing` owns independent review routes.

The planning reviewer returned `DONE_WITH_CONCERNS`. Its canonical mapping, BLOB and URL snapshot tests, positive `.md` and negative `.pdf` parser tests, documentation targets, browser check, and review sequence are accepted. No separate simplifier is required if the implementation remains one direct mapping with no new abstraction.

## Delegation map

| Work item | Owner | Acceptance |
| --- | --- | --- |
| Contract regression and implementation | Main task | Red-first regression reproduces the mismatch; the minimal mapping passes it |
| Documentation and browser proof | Main task | Durable contract is documented and the rendered source label is inspected |
| Provenance/data-integrity slice review | Independent reviewer | Strict matching remains intact and both source kinds use the provider contract |
| Integrated final review | Independent reviewer | Complete branch matches this plan and verification evidence |

The implementation stays in the main task because the production fix, regression shape, and provider identity contract are one tightly coupled seam; delegation would cost more than the edit and weaken the red-first feedback loop.

## Test portfolio

| Behavior or risk | Evidence |
| --- | --- |
| Uploaded native source uses canonical identity | Focused snapshot test maps an original PDF blob name to `${resourceId}.md` |
| URL native source uses canonical identity | Focused snapshot test maps an HTML URL to `${resourceId}.md` |
| Provider `.md` evidence is accepted | Schema-v3 Plan parser test uses the snapshot produced by the service |
| Original `.pdf` basename is not treated as equivalent | Negative Plan parser test rejects the same resource UUID with `.pdf` |
| Existing provenance constraints remain intact | Existing artifact, GraphQL package, type, formatting, lint, and build checks remain green |
| Manage source label remains understandable | Local browser inspection confirms the human title and canonical filename render without layout breakage |

No lifecycle, database, or broad E2E test is added because those contracts do not change.

## Slice 1: Correct native source identity

- Add focused BLOB and URL snapshot regression tests plus positive and negative Plan evidence coverage.
- Run the focused tests before implementation and record the expected failure.
- Replace original blob/URL basename derivation with the canonical `${resourceId}.md` mapping.
- Preserve strict extension-aware artifact validation unchanged.
- Update `docs/async-and-workers.md` and `.agents/skills/klicker-graphql-api/SKILL.md` with the durable contract and troubleshooting cue.
- Run the focused tests, affected GraphQL package tests and checks, documentation validation, root checks, and build in the exact devcontainer.
- Inspect the Manage source label through the local routed app, then stop and verify the exact runtime.
- Commit as `fix(kb): align question-generation source identity`.
- Run one provenance/data-integrity slice review and one integrated final review; apply only verified findings and rerun affected checks.
- Push normally, create one draft PR against `v3-ai`, and report exact-head CI without merging.

## Acceptance criteria

- A native BLOB or URL source snapshot names its graph artifact `${resourceId}.md`.
- A valid Plan citing that `.md` source passes the existing parser.
- Evidence citing the same UUID with `.pdf` fails as unregistered.
- No validator, provider contract, schema, lifecycle, or unrelated UI behavior changes.
- The branch is clean, reviewed, pushed normally, and represented by one accurate draft PR with exact-head CI status.

## Progress

- 2026-08-29: Refreshed `origin/v3-ai` and created the clean isolated worktree at `609000ea9626e3fef2e713768ca2a796cac2f9a4`; branch and upstream were 0 ahead / 0 behind.
- 2026-08-29: Reproduced the deployed mismatch from values-free build evidence: Klicker registered an original `.pdf` basename while the provider emitted the canonical `${resourceId}.md` evidence filename.
- 2026-08-29: Planning reviewer completed through the generic continuity route because the native planner launch misresolved its model/effort before work. All substantive findings are incorporated above.
- 2026-08-29: The red-first artifact test produced the expected four failures: BLOB and URL snapshots retained the original extension, canonical `.md` evidence was rejected, and original `.pdf` evidence was accepted.
- 2026-08-29: The one-line canonical mapping and focused regression are green: 73 artifact tests pass, including BLOB and URL mapping plus schema-v3 `.md` acceptance and `.pdf` rejection. GraphQL package check, repository build (26/26 tasks), format check, and full repository check (29/29 tasks) pass with pinned Node 24.
- 2026-08-29: The managed runtime could not start because Docker had exhausted all predefined network address pools. Devrouter stopped the exact attempt; its provider workspace is absent and it owns zero routes. Two temporary local config compatibility edits were reverted. The browser-only source-label check remains blocked without deleting or pruning another task's networks.
- 2026-08-29: The OKF validator still reports 35 pre-existing conformance errors in unrelated ADR, agent, screenshot, and solution files; it reports no error for the changed `docs/async-and-workers.md` page.
- 2026-08-29: No retry, merge, deployment, graph action, cleanup, deletion, or secret access has occurred under this plan.
