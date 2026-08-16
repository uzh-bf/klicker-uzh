# Chat recovery E2E selector repair plan

## Goal

- Problem: Two existing chat recovery journeys were reported to resolve `getByTestId` with Playwright's default `data-testid`, while the branded 404 surface emits repository-standard `data-cy` markers.
- Decision: Make only those recovery locators explicitly target their existing `data-cy` markers so the tests do not depend on config discovery.
- Non-goals: No application markup, shared component, global Playwright config, test meaning or count, dependency, product behavior, wiki, CI, or unrelated marker changes.

## Plan identity

- Plan: `project/2026-08-16-chat-recovery-e2e-selector-plan.md`
- Branch: `rs/fix-chat-recovery-e2e-selector`
- Target: `origin/v3`
- Base: `2d9c5d04835430301fe49da31260fe657387eb13`
- PR: none; publication is withheld.

## Research

- Evidence: `playwright/playwright.config.ts` sets `use.testIdAttribute` to `data-cy`.
- Evidence: `apps/chat/src/components/chat-recovery-card.tsx` renders the root and title markers as `data-cy`; `apps/chat/src/app/not-found.tsx` renders the home link marker as `data-cy`.
- Evidence: A fresh focused run completed database setup but could not launch because Chromium was absent. A later bounded retry could not start because devrouter reported an active workspace lifecycle at PID `28197`.
- Limitation: The original default-`data-testid` resolution could not be reproduced under the canonical package config.
- Decision: Keep the repair test-only and explicit; do not alter the correct repository convention.
- External research: none; local configuration and rendered marker contracts are sufficient.

## Primitive and architecture impact

- Product primitives: none; this is a test-locator repair with no product behavior change.
- ADRs: none affected or required.
- Security, data integrity, and cross-system boundaries: unchanged.

## Planning-stage review

- Specialist: read-only planner fallback, recorded at `project/_local/reviews/2026-08-16-chat-recovery-selector-planning.md`.
- Status: `DONE_WITH_CONCERNS`.
- Accepted: explicit `data-cy` locators in the five recovery assertions; plan-file exception required by the delegation contract; bounded runtime attempt with an explicit residual blocker.
- Routing limitation: the configured planner route rejected its injected effort; the read-only planner role ran on `combo/glm-5.3` at `max`.

## Delegation Map

| Workstream | Slice | Owner | Dependency | Acceptance |
| --- | --- | --- | --- | --- |
| Recovery selector repair | S1 | `main` | Committed plan | Only five recovery locators change; static checks pass; focused Chromium passes or the existing runtime blocker is recorded. |

- Execution-tier skip reason: delegation costs more than this mechanical micro edit.

## Test portfolio

| Risk or behavior | Existing evidence | Obligation | Primary seam | Distinct failure | Slice |
| --- | --- | --- | --- | --- | --- |
| Branded 404 recovery markers remain locatable for unknown and malformed chatbot links | Two existing Chromium journeys in `playwright/tests/Y-chat.spec.ts` | Extend existing | Existing E2E assertions | Config discovery makes `getByTestId` fall back to `data-testid` and miss `data-cy` | S1 |

- New tests: none; the existing journeys already cover status, visibility, title, and recovery action.

## S1 — Make recovery markers configuration-independent

- Route: `main`.
- Problem: The five recovery marker lookups depend on Playwright's configured test-ID attribute being discovered.
- Do: Replace only those lookups with explicit `[data-cy="..."]` locators in `playwright/tests/Y-chat.spec.ts`.
- Preserve: Both test names, HTTP 404 assertions, text assertions, test count, and application files.
- Check: `git diff --check`; targeted Prettier; Playwright package TypeScript check; one focused Chromium attempt if devrouter is immediately available.
- Commit: `test(chat): target recovery data-cy markers explicitly`.
- Simplifier: not required; mechanical test-selector edit.
- Slice review: not required; no risk boundary changes.

## Progress

- Status: `DONE_WITH_CONCERNS`; the approved repair is complete at the verified-local-commits boundary.
- Completed: takeover validation, contract hash verification, live base/fetch check, selector convention inspection, planning-stage review, plan commit `ce560a2fc`, implementation commit `25fc24f88`, and the combined final review.
- Remaining: real Chromium execution when the existing DevPod lifecycle lock is cleared; no further work is authorized in this delegation.
- Latest verification: `git diff --check`; Prettier passed for `playwright/tests/Y-chat.spec.ts` and this plan; TypeScript passed for `playwright/tsconfig.json`; Playwright discovery listed 81 Chromium tests including both recovery journeys. The Node-based checks ran through their installed binaries under the DevPod's Node 24 runtime because the container `pnpm` wrapper requested a non-interactive module purge.
- Test delta: added 0, changed 2 existing E2E journeys, removed 0.
- Simplifier: not required — mechanical test-selector edit.
- Slice review: not required — no security, data-integrity, architecture, cross-system, irreversible, or other named risk boundary changed.
- Combined final review: `DONE_WITH_CONCERNS`; the only finding was this stale progress record, now corrected. The configured final-reviewer route rejected its injected effort, so the read-only final-reviewer role ran on `combo/glm-5.3` at `max`; its report is recorded at `project/_local/reviews/2026-08-16-chat-recovery-selector-combined-final.md`.
- Runtime gate: focused Chromium is not proven because the bounded attempt found devrouter's existing workspace lifecycle lock at PID `28197`; environment repair is out of scope for this resumed task.
- Required delivery layer: verified local commits.
- Achieved delivery layer: verified local commits.
- Withheld: push, PR, merge, deployment, cluster access, cleanup, and any other work item.
