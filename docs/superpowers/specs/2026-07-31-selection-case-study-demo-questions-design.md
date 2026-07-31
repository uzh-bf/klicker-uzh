# Selection and Case Study Demo Questions

- **Date:** 2026-07-31
- **Status:** Approved

## Context

During first-login onboarding, lecturers can opt into demo elements. The existing `changeInitialSettings` flow calls `seedDemoQuestions` in `packages/graphql/src/services/accounts.ts`, which creates demo elements for single choice, multiple choice, KPRIM, numerical response, free text, flashcard, and content, plus a Demo Live Quiz. It does not create demos for the `SELECTION` or `CASE_STUDY` element types.

Selection and case-study elements differ from the existing demos because both require an owned `AnswerCollection`. Correct selection answers and case-study items are stored through Prisma relations to `AnswerCollectionEntry` records, while case-study solution ranges embed those generated entry IDs in the element's JSON options.

## Goal

When a new lecturer opts into demo elements during first-login onboarding, create:

- one subject-neutral selection demo;
- one subject-neutral case-study demo;
- one answer collection shared by both elements; and
- one new untimed block in the Demo Live Quiz containing the selection and case study, in that order.

Both elements must include complete sample solutions and demonstrate how reusable answer collections support multiple element types.

## Non-goals

- Backfilling existing users.
- Adding a separate action for existing users to seed demo content.
- Changing the first-login UI, GraphQL schema, or mutation contract.
- Adding or changing Prisma models or migrations.
- Refactoring all existing demo content into a new declarative seeding framework.
- Localizing the seeded content; the current demo content is English regardless of the selected user locale.
- Updating the public documentation site, because the onboarding control and workflow remain unchanged.

## Architecture

Keep `seedDemoQuestions` as the entry point. Add a private helper focused on the relational bundle, conceptually named `seedDemoSelectionAndCaseStudyElements`. The helper creates the answer collection and both elements, recomputes their derived permissions, and returns both elements with the relations required by `processElementData`.

The helper uses a local Prisma transaction for only these three resources. This prevents an answer collection or one of the two elements from being left behind if creation of the relational bundle fails, without expanding the work into an all-demo seeder refactor.

No new public service, API, or UI abstraction is introduced.

## Shared answer collection

Create an answer collection with:

- **Name:** `Demo Teaching Activities`
- **Description:** `Reusable teaching activities used by the demo selection and case study questions.`
- **Owner:** the onboarding lecturer

Create these six entries:

1. `Live poll`
2. `Think-pair-share`
3. `Small-group case discussion`
4. `One-minute paper`
5. `Mini-lecture`
6. `Instructor demonstration`

The helper reads the created entries and builds a value-to-ID lookup. Resolving any required entry must fail with a clear internal error if the expected value is absent. The collection receives the owner's derived permissions through the existing `recomputeDerivedPermissions` utility.

## Selection demo

- **Name:** `Demoquestion SE`
- **Type:** `SELECTION`
- **Content:** `You are teaching a large lecture and want to collect an individual response from every student. Select the two activities that meet this requirement.`
- **Explanation:** `Live polls and one-minute papers collect an individual response from each student. Other activities can be highly interactive, but do not necessarily capture a response from everyone.`
- **Tag:** `Demo Tag`
- **Base points:** enabled
- **Points multiplier:** `1`
- **Sample solution:** enabled
- **Number of inputs:** `2`
- **Answer collection:** `Demo Teaching Activities`
- **Correct entries:** `Live poll` and `One-minute paper`

Persist only `hasSampleSolution` and `numberOfInputs` in the selection options JSON. Link the collection through `answerCollection` and the correct entries through `answerCollectionItems`, matching the normal element persistence model.

## Case-study demo

- **Name:** `Demoquestion CS`
- **Type:** `CASE_STUDY`
- **Content:** `Compare four teaching activities in two teaching settings. For each case, rate every activity by expected student engagement, preparation effort, and in-class time.`
- **Explanation:** `The sample ranges are illustrative rather than universally correct. Appropriate ratings depend on how each activity is designed and facilitated.`
- **Tag:** `Demo Tag`
- **Base points:** enabled
- **Points multiplier:** `1`
- **Sample solution:** enabled
- **Answer collection:** `Demo Teaching Activities`

### Selected items

Use these four collection entries:

1. `Live poll`
2. `Think-pair-share`
3. `Small-group case discussion`
4. `Mini-lecture`

Link all four through `answerCollectionItems`. The remaining collection entries stay available to demonstrate that an element can use only a subset of a reusable collection.

### Criteria

Use deterministic IDs because the IDs only need to be unique inside this element and stable for its solution references.

| ID                 | Name                | Minimum | Maximum | Step | Unit  |
| ------------------ | ------------------- | ------: | ------: | ---: | ----- |
| `demo-engagement`  | Expected engagement |       1 |       5 |    1 | none  |
| `demo-preparation` | Preparation effort  |       1 |       5 |    1 | none  |
| `demo-time`        | In-class time       |       1 |      20 |    1 | `min` |

### Cases

1. **Large introductory lecture** (`demo-large-lecture`, order `0`): `You are teaching an introductory lecture with 300 students in fixed seating. You have at most 20 minutes for an activity and need an approach that works at scale.`
2. **Small advanced seminar** (`demo-small-seminar`, order `1`): `You are teaching an advanced seminar with 20 students in a room with flexible seating. You can devote up to 20 minutes to an activity and want students to engage deeply with the material.`

### Sample-solution ranges

Every case must contain one solution for each of the four selected entries. Every item solution must contain one range for each of the three criteria.

#### Large introductory lecture

| Activity                    | Engagement | Preparation | Time (min) |
| --------------------------- | ---------- | ----------- | ---------- |
| Live poll                   | 3–5        | 2–3         | 3–7        |
| Think-pair-share            | 4–5        | 1–2         | 6–10       |
| Small-group case discussion | 3–4        | 3–5         | 12–20      |
| Mini-lecture                | 1–2        | 2–4         | 10–20      |

#### Small advanced seminar

| Activity                    | Engagement | Preparation | Time (min) |
| --------------------------- | ---------- | ----------- | ---------- |
| Live poll                   | 2–4        | 2–3         | 3–7        |
| Think-pair-share            | 4–5        | 1–2         | 6–10       |
| Small-group case discussion | 4–5        | 3–5         | 12–20      |
| Mini-lecture                | 1–3        | 2–4         | 10–20      |

Case-study solution objects embed the generated answer-collection entry IDs as `itemId` values and reference the deterministic criterion IDs from this specification.

## Creation and instance data flow

Within the local transaction, the helper:

1. Creates the answer collection with all six entries and includes the entries in the result.
2. Resolves the IDs needed by the selection and case study.
3. Creates the selection with its collection and correct-entry relations.
4. Creates the case study with its collection and selected-item relations.
5. Includes `answerCollection.entries` and `answerCollectionItems` on both returned elements.
6. Recomputes derived permissions for the answer collection and both elements.

After the helper returns, append one block to the existing `blockData`:

- **Order:** after all existing blocks
- **Time limit:** `null`
- **Random selection:** `null`
- **Element order:** selection first, case study second

The existing live-quiz creation path calls `processElementData` for each returned element. For selection, it snapshots all collection entries plus the correct entry IDs. For case study, it snapshots the four selected entries plus the criteria, cases, and solution ranges. `getInitialInstanceResults` initializes the type-specific empty results.

## Error handling

- A missing expected answer-collection entry is an internal invariant violation and throws a descriptive error; it must not silently produce an incomplete element.
- Failure while creating the collection, either element, or their derived permissions rolls back the new relational bundle.
- The error continues through the existing first-login mutation. No new frontend error state is introduced.
- Failure during later Demo Live Quiz creation retains already-created standalone demo elements, matching the current seeder behavior.
- Retry/idempotency changes for the legacy demo seeder are outside this feature's scope.

## Acceptance criteria

When a new user submits first-login settings with `seedDemoElements: true`:

1. The user owns exactly one `Demo Teaching Activities` collection with the six specified entries.
2. The user owns one `Demoquestion SE` and one `Demoquestion CS`, both tagged `Demo Tag`.
3. Both elements reference the same answer collection.
4. The selection requires two inputs and links exactly `Live poll` and `One-minute paper` as correct answers.
5. The case study links the four specified items and contains two cases and three criteria.
6. Each case contains four item solutions, and each item contains three criterion ranges.
7. Every relational and embedded item ID refers to the shared collection, and every criterion solution refers to a defined criterion.
8. The Demo Live Quiz has one additional untimed block containing selection followed by case study.
9. The two new quiz instances contain complete collection snapshots, sample solutions, and valid empty initial results.
10. Existing demo elements and quiz blocks remain unchanged.

When a new user submits first-login settings with `seedDemoElements: false`, none of the new collection, elements, or quiz block is created.

## Verification

Add a focused database-backed service test, without mocks, around `changeInitialSettings` or the closest existing account-service integration boundary. Cover both `seedDemoElements: true` and `seedDemoElements: false` and assert all acceptance criteria at the database and quiz-instance level.

Run:

- the targeted GraphQL test;
- the GraphQL package typecheck;
- formatting and lint checks for changed files; and
- `opengrep scan --config auto` for the changed implementation scope.

Perform a browser smoke test in the real local environment with a disposable fresh lecturer account:

1. Opt into demo elements during first-login onboarding.
2. Confirm both new types appear in the element library.
3. Confirm the shared answer collection is available and linked.
4. Open the Demo Live Quiz and verify the new block and both element renderings.

## Documentation

Update `docs/data-and-migrations.md` with the first-login demo-seeding relationship between elements and answer collections. Add the behavior change to `docs/log.md`. No public documentation update is required.
