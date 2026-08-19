---
type: Change Log
title: Formative free-text evaluation authoring
timestamp: '2026-08-19'
tags:
  - ai
  - grading
  - practice-quiz
  - frontend
  - analytics
---

## 2026-08-19

- Added Catalyst-entitled semantic retry configuration to Manage free-text
  authoring, including explicit question language, a lecturer-configurable 1–10
  attempt limit, solution reveal, accepted exact answers, a separate reference
  solution, rubric schema metadata, weighted rubrics and achievement levels, and
  custom outcome bands.
- Added localized English and German defaults. Enabling semantic retries migrates
  legacy solutions into accepted exact answers and deliberately leaves the
  reference solution empty for the lecturer to author.
- Preserved unknown advanced rubric fields from compatible `uzh-bf/agents` schemas
  and exposed them in a collapsed read-only view rather than silently dropping
  them.
- Kept Catalyst entitlement and evaluator availability independent. An entitled
  lecturer can configure while the evaluator is temporarily unavailable; an
  existing configuration becomes read-only after entitlement loss.
- Added aggregate first/best outcome, attempts, success, reveal, and unavailable
  counts to semantically configured Practice Quiz free-text evaluations without
  returning participant answers, rationales, confidence, or provider errors.
- Kept legacy free-text evaluation rendering and behavior unchanged when semantic
  configuration is absent.

### Verification

- Shared grading suite: 22 passed.
- Focused GraphQL retry-analytics suite: 2 passed.
- Grading build, GraphQL generation/check/build, and Manage type check passed.
- The Manage production build compiled the application successfully, then failed
  during static prerendering in the existing `_app` router hook for `/en/404` and
  `/de/resources/answerCollections` (`NextRouter was not mounted`). The emitted
  failing chunk is `_app`, not either semantic component.
- The real Manage app verified save/reopen round trips and English, German, narrow,
  and entitlement-loss read-only authoring states. Screenshots are stored under
  `project/plans_wip/assets/free-text-semantic-retries/`.
- A published synthetic Practice Quiz returned the expected zero-state aggregate
  through the real authenticated GraphQL endpoint. The pre-existing dynamic
  Practice Quiz evaluation route returned a Next.js 404 for both that fixture and
  a seeded published quiz, so analytics UI screenshot verification remains blocked
  by that route baseline rather than being represented by a misleading artifact.
