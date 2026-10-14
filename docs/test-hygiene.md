---
type: Testing Guide
title: Test hygiene
description: Behavior-first review standards, safe retirement evidence, and a lightweight ownership and cadence proposal for KlickerUZH tests.
timestamp: '2026-10-14'
tags:
  - testing
  - quality
---

# Test hygiene

A cleanup is successful when it preserves or improves detection of important
failures while making tests easier to trust and maintain. Test counts, file
length, grep hits, and coverage percentages are not acceptance targets.

The [testing guide](./testing.md) describes the stack and runtime boundaries.
The [test-hygiene skill](../.agents/skills/klicker-test-hygiene/SKILL.md) gives the
repeatable audit procedure. The
[2026-10-14 review](../project/2026-10-14-test-hygiene-review.md) contains the
initial inventory, sampled findings, source research, and proposed work slices.

## What meaningful coverage protects

- Unit tests focus on logic: inputs/outputs, decisions, invariants, boundaries,
  errors and state transitions. UI-adjacent logic is still logic.
- Service/integration tests prove contracts at real boundaries: permissions,
  data isolation, persistence, transactions, concurrency and external protocols.
  Mocking a query and asserting its exact arguments is not row-level proof.
- Playwright proves consequential user journeys and browser behavior. Keyboard
  focus, accessible names, interruption, pending/error states, reload persistence,
  Back/Forward and navigation are user behavior, not disposable UI trivia.
- Class names, component structure, internal call sequences and exact copy need
  a named contract. Some protect security, valid markup, accessibility or a
  previous remount bug. Review the reason before replacing them.
- Use coverage to find unexamined risk, then test whether meaningful defects are
  detected. Never increase a coverage number by adding vacuous assertions.

## Review record

Copy this into a PR or the relevant ClickUp task for one feature slice:

- Scope, reviewer, base/head SHA, date and intended behavior
- Risk map: outcome → current test path/title → adequate layer → known gap
- Evidence: commands, environment/profile, run/attempt URLs, first-attempt
  failures/retries and durations with denominators; attach redacted traces when useful
- Finding: observed fact versus hypothesis; keep/strengthen/move/merge/retire/investigate
- Change and preservation proof: original regression, replacement/obsolete
  contract, defect/negative control that fails, restored pass and related journey
- Residual risk, never-run stages, owner and next review/expiry where applicable

The inventory command is read-only and dependency-free. Its separate test command
creates and cleans temporary synthetic Git repositories:

```bash
node util/test-hygiene-inventory.mjs --json
node --test util/test-hygiene-inventory.test.mjs
```

It reads Git-tracked paths and current working-tree contents without executing
project code. It records HEAD and a hash of the scanned contents, not a claim
that the checkout is clean; Git status/filters are not invoked. It recognizes conventional JS/TS, Python and shell test filenames;
manual smoke scripts, custom runners, generated cases, external evaluations and
untracked files require separate inspection. It includes commented code and
fixture strings in heuristic matches, emits no source snippets, and keeps active
Playwright specs separate from retained/reference specs. Exit 1 means incomplete
reads or invalid invocation, never a quality threshold. Compare snapshots only
with matching discovery scope. Runner discovery and CI execution are separate.

## Proposed ownership and cadence

These are team-review recommendations, not a new schedule or CI policy:

- Each PR: author reviews the changed behavior; reviewer checks assertions and
  preserved regression detection, especially when removing or moving coverage
- Weekly: a rotating maintainer triages first-attempt failures, retries, slow
  critical paths and aged skips; route product defects separately from harness faults
- Monthly: feature owner and reviewer audit one high-risk slice, starting with
  authorization/data integrity and the most-used lecturer/participant journeys
- After an escaped defect or framework/runtime change: refresh that slice's risk
  map, negative controls and relevant agent guidance

`CODEOWNERS` currently routes all areas to `@rschlaefli`; nominate feature owners
in ClickUp before assigning work. Keep a short backlog of actionable slices,
not a permanent spreadsheet of every assertion. Track critical outcomes covered,
first-attempt failure and retry rates with run/case denominators, representative
runtime, quarantine age and escaped regressions. Separate infrastructure failures,
conditional skips, cancellations and reused evidence from executed test results.

No quarantine, test reduction, new dependency or CI weakening follows implicitly
from this guide. Retirement requires documented equivalence or approved behavior
removal and reviewer approval; see the skill's removal gate.
