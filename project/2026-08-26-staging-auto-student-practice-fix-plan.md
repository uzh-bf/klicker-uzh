# Restore staging Auto routing and student practice access

## Goal

Restore the intended Luna-backed Auto model configuration on the `v3-ai`
staging branch and let every enrolled participant use the tutor-mode student
practice MCP, regardless of course-leaderboard opt-in.

## Execution contract

- **Repository:** `uzh-bf/klicker-uzh`
- **Worktree:** `trees/rs/fix-stg-auto-student-practice`
- **Branch:** `rs/fix-stg-auto-student-practice`
- **Target:** `v3-ai`
- **Fresh base:** `origin/v3-ai` at
  `b9e38e89d22c6efbf0d5be1081eff1fa23f3e94c`, fetched 2026-08-26
- **Authority:** edit, test, commit, push this branch, and create a draft PR
  against `v3-ai`.
- **Withheld:** merge, deployment, ArgoCD sync, cluster writes, secret changes,
  live database changes, and external AI-deployment repository changes.
- **Terminal:** a draft PR contains the source fix, regression coverage,
  documentation, and verified check evidence.
- **Pause:** stop if the target branch advances materially, the external
  LiteLLM deployment does not expose or authorize `klickeruzh/azure/auto-router`,
  or the fix requires a broader authentication or data-model change.

This side conversation cannot dispatch the mandatory planner and final-reviewer
passes. The PR therefore remains draft and explicitly records that review gap.

## Root cause

The `v3-ai` merge commit `d110469d1510` retained an obsolete staging model
block during conflict resolution. It preserved `gpt-5.5` as the automatic
primary and mapped `auto` to `klickeruzh/azure/complexity-router`, while current
`v3` maps the automatic primary to `auto` and the model to
`klickeruzh/azure/auto-router` with Responses API support.

The student practice lookup independently treats `Participation.isActive` as
course enrollment. That field is the course-leaderboard opt-in. Joining a
course creates a `Participation` row with `isActive: false`, so ordinary
enrolled participants are rejected before the student MCP can receive quiz
candidates.

## Product and authorization contracts

| Primitive | Existing contract | Change |
| --- | --- | --- |
| Course participation | A `Participation` row connects a participant to a course | Reuse row existence as the student-practice membership gate |
| Leaderboard participation | `Participation.isActive` opts into course points and leaderboard updates | Keep unchanged; stop using it as MCP authorization |
| Student practice MCP | Tutor-mode tool for a participant, chatbot, and matching course | Allow enrolled participants whether leaderboard-active or inactive |
| Staging Auto model | Global automatic model routed by the deployed LiteLLM Auto endpoint | Restore current `v3` Luna Auto registry values on `v3-ai` |

The participant role check, exact chatbot/course pairing, course membership,
student MCP JWT purpose and scopes, and tutor-mode gate remain unchanged. No
new primitive, schema, migration, or ADR is needed because this restores the
existing separation between enrollment and leaderboard policy.

## Implementation slices

### Slice 1: Student practice authorization

- In `getStudentMcpCoursePracticeQuiz`, select only the participation id.
- Require the participation row to exist instead of requiring `isActive`.
- Add focused database-backed coverage for an inactive enrolled participant,
  a participant without a participation row, a mismatched chatbot/course, and
  a non-participant caller where the existing seam makes those cases cheap.

Acceptance: an inactive enrolled participant receives the generated course
practice quiz, while callers outside the existing course and role boundaries
still receive `null`.

### Slice 2: Staging model configuration

- Restore the `automaticModels` and `modelRegistry` Auto entries from current
  `origin/v3` into the `v3-ai` staging values file.
- Preserve every `v3-ai`-specific MCP, KB, image-tag, rollout, and resource
  setting around that block.
- Confirm rendered environment variables select `auto`, target
  `klickeruzh/azure/auto-router`, and enable Responses API for Auto.

Acceptance: the values diff changes only the intended model block and the
rendered Chat configuration contains the three expected values.

### Slice 3: Documentation

- Update the Chat platform guide with the student-practice membership rule and
  the staging conflict-regression warning.
- Update the domain-model guide so every consumer treats
  `Participation.isActive` only as leaderboard opt-in.
- Update the relevant GraphQL skill with this authorization invariant.

Acceptance: documentation states the same boundary as the service and focused
test, with no claim that this repository proves external LiteLLM key access.

## Verification

Run container-dependent commands in the task's managed devcontainer:

1. Focused GraphQL test for the student practice access seam.
2. Render the staging chart and inspect the Chat model environment variables.
3. `pnpm run check:all`.
4. `pnpm run build`.
5. Inspect the complete diff, staged content, generated files, secrets, and
   personal data before each commit.

No browser check is required because the change has no frontend code or UI
contract. No live staging smoke is authorized by this plan; deployment and
runtime proof remain follow-up gates after merge and an authorized sync.

## Progress

- [x] Refreshed `origin/v3-ai` and created the isolated worktree at its exact
  head.
- [x] Confirmed the stale model block and the leaderboard-opt-in coupling.
- [x] Implemented the service, test, values, documentation, and skill changes.
- [x] Verified the focused GraphQL spec: 8 tests passed, including the four new
  authorization cases.
- [x] Verified the focused GraphQL type check and schema-generation check.
- [x] Rendered the staging Chat ConfigMap and confirmed `auto`,
  `klickeruzh/azure/auto-router`, and Responses API support.
- [x] Completed the repository-wide build: 26 of 26 tasks passed.
- [x] Ran `check:all`: all 29 TypeScript check tasks passed, but the command
  exited non-zero because the managed container lacks a C compiler for the
  analytics package's first-time `pandas==2.2.2` build.
- [x] Ran the wiki validator: it reported 19 existing bundle-wide frontmatter
  errors and no new error in either changed guide.
- [x] Rechecked target drift. `origin/v3-ai` advanced by one unrelated Manage
  assistant-URL commit; no changed path overlaps this package.
- [x] Committed and pushed the package, then opened draft PR #5586 against
  `v3-ai`.
