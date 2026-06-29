# Playwright Test Refactor Plan

Goal: remove all remaining code duplication across `playwright/tests/` by extracting shared helpers and data into `playwright/util/`. Also notes issues found in `test_draft/` that should be fixed when those specs are promoted.

---

## Coverage status

All 26 Cypress specs have a Playwright counterpart — nothing is missing:

- **`playwright/tests/`** (0, A–L): 13 fully promoted specs ✓
- **`playwright/test_draft/`** (MA–X minus already-promoted): 13 draft specs in progress

---

## 1. `util/constants.ts` — add `FT_DATA`

`J-elements-free-text.spec.ts` declares `const FT = { ... }` inline. Move it alongside the other `*_DATA` objects so all fixture data lives in one place.

```ts
export const FT_DATA = {
  title: 'Free Text Question Title',
  content: 'Free Text Question Text',
  maxLength: 100,
  titleEdited: 'Free Text Question Title Edited',
  contentEdited: 'Free Text Question Text Edited',
  maxLengthEdited: 300,
  sampleSolution: [
    'Sample Solution 1',
    'Sample Solution 2',
    'Sample Solution 3',
  ],
}
```

**Update J:** `import { FT_DATA as FT } from '../util/constants.js'`

---

## 2. `util/fixtures/elements.ts` — new helpers

### 2a. Answer collection navigation

Repeated verbatim in K (5×) and L (4×). Also redefined as a local function in the `test_draft/U-catalog.spec.ts`.

```ts
export async function navigateToAnswerCollections(page: Page) {
  await page.getByTestId('resources').click()
  await page.getByTestId('answer-collections').click()
  await expect(page.getByTestId('answer-collection-list')).toBeVisible()
}

export async function openAnswerCollectionEdit(page: Page, name: string) {
  await page.getByTestId(`answer-collection-actions-${name}`).click()
  await page.getByTestId('edit-answer-collection').click()
}

export async function closeAnswerCollectionEdit(page: Page) {
  await page.getByTestId('close-answer-collection-edit-modal').click()
}
```

**Update:** K, L, and (when promoted) U-catalog → replace inline sequences.

### 2b. `createAnswerCollectionViaUI`

K has a local function; L has a nearly-identical inline `fillCollection`; U-catalog will need the same. Unify into one export.

```ts
export async function createAnswerCollectionViaUI(
  page: Page,
  name: string,
  description: string,
  entries: string[]
) {
  await page.locator('[data-cy="create-answer-collection"]').click()
  await page.getByTestId('answer-collection-name').waitFor({ state: 'visible' })
  await page.getByTestId('answer-collection-name').fill(name)
  const descEditor = page.locator('[data-cy="answer-collection-description"]')
  await descEditor.click()
  await descEditor.pressSequentially(description)
  for (let i = 0; i < entries.length; i++) {
    if (i >= 2) await page.locator('[data-cy="add-response-entry"]').click()
    await page.getByTestId(`response-entry-${i}`).fill(entries[i])
  }
  await page.locator('[data-cy="submit-create-answer-collection"]').click()
  await expect(
    page.locator(`[data-cy="answer-collection-${name}"]`)
  ).toBeVisible()
}
```

Note: L's variant calls `page.reload()` after submit and uses `getByTestId('submit-create-answer-collection')`. Reconcile to the K variant (no reload, check visibility). Also verify which selector (`locator` vs `getByTestId`) the app actually uses before writing the final version.

### 2c. `verifyAnswerCollectionOptions`

The "open options panel, verify deletable/restricted per item" pattern repeats 5× across K and L, and will appear again in U-catalog.

```ts
export async function verifyAnswerCollectionOptions(
  page: Page,
  options: { deletable: string[]; restricted: string[] }
) {
  await page.getByTestId('open-answer-collection-options').click()
  for (const sol of options.restricted) {
    await expect(page.getByTestId(`delete-answer-option-${sol}`)).toBeDisabled()
    await expect(
      page.getByTestId(`edit-answer-option-${sol}`)
    ).not.toBeDisabled()
  }
  for (const sol of options.deletable) {
    await expect(
      page.getByTestId(`delete-answer-option-${sol}`)
    ).not.toBeDisabled()
    await expect(
      page.getByTestId(`edit-answer-option-${sol}`)
    ).not.toBeDisabled()
  }
}
```

### 2d. `fillFeedbacksWithValidation`

The `configure-answer-feedbacks` toggle + per-feedback fill loop with save-button state assertions repeats identically in F, G, and H.

```ts
export async function fillFeedbacksWithValidation(
  page: Page,
  feedbacks: string[]
) {
  await page.getByTestId('configure-answer-feedbacks').click()
  await expect(page.getByTestId('save-new-question')).toBeDisabled()
  for (const [ix, text] of feedbacks.entries()) {
    await expect(page.getByTestId('save-new-question')).toBeDisabled()
    await fillFeedbackField(page, ix, text)
  }
  await expect(page.getByTestId('save-new-question')).not.toBeDisabled()
}
```

**Update:** F, G, H → replace the `configure-answer-feedbacks` + loop block with one call. The manual clearing/re-filling edge case tests that follow remain inline (they test error recovery, not the happy path).

### 2e. Move L's local helpers to `elements.ts`

`fillCriterion`, `verifyCriterion`, `fillSolutions`, `verifySolutions` are fully-written private helpers inside L. They have no duplication today but belong in `elements.ts` so `test_draft/` specs that touch Case Study can use them without redeclaring.

Also export the companion TypeScript types: `RangeCriterion`, `StepsCriterion`, `CriterionData`, `SolutionEntry`.

**Update L:** Remove local declarations and import from `elements.js`.

---

## 3. `util/fixtures.ts` — minor cleanup

The `loginFreeUser` fixture hardcodes an email and UUID inline instead of referencing constants:

```ts
// current (fixtures.ts line 228-229)
email: 'free@df.uzh.ch',
sub: '76047345-3801-4628-ae7b-adbebcfe8822',
```

Add `LECTURER_FREE_EMAIL` and `USER_ID_TEST2` (already in constants) and use them. `USER_ID_TEST2` already exists; just add the email constant.

---

## 4. `test_draft/U-catalog.spec.ts` — prep for promotion

U-catalog redefines `navigateToAnswerCollections` as a private local function (line 130). When the spec is promoted to `tests/`, remove it and import from `elements.js`.

It also has local fixture data (`AC1`, `AC2`, …) that may belong in `constants.ts` once the spec stabilises — leave as-is until promotion.

---

## 5. `0-baseline-ops.spec.ts` — remove stale TODO block

Lines 60–104 are a commented-out TODO list that was appropriate during initial scaffolding but now just adds noise to the file. Remove it or move it to a GitHub issue / the project backlog.

---

## Per-file change summary

| File                                  | Changes                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `util/constants.ts`                   | + `FT_DATA`, + `LECTURER_FREE_EMAIL`                                                                                                                                                                                                                                                                      |
| `util/fixtures/elements.ts`           | + `navigateToAnswerCollections`, `openAnswerCollectionEdit`, `closeAnswerCollectionEdit`, `createAnswerCollectionViaUI`, `verifyAnswerCollectionOptions`, `fillFeedbacksWithValidation`, `fillCriterion`, `verifyCriterion`, `fillSolutions`, `verifySolutions`, + types `CriterionData`, `SolutionEntry` |
| `util/fixtures.ts`                    | Use `USER_ID_TEST2` + new email constant for `loginFreeUser`                                                                                                                                                                                                                                              |
| `tests/J-elements-free-text.spec.ts`  | Use `FT_DATA`, `saveElement`, `fillEditorField` instead of inline                                                                                                                                                                                                                                         |
| `tests/K-elements-selection.spec.ts`  | Remove local `createAnswerCollectionViaUI`; use 5 new helpers                                                                                                                                                                                                                                             |
| `tests/L-elements-case-study.spec.ts` | Remove 4 local helpers + types; use 9 shared helpers                                                                                                                                                                                                                                                      |
| `tests/F-elements-sc.spec.ts`         | Use `fillFeedbacksWithValidation`                                                                                                                                                                                                                                                                         |
| `tests/G-elements-mc.spec.ts`         | Use `fillFeedbacksWithValidation`                                                                                                                                                                                                                                                                         |
| `tests/H-elements-kprim.spec.ts`      | Use `fillFeedbacksWithValidation`                                                                                                                                                                                                                                                                         |
| `tests/0-baseline-ops.spec.ts`        | Remove TODO comment block                                                                                                                                                                                                                                                                                 |
| `test_draft/U-catalog.spec.ts`        | Note for promotion: remove local `navigateToAnswerCollections`                                                                                                                                                                                                                                            |

---

## What is intentionally NOT extracted

| Pattern                                       | Reason                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `test.beforeEach(loginLecturer)`              | One line, already using a fixture — no benefit                         |
| Answer-option reordering (F/G/H)              | Type-specific move limits differ (SC: one correct; KPRIM: capped at 4) |
| Sample solution correctness toggles (F/G/H)   | Correctness rules differ per type; intent is clearer inline            |
| Answer field clear/re-fill validation (F/G/H) | Each tests different slot counts; not worth abstracting                |
| Numerical solution range boundary tests (I)   | Domain-specific, no other spec reuses the pattern                      |
| Fixture data in `test_draft/` specs           | Too early — data will change before promotion                          |

---

## Estimated impact

| Category                         | Lines removed        | Lines added |
| -------------------------------- | -------------------- | ----------- |
| Test files (J, K, L, F, G, H, 0) | ~270                 | —           |
| `util/fixtures/elements.ts`      | —                    | ~120        |
| `util/constants.ts`              | —                    | ~12         |
| **Net**                          | **~140 fewer lines** |             |
