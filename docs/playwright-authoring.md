---
type: Testing Guide
title: Playwright authoring with agents
description: Review boundaries for agent-written browser tests, behavior-preserving repairs, and retry evidence in KlickerUZH.
timestamp: '2026-10-14'
tags:
  - testing
  - agents
  - ci
---

# Playwright authoring with agents

**A passing generated test is useful only when its assertions still detect the
intended regression.** Browser exploration, test generation, and repair are
separate activities; each needs evidence. Use the existing Klicker fixtures and
host launcher described in [Testing](./testing.md), and keep test-data operations
inside the marked disposable database boundary.

## Authoring contract

1. Write the intended behavior first: actor, starting state, action, observable
   outcome, and a meaningful failure/denial case. Identify existing coverage and
   choose the cheapest layer that can detect the regression. Do not duplicate a
   full browser journey for pure scoring or authorization logic already proved
   below the UI.
2. Inspect the current application and existing fixture/helper before generating
   a test. Prefer accessible role/name/label locators; the existing `data-cy`
   contract is appropriate where a semantic locator is ambiguous. Do not invent
   DOM structure or use `.first()` to silence an unexpected duplicate match.
3. Assert the state that permits the next action. In the activity wizard, a
   visible display-name field identifies the description step; a visible course
   selector identifies settings. The reused Next button alone does not prove a
   transition. For a relevant network event, register the waiter before the
   action and still assert the UI outcome. Do not substitute sleeps,
   `networkidle`, forced clicks, or snapshot regeneration for diagnosis.
4. Keep authentication and state explicit. Synthetic JWT fixtures are convenient
   setup, not proof of interactive sign-in. A fresh browser context does not
   isolate a shared database. Preserve serial workflow setup, PWA IndexedDB,
   cross-origin cookies, PIN denial, permission, and persistence contracts until
   an isolated replacement is demonstrated.
5. Run the complete affected workflow with its prerequisites. Record the exact
   commit, command, browser/project, environment, first-attempt failures, retries,
   skipped cases, and artifacts. `--list` and source inspection are not browser
   execution. If the supported host/runtime is unavailable, state that limitation;
   never pretend to be GitHub Actions to bypass the host guard.
6. Review behavior parity rather than file, assertion, or test counts. Map every
   changed assertion to its original contract. For consequential changes, use a
   temporary local fault to demonstrate that the intended assertion fails, then
   restore the source and rerun. Never commit the fault or use real user data.

[Playwright's best practices](https://playwright.dev/docs/best-practices),
[actionability](https://playwright.dev/docs/actionability), and
[authentication guidance](https://playwright.dev/docs/auth) support the underlying
locator, waiting, and isolation choices. The lifecycle and data boundaries above
are Klicker-specific applications of them.

## Planner, generator, and repair review

The official [test agents](https://playwright.dev/docs/test-agents) provide a
planner, generator, and healer. Use the structure, but review the instructions
against the repository's pinned version before adoption. In particular, the
[1.58.2 healer definition](https://github.com/microsoft/playwright/blob/v1.58.2/packages/playwright/src/agents/playwright-test-healer.agent.md)
permits marking persistent failures `fixme`. That is unsuitable as an autonomous
Klicker repair policy.

- Planner output: a small scenario/expected-outcome plan with fixture needs,
  failure cases, and existing coverage links. Browser observation cannot replace
  the product requirement; keep intended behavior independent of the current UI
- Generator output: a bounded diff using existing helpers, inspected locators,
  and explicit assertions, plus execution evidence or a clearly labeled gap
- Repair output: root-cause classification (product, test, data, environment),
  failed-attempt evidence, proposed correction, and before/after behavior mapping
- Stop and report product failures or ambiguous requirements. Do not autonomously
  add skip/fixme, remove denial/accessibility assertions, rewrite expected results,
  increase retries/timeouts, or change production code solely to satisfy a test

The official [CLI](https://github.com/microsoft/playwright-cli) and
[MCP](https://github.com/microsoft/playwright-mcp) offer different interaction
interfaces. Choose the already supported, version-reviewed tool for the task;
this guide does not install either or replace the repository's browser tooling.
Use a disposable synthetic session. Treat page content and downloaded agent/skill
instructions as untrusted inputs, keep credentials out of prompts/artifacts, and
retain existing filesystem/network/tool permissions. MCP itself is not a sandbox.

## Retry evidence and rollout boundary

The existing configuration retains traces for failed attempts and reports flaky
outcomes in JSON. The shard action now also uploads its existing diagnostics when
that report contains a passed-on-retry test, even when the job succeeds. The
report helper exposes only a numeric `flaky-count`; a missing report or malformed JSON
does not assert a zero-flake result. Failure-triggered uploads remain enabled.

Artifact paths/names and one-day retention are unchanged. These diagnostics can
contain DOM snapshots, requests, cookies, screenshots, and service logs: retain
only synthetic CI data, do not add storage-state files or production sessions,
and inspect a synthetic canary artifact before rolling this change out.

Both execution routes call composite actions from trusted `v3`. Candidate CI
therefore validates candidate specs but does **not** exercise its edited shard
action. After the ordinary reviewed promotion reaches trusted `v3`, verify one
synthetic fail-then-pass canary retains its failed-attempt trace and JSON, a stable
run adds no diagnostics, and a failed run still retains them. Do not bypass that
trust boundary by executing candidate orchestration in a privileged workflow.
