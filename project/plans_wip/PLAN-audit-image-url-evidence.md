# URL-only image audit evidence

## Goal and contract

The user confirmed the supervisor decision: retaining an image URL is sufficient.
LiveQuiz baselines and ElementInstance change events preserve URLs in normalized
content. Coverage does not guarantee historical image bytes. Remove image capture
from creation, rollout, reopening and single/bulk instance refreshes.

## Scope

GraphQL services, focused tests, existing audit documentation and removal of the
superseded draft source-account environment configuration. No schema, UI, auth,
permission, gamification, seed, queue or Hatchet workflow changes. Existing
owner authorization and transactional evidence checks remain. Historical media
schemas/adapters/retention stay supported; no data repair or deployment.

## Verification and progress

- Removed media dependencies and refresh staging; URLs remain hashed content.
- Added synthetic activation/reopening cases for inaccessible question,
  explanation and feedback images and URL-change evidence.
- Removed the draft additional-source-account helper and Helm/Turbo settings.
- Docker access returns EOF; the previous test container cannot be reached.
  Package tests/typechecks require that environment; no stack is started.
- Independent native review found a stale helper reference in a legacy test;
  replaced it with explicit hosts. No other concrete defects found.
- Biome and diff whitespace checks passed (existing lint warnings remain).
- Independent native review completed. Implementation stays in main because
  there is no external-model opt-in for this worktree; no external executor or
  simplifier is used for this contract change.
