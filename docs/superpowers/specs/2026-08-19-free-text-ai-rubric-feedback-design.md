# Free-Text AI Rubric Feedback Design

## Goal

Make the revealed free-text solution explain each rubric score with useful AI
feedback, and prove the result in the pull request through screenshots of the
complete student view rather than isolated feedback-panel crops.

## Scope

This refinement affects the participant Practice Quiz presentation and its
deterministic Playwright fixture. It does not change the evaluator, GraphQL, or
persistence contracts. It does not add conversational follow-up, regenerate
feedback, or expose evaluator metadata and raw JSON.

## Student flow and layout

Before solution authorization, the participant continues to see only the generic
outcome and the server-provided retry/reveal actions. After a correct result or the
existing **Show solution** action authorizes details, **View explanation** reveals the
reference solution and the full rubric presentation.

The rubric presentation retains its three layers:

1. the aggregate criterion count and segmented status indicator;
2. the always-visible overview of every criterion and achieved level; and
3. an accessible disclosure card for each criterion.

Each expanded criterion card contains one visually distinct **AI feedback** callout:

- **Why this score** renders the matching rubric assessment's required `rationale`;
- **How to improve** renders the matching optional feedback proposal's `feedback`;
- when no matching feedback proposal exists, the score rationale remains visible and
  no empty improvement section or invented text is rendered.

The first criterion remains expanded initially. All disclosures remain keyboard
operable through native `<details>` and `<summary>` elements. Existing KlickerUZH
spacing, typography, UZH colors, and design-system conventions remain unchanged.

## Data mapping

`FreeTextEvaluationResult` already carries both inputs needed by the UI:

- `rubric_assessments[].rationale` is the human-facing explanation of the evidence
  weighed before selecting that rubric's score;
- `feedback_proposals[].feedback` is the participant-facing feedback synthesis for
  the same `rubric_id`.

The participant component matches assessments and proposals by `rubric_id`. It
accepts only non-empty strings and otherwise fails closed to the required rationale.
The content is generated in the configured question language; UI labels continue to
follow the participant interface locale.

The solution-authorization boundary does not move. Structured results and feedback
proposals remain unavailable to the component until the server authorizes detailed
solution access.

## Deterministic evidence

The semantic evaluator fixture will return one feedback proposal per synthetic
rubric. Its German rationale will explain the observed evidence for the score, and
its feedback will provide a concise next step. The mixed partial scenario will still
produce two met, one partially met, and one open criterion.

The primary pull-request screenshots will show the complete participant question
state at desktop and mobile widths, including:

- question and submitted answer;
- generic partial outcome and available actions;
- revealed reference solution/explanation;
- all-rubric summary and overview; and
- at least one expanded criterion with its score explanation and AI improvement
  feedback.

The isolated rubric-panel screenshots will no longer be the primary evidence.

## Verification

Focused Playwright coverage will assert that every criterion remains visible, that a
matching feedback proposal appears in the corresponding disclosure card, and that
keyboard expansion still works. Shared-components, PWA, and Playwright type checks,
formatting, lint, `git diff --check`, and focused OpenGrep will run before commit.

Browser verification will exercise the real PWA at desktop and mobile widths, check
the German question-language content in an English interface, confirm the complete
student view has no horizontal overflow, and produce the replacement PR screenshots.
