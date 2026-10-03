# Plan: reduce Playwright flakiness

Status: draft for approval. Baseline: `origin/v3` at 1d3c359ffb (local ref, not
refreshed because of a metered connection).

## Goal

Retry-masked flakes and red shards stop costing reruns. Success means the top
three flaky tests produce zero retries across ten consecutive `v3` and `v3-ai`
runs, and every remaining flake is visible without reading raw job logs.

## Evidence

Source: 300 `Klicker automated testing with playwright` runs since 2026-09-01,
784 shard jobs, 750 logs analysed. CI runs with `retries: 1`, so a flake that
passes on retry stays green and is never reported.

| Test | Retries | Hard fails | Failure point |
| --- | ---: | ---: | --- |
| `Y-chat.spec.ts` "Source grouping resets when switching answer branches" | 25 | 0 | last `cited ... toHaveCount(1)` after `chat-branch-next` |
| `L-elements-case-study.spec.ts:713` validation logic | 6 | 1 | `save-new-question` still enabled after clearing the title |
| `U-catalog.spec.ts:1656` object permissions | 4 | 1 | `close-share-object` still visible after a forced click |
| `Y-chat.spec.ts` settings "Auto and fixed models" (en/de) | 0 | 2 each | `modelSection` lacks `copy.fallback` |
| 9 other tests | 1-2 each | 0 | single occurrences |

Of the 49 failed shard jobs, 39 show no failed test. They come mostly from
one feature branch (`feat/adaptive-catalyst-integration`), where Playwright
itself exited non-zero. These are branch breakage, not flakiness, and are out
of scope.

## Hypotheses (one per test, to confirm with a trace before fixing)

1. **Y-chat branch switch.** The test hovers, then clicks a hover-revealed
   branch control. When the click lands during the reveal transition, or before
   hydration (`goto` uses `domcontentloaded`), the branch does not switch back.
   An intermittent product bug in resetting source grouping is the alternative.
   The trace decides between the two.
2. **Case study validation.** `searchAndEdit` returns before the edit modal has
   loaded its initial values. A late reinitialisation refills the cleared title,
   so the save button becomes enabled again.
3. **Catalog share modal.** `click({ force: true })` on `close-share-object`
   skips actionability checks. During the open animation the click can miss and
   the modal stays open.
4. **Chat settings fallback copy.** This is consistent rather than flaky on
   affected branches. Check whether it is a real regression on those branches
   before treating it as a test problem.

## Slices

1. **Make flakes visible.** Add a short job-summary section listing every test
   that passed only on retry, parsed from the JUnit or list output that already
   exists. Acceptance: a run with a retried test names it in the summary.
2. **Fix the Y-chat branch switch.** Wait for hydration with the existing
   `waitForClientHydration`, assert the branch counter changed after each
   click, and drop reliance on hover timing. Acceptance: 30 local repeats with
   `--repeat-each` pass, and the trace shows no lost click.
3. **Fix the case study validation.** Wait until the modal shows the loaded
   title value before clearing it. Acceptance: `--repeat-each=20` passes.
4. **Fix the catalog share modal.** Replace forced clicks on the close control
   with normal clicks, or close with Escape inside `expect.toPass`.
   Acceptance: `--repeat-each=10` on the spec passes.
5. **Triage the chat settings failure** on the affected branches, then fix the
   test or file a product bug.

Slices 2-4 are independent and touch only their spec files. Slice 1 touches
the trusted shard action, so it takes effect only after it merges to `v3`.

## Out of scope

- Raising `retries` or timeouts.
- Changing shard layout or worker counts.
- Breakage on feature branches.

## Verification

Local runs use `node ./util/run-playwright-host.mjs --runtime-profile <profile>`
with `--repeat-each`. After merge, watch ten `v3` runs, using the slice 1
summary to count retries.
