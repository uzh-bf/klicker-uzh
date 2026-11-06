## Description

<!-- Please include a summary of the change and which issue/task it fixes. List any dependencies that are required for this change. -->

ClickUp Task: [Link to ClickUp Task]

## Proposed Changes

<!-- Detail the technical changes made in this PR. -->

-

## How to Test & Verification Evidence

<!-- Describe the tests that you ran to verify your changes. Provide instructions so we can reproduce. -->

### Automated Verification

- [ ] Run `pnpm run check:all` (linting, typechecking, formatting, syncpack)
- [ ] Run target unit tests (`pnpm --filter <package> test`)

### Test Hygiene (when tests change)

- [ ] Named the behavior/risk and chose the cheapest adequate test layer
- [ ] Kept meaningful failure, authorization, accessibility/focus, and navigation coverage
- [ ] For removed, merged, or moved coverage: linked replacement/obsolete-contract evidence and a defect-detection check, or N/A
- [ ] Reported first-attempt failures, retries, skips, and never-run checks honestly

See [test hygiene](../docs/test-hygiene.md) for the review record and retirement gate.

### Manual/Visual Verification

<!-- For any UI-facing changes, please embed before/after screenshots or screen recordings using the agent-browser tool. -->

-

### Codebase Notes & Quality Check

- [ ] Updated the relevant [engineering guide](../docs/) and skill when a durable contract changed, or N/A
