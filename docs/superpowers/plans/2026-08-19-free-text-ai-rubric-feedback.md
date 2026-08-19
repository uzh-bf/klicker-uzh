# Free-Text AI Rubric Feedback Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with the repository's
> Klicker skills. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Explain every revealed rubric score with criterion-specific AI feedback and replace cropped PR evidence with complete desktop and mobile student views.

**Architecture:** Extend the existing fail-closed participant parser to join optional `feedback_proposals` to required `rubric_assessments` by `rubric_id`. Render the rationale and optional feedback inside each authorized rubric disclosure without changing GraphQL or persistence. Exercise the existing evaluator boundary through deterministic German fixture content and capture the complete Practice Quiz state in the real PWA.

**Tech Stack:** React, TypeScript, Next.js pages router, next-intl, TailwindCSS, Playwright fixtures/tests, agent-browser, GitHub native stacks.

## Global Constraints

- Preserve the existing solution-authorization boundary; no rubric or feedback detail is visible before authorization.
- Do not change Prisma, GraphQL, Hatchet, or evaluator contracts.
- Treat `rubric_assessments[].rationale` as the required explanation of the score.
- Treat matching `feedback_proposals[].feedback` as optional improvement guidance.
- Match assessments and proposals only by exact `rubric_id` and accept only non-empty strings.
- Keep evaluator content in the configured question language and interface labels in the participant locale.
- Do not expose raw JSON, evidence identifiers, confidence, model metadata, or provider errors.
- Add no conversational follow-up or feedback-regeneration interaction.
- Use existing KlickerUZH/UZH colors, spacing, typography, and native `<details>` disclosure behavior.
- Keep every PR in native GitHub stack #5436 as a draft; update only the top participant layer.

---

### Task 1: Specify and render criterion-level AI feedback

**Files:**

- Modify: `playwright/semantic-evaluator-stub.mjs`
- Modify: `playwright/tests/Q-practice-quiz-semantic.spec.ts`
- Modify: `packages/shared-components/src/evaluation/FreeTextRubricBreakdown.tsx`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`

**Interfaces:**

- Consumes: `FreeTextEvaluationResult.rubric_assessments` and optional `FreeTextEvaluationResult.feedback_proposals` from `packages/types/src/freeTextEvaluation.ts`.
- Produces: a `RubricAssessment.feedback?: string` joined by exact rubric ID and the stable hook `semantic-rubric-ai-feedback-{rubricId}`.
- Preserves: `semantic-rubric-summary`, `semantic-rubric-overview-{rubricId}`, and `semantic-rubric-result-{rubricId}`.

- [x] **Step 1: Make the deterministic evaluator return meaningful German score explanations and feedback proposals**

Add a partial-scenario copy table keyed by rubric ID:

```js
const partialCopyByRubric = {
  'risk-reduction': {
    rationale:
      'Die Antwort erkennt korrekt, dass Diversifikation das anlagespezifische Risiko reduziert.',
    feedback:
      'Ergänze, dass sich unternehmensspezifische Schwankungen im Portfolio teilweise ausgleichen.',
  },
  'diversification-mechanism': {
    rationale:
      'Die Antwort beschreibt zutreffend, dass das Risiko auf mehrere Anlagen verteilt wird.',
    feedback:
      'Nenne zusätzlich, dass die Anlagen unterschiedlichen Risikotreibern ausgesetzt sein sollten.',
  },
  correlation: {
    rationale:
      'Die Risikostreuung wird genannt, aber der Zusammenhang mit nicht perfekt korrelierten Renditen fehlt.',
    feedback:
      'Erkläre, dass der Diversifikationseffekt stärker ist, wenn sich die Renditen nicht vollständig gleich bewegen.',
  },
  'risk-scope': {
    rationale:
      'Die Antwort unterscheidet nicht zwischen unsystematischem und systematischem Risiko.',
    feedback:
      'Stelle klar, dass Diversifikation vor allem unsystematisches Risiko reduziert, nicht das allgemeine Marktrisiko.',
  },
}
```

Return the selected `rationale` in each assessment and one complete proposal per rubric:

```js
feedback_proposals: request.rubric_schema.rubrics.map((rubric) => {
  const copy = getEvaluationCopy({ rubric, scenario, isGerman })
  return {
    task_bundle_id: request.task_bundle_id,
    rubric_id: rubric.id,
    rubric_name: rubric.name,
    feedback: copy.feedback,
    strengths: [],
    improvements: [copy.feedback],
    action_items: [copy.feedback],
    evidence_ids: [],
    confidence: uncertain ? 0.2 : 1,
  }
}),
```

- [x] **Step 2: Extend the focused Playwright behavior contract**

In `reveals every rubric criterion after partial feedback`, assert the first expanded criterion contains the new UI and German evaluator content:

```ts
const riskReductionFeedback = page.getByTestId(
  'semantic-rubric-ai-feedback-risk-reduction'
)
await expect(riskReductionFeedback).toContainText('AI feedback')
await expect(riskReductionFeedback).toContainText('Why this score')
await expect(riskReductionFeedback).toContainText('How to improve')
await expect(riskReductionFeedback).toContainText('Die Antwort erkennt korrekt')
await expect(riskReductionFeedback).toContainText(
  'Ergänze, dass sich unternehmensspezifische Schwankungen'
)
```

Retain the existing keyboard assertion for the correlation disclosure.

- [x] **Step 3: Run the focused contract before the UI implementation**

Run:

```bash
pnpm --filter @klicker-uzh/playwright check
docker exec -w /workspaces/klicker-uzh default-fe-2b8ca-app-1 pnpm --filter @klicker-uzh/playwright exec playwright test tests/Q-practice-quiz-semantic.spec.ts --grep "reveals every rubric criterion"
```

Expected: TypeScript exits 0. Browser execution reaches test discovery; in the current DevPod it may stop at the documented missing pinned Chromium executable. The new selector would fail before browser launch in a complete Playwright runtime because the UI does not exist yet.

- [x] **Step 4: Extend the fail-closed result parser**

Add optional feedback to the local assessment view model:

```ts
type RubricAssessment = {
  rubricId: string
  rubricName: string
  proposedLevel: string
  normalizedScore: number
  rationale: string
  feedback?: string
}
```

Parse valid feedback proposals without weakening assessment validation:

```ts
function getFeedbackByRubric(value: unknown): Map<string, string> {
  if (!isRecord(value) || !Array.isArray(value.feedback_proposals)) {
    return new Map()
  }

  return new Map(
    value.feedback_proposals.flatMap((proposal) => {
      if (
        !isRecord(proposal) ||
        typeof proposal.rubric_id !== 'string' ||
        typeof proposal.feedback !== 'string' ||
        proposal.feedback.trim().length === 0
      ) {
        return []
      }
      return [[proposal.rubric_id, proposal.feedback.trim()] as const]
    })
  )
}
```

Call it once in `getRubricAssessments` and attach only exact-ID matches:

```ts
const feedbackByRubric = getFeedbackByRubric(value)
// ...
feedback: feedbackByRubric.get(assessment.rubric_id),
```

- [x] **Step 5: Add localized participant labels**

Add these keys under `pwa.practiceQuiz`:

```ts
// en.ts
semanticAiFeedback: 'AI feedback',
semanticWhyThisScore: 'Why this score',
semanticHowToImprove: 'How to improve',

// de.ts
semanticAiFeedback: 'KI-Feedback',
semanticWhyThisScore: 'Warum diese Bewertung?',
semanticHowToImprove: 'So kannst du dich verbessern',
```

- [x] **Step 6: Render the authorized AI feedback callout inside every detail card**

Replace the plain rationale paragraph with a labelled callout:

```tsx
<div
  className="border-l-4 border-uzh-blue-100 bg-white p-3"
  data-cy={`semantic-rubric-ai-feedback-${assessment.rubricId}`}
>
  <div className="text-sm font-semibold text-uzh-blue-100">
    {t('pwa.practiceQuiz.semanticAiFeedback')}
  </div>
  <div className="mt-2">
    <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">
      {t('pwa.practiceQuiz.semanticWhyThisScore')}
    </div>
    <p className="mt-1 text-sm leading-relaxed text-gray-700">
      {assessment.rationale}
    </p>
  </div>
  {assessment.feedback && (
    <div className="mt-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">
        {t('pwa.practiceQuiz.semanticHowToImprove')}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-gray-700">
        {assessment.feedback}
      </p>
    </div>
  )}
</div>
```

- [x] **Step 7: Run focused static verification**

Run:

```bash
pnpm exec biome check --write packages/shared-components/src/evaluation/FreeTextRubricBreakdown.tsx packages/i18n/messages/en.ts packages/i18n/messages/de.ts playwright/semantic-evaluator-stub.mjs
pnpm exec prettier --write playwright/tests/Q-practice-quiz-semantic.spec.ts
pnpm --filter @klicker-uzh/shared-components check
pnpm --filter @klicker-uzh/frontend-pwa check
pnpm --filter @klicker-uzh/playwright check
pnpm --filter @klicker-uzh/frontend-pwa lint
opengrep scan --config auto packages/shared-components/src/evaluation/FreeTextRubricBreakdown.tsx playwright/semantic-evaluator-stub.mjs playwright/tests/Q-practice-quiz-semantic.spec.ts
git diff --check
```

Expected: all commands exit 0; PWA lint may repeat existing warnings outside the changed files, and OpenGrep reports 0 findings in the changed source files.

- [x] **Step 8: Commit the independently reviewable UI behavior**

```bash
git add packages/shared-components/src/evaluation/FreeTextRubricBreakdown.tsx packages/i18n/messages/en.ts packages/i18n/messages/de.ts playwright/semantic-evaluator-stub.mjs playwright/tests/Q-practice-quiz-semantic.spec.ts
git commit -m "feat(pwa): explain rubric scores with AI feedback"
```

Expected: the repository pre-commit suite exits 0.

---

### Task 2: Replace cropped evidence with complete student views

**Files:**

- Replace: `docs/log/assets/2026-08-19-formative-free-text-evaluation-participant/participant-rubric-feedback-desktop.png`
- Replace: `docs/log/assets/2026-08-19-formative-free-text-evaluation-participant/participant-rubric-feedback-mobile.png`
- Modify: `docs/log/2026-08-19-formative-free-text-evaluation-participant.md`
- Modify: `project/plans_wip/PLAN-free-text-semantic-retries.md`
- Modify: PR #5433 description through the GitHub connector

**Interfaces:**

- Consumes: the authorized partial-evaluation state and `semantic-rubric-ai-feedback-risk-reduction` from Task 1.
- Produces: complete desktop/mobile evidence at the existing stable asset URLs and an updated top-stack PR description.

- [x] **Step 1: Restore the real local PWA validation path**

Run `devrouter ensure .`. If a generated Next.js cache prevents the route from loading,
follow `klicker-environment-doctor`: move only the affected app's `.next` directory to
an explicit recoverable `/tmp` path, restart the owned workspace process, and verify
the Practice Quiz route returns HTTP 200.

- [x] **Step 2: Create a natural partial-answer state through the real boundary**

Use the seeded semantic Practice Quiz and a synthetic participant. Submit the natural
answer `Diversifikation verteilt Risiken.` without exposing the fixture marker in the
screenshot. Accept the external-AI disclosure, complete the deterministic evaluation,
show the solution, and open the explanation.

- [x] **Step 3: Verify the complete student flow in the browser**

At desktop and 390 px widths, confirm the same viewport contains:

```text
question + submitted answer
generic partial result + attempts/reward/actions
revealed reference solution/explanation
2 of 4 criteria fully met
all four overview rows
first expanded detail card
AI feedback / Why this score / How to improve
criterion-specific German explanation and advice
```

Focus a collapsed `<summary>`, press Enter, and confirm its `open` state changes.
Check `document.documentElement.scrollWidth <= document.documentElement.clientWidth`
at the mobile width.

- [x] **Step 4: Capture full student-view screenshots at the stable asset paths**

Use a viewport tall enough to include the full active question state rather than
capturing `[data-cy="semantic-free-text-retry-panel"]` alone:

```bash
npx agent-browser --session rubric-feedback set viewport 1440 1900
npx agent-browser --session rubric-feedback screenshot docs/log/assets/2026-08-19-formative-free-text-evaluation-participant/participant-rubric-feedback-desktop.png
npx agent-browser --session rubric-feedback set viewport 390 2400
npx agent-browser --session rubric-feedback screenshot docs/log/assets/2026-08-19-formative-free-text-evaluation-participant/participant-rubric-feedback-mobile.png
```

Visually inspect both PNGs before keeping them. They must show the question context
and rubric feedback together.

- [x] **Step 5: Update repository evidence notes**

Document that the screenshots now show the complete student state and that the
per-rubric AI callout uses the score rationale plus optional feedback proposal. Record
the browser dimensions, keyboard check, overflow result, focused checks, and the
known local Playwright executable limitation.

- [x] **Step 6: Commit the evidence update**

```bash
git add docs/log/2026-08-19-formative-free-text-evaluation-participant.md docs/log/assets/2026-08-19-formative-free-text-evaluation-participant/participant-rubric-feedback-desktop.png docs/log/assets/2026-08-19-formative-free-text-evaluation-participant/participant-rubric-feedback-mobile.png project/plans_wip/PLAN-free-text-semantic-retries.md docs/superpowers/plans/2026-08-19-free-text-ai-rubric-feedback.md
git commit -m "docs: show complete AI rubric feedback flow"
```

- [x] **Step 7: Push through native stack tracking and update PR #5433**

Run:

```bash
gh stack view --json
gh stack push
```

Expected: stack #5436 remains `v3 <- #5430 <- #5431 <- #5432 <- #5433`, all PRs stay drafts, and only the participant branch advances.

Replace the PR's screenshot section with:

```markdown
### Complete student view with accepted AI rubric feedback — desktop

![Complete desktop student view with AI rubric feedback](https://raw.githubusercontent.com/uzh-bf/klicker-uzh/feat/free-text-semantic-participant/docs/log/assets/2026-08-19-formative-free-text-evaluation-participant/participant-rubric-feedback-desktop.png)

### Complete student view with accepted AI rubric feedback — mobile

![Complete mobile student view with AI rubric feedback](https://raw.githubusercontent.com/uzh-bf/klicker-uzh/feat/free-text-semantic-participant/docs/log/assets/2026-08-19-formative-free-text-evaluation-participant/participant-rubric-feedback-mobile.png)
```

Remove the obsolete cropped-panel framing and the older duplicate full-solution
screenshots from the PR body. Re-read #5433 and verify its head SHA, draft state,
parent branch, headings, and both image URLs. Check comments/reviews and report CI as
pending rather than claiming success before completion.
