# Knowledge Graph Build Model Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let lecturers select generation and cleaning models for each chatbot knowledge graph build and forward both selections to the external Hatchet workflow.

**Architecture:** A shared allow-list owns the exact external model IDs and exposes a runtime type guard. The GraphQL service validates string mutation inputs before claiming a build, passes typed values through the local Hatchet task, and the Hatchet bridge maps them to snake-case external payload fields. The lecturer UI uses the same allow-list for two transient selectors.

**Tech Stack:** TypeScript, Pothos GraphQL, Apollo Client, React 19, next-intl, UZH design system, Hatchet SDK, Vitest

## Global Constraints

- Both selectors expose exactly `klickeruzh/azure/gpt-4.1`, `klickeruzh/azure/gpt-5.1`, `klickeruzh/azure/gpt-5.5`, `klickeruzh/azure/gpt-5.4`, and `klickeruzh/azure/gpt-4.1-nano`.
- Both selectors default to `klickeruzh/azure/gpt-4.1-nano`.
- Model choices apply only to the submitted build and are not persisted.
- Unsupported values must fail before graph build state is claimed or changed.
- Do not add dependencies or a database migration.

---

### Task 1: Shared model contract and external payload

**Files:**

- Modify: `packages/types/src/hatchet.ts`
- Modify: `packages/hatchet/src/kbIngestion.ts`
- Modify: `packages/hatchet/src/kbGraphIngestion.ts`
- Test: `packages/hatchet/test/kbGraphIngestion.test.ts`

**Interfaces:**

- Produces: `kbIngestionModelIds`, `KBIngestionModelId`, `isKBIngestionModelId(value: string): value is KBIngestionModelId`
- Produces: required `generationModel` and `cleaningModel` properties on `BuildChatbotKnowledgeGraphInput`
- Produces: `generation_model` and `cleaning_model` in chatbot graph external payloads

- [ ] **Step 1: Extend the payload test so it fails without model mapping**

Add both typed task values to `graphInput`:

```ts
generationModel: 'klickeruzh/azure/gpt-4.1-nano',
cleaningModel: 'klickeruzh/azure/gpt-4.1-nano',
```

Expect the external payload to include:

```ts
generation_model: 'klickeruzh/azure/gpt-4.1-nano',
cleaning_model: 'klickeruzh/azure/gpt-4.1-nano',
```

- [ ] **Step 2: Run the focused test and confirm the new expectation fails**

Run: `pnpm --filter @klicker-uzh/hatchet test -- kbGraphIngestion.test.ts`

Expected: FAIL because `generation_model` and `cleaning_model` are absent from the payload.

- [ ] **Step 3: Add the shared allow-list and task contract**

In `packages/types/src/hatchet.ts`, add:

```ts
export const kbIngestionModelIds = [
  'klickeruzh/azure/gpt-4.1',
  'klickeruzh/azure/gpt-5.1',
  'klickeruzh/azure/gpt-5.5',
  'klickeruzh/azure/gpt-5.4',
  'klickeruzh/azure/gpt-4.1-nano',
] as const

export type KBIngestionModelId = (typeof kbIngestionModelIds)[number]

export function isKBIngestionModelId(
  value: string
): value is KBIngestionModelId {
  return (kbIngestionModelIds as readonly string[]).includes(value)
}
```

Add `generationModel: KBIngestionModelId` and `cleaningModel: KBIngestionModelId` to `BuildChatbotKnowledgeGraphInput`.

- [ ] **Step 4: Map the typed task values into the external payload**

Allow these optional fields on the shared external payload type in `packages/hatchet/src/kbIngestion.ts`, because individual-resource ingestion does not supply them:

```ts
generation_model?: KBIngestionModelId
cleaning_model?: KBIngestionModelId
```

Return both fields from `buildExternalChatbotKnowledgeGraphPayload`:

```ts
generation_model: input.generationModel,
cleaning_model: input.cleaningModel,
```

- [ ] **Step 5: Run the Hatchet test and type checks**

Run: `pnpm --filter @klicker-uzh/hatchet test -- kbGraphIngestion.test.ts`

Expected: PASS.

Run: `pnpm --filter @klicker-uzh/types check && pnpm --filter @klicker-uzh/hatchet check`

Expected: both commands pass.

### Task 2: GraphQL validation and task propagation

**Files:**

- Modify: `packages/graphql/src/schema/mutation.ts`
- Modify: `packages/graphql/src/services/chatbotKnowledgeGraphs.ts`
- Modify: `packages/graphql/src/graphql/ops/MRebuildChatbotKnowledgeGraph.graphql`
- Test: `packages/graphql/test/chatbotKnowledgeGraphs.test.ts`
- Regenerate: `packages/graphql/src/ops.ts`, `packages/graphql/src/ops.schema.json`, `packages/graphql/src/public/schema.graphql`, `packages/graphql/src/public/server.json`

**Interfaces:**

- Consumes: `isKBIngestionModelId`, `KBIngestionModelId`, and the extended `BuildChatbotKnowledgeGraphInput`
- Produces: required GraphQL mutation variables `generationModel: String!` and `cleaningModel: String!`

- [ ] **Step 1: Add failing service tests for validation and propagation**

Update valid rebuild calls with:

```ts
generationModel: 'klickeruzh/azure/gpt-4.1-nano',
cleaningModel: 'klickeruzh/azure/gpt-4.1-nano',
```

Assert the immutable task snapshot contains both values. Add a test that passes an unsupported generation model and asserts `runNoWait` is not called and the graph remains `DIRTY`:

```ts
await expect(
  rebuildChatbotKnowledgeGraph(
    {
      chatbotId: chatbot.id,
      speedMode: 'balanced',
      generationModel: 'unsupported/model',
      cleaningModel: 'klickeruzh/azure/gpt-4.1-nano',
    },
    userOneCtx
  )
).rejects.toThrow('Unsupported knowledge graph generation model')
```

Add the equivalent cleaning-model rejection assertion.

- [ ] **Step 2: Run the focused GraphQL test and confirm it fails**

Run: `pnpm --filter @klicker-uzh/graphql test -- chatbotKnowledgeGraphs.test.ts`

Expected: FAIL because the service signature and task payload do not yet accept the model values.

- [ ] **Step 3: Validate mutation strings and construct a typed task input**

Extend `rebuildChatbotKnowledgeGraph` arguments with `generationModel: string` and `cleaningModel: string`. After chatbot ownership is verified but before graph state is read or claimed, validate:

```ts
if (!isKBIngestionModelId(generationModel)) {
  throw new GraphQLError('Unsupported knowledge graph generation model')
}
if (!isKBIngestionModelId(cleaningModel)) {
  throw new GraphQLError('Unsupported knowledge graph cleaning model')
}
```

Include both narrowed values in `BuildChatbotKnowledgeGraphInput`.

- [ ] **Step 4: Expose both required GraphQL arguments and operation variables**

Add these Pothos mutation arguments:

```ts
generationModel: t.arg.string({ required: true }),
cleaningModel: t.arg.string({ required: true }),
```

Update `MRebuildChatbotKnowledgeGraph.graphql` with `$generationModel: String!` and `$cleaningModel: String!`, forwarding both to the mutation field.

- [ ] **Step 5: Regenerate operations and run focused verification**

Run: `pnpm --filter @klicker-uzh/graphql generate`

Expected: GraphQL schema, typed operation documents, and persisted operations regenerate successfully.

Run: `pnpm --filter @klicker-uzh/graphql test -- chatbotKnowledgeGraphs.test.ts`

Expected: PASS.

Run: `pnpm --filter @klicker-uzh/graphql check`

Expected: PASS.

### Task 3: Lecturer model selectors and end-to-end verification

**Files:**

- Modify: `apps/frontend-manage/src/components/resources/chatbots/ChatbotKnowledgeGraphPanel.tsx`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`

**Interfaces:**

- Consumes: `kbIngestionModelIds`, `KBIngestionModelId`, and regenerated `RebuildChatbotKnowledgeGraphDocument`
- Produces: two accessible transient model selectors whose values are submitted with every graph build

- [ ] **Step 1: Add translated field labels**

Add English labels:

```ts
knowledgeGraphGenerationModel: 'Generation model',
knowledgeGraphCleaningModel: 'Cleaning model',
```

Add German labels:

```ts
knowledgeGraphGenerationModel: 'Generierungsmodell',
knowledgeGraphCleaningModel: 'Bereinigungsmodell',
```

- [ ] **Step 2: Add typed selector state and options**

Import the shared values and define:

```ts
const DEFAULT_KB_MODEL: KBIngestionModelId = 'klickeruzh/azure/gpt-4.1-nano'

const [generationModel, setGenerationModel] =
  useState<KBIngestionModelId>(DEFAULT_KB_MODEL)
const [cleaningModel, setCleaningModel] =
  useState<KBIngestionModelId>(DEFAULT_KB_MODEL)

const modelItems = useMemo(
  () => kbIngestionModelIds.map((model) => ({ value: model, label: model })),
  []
)
```

- [ ] **Step 3: Render both selectors and submit their values**

Render accessible `Select` fields with IDs and Cypress identifiers `chatbot-knowledge-graph-generation-model` and `chatbot-knowledge-graph-cleaning-model`. Disable them whenever speed mode is disabled. Make the build controls wrap on narrower screens so all three selectors and the button remain usable.

Submit:

```ts
variables: {
  chatbotId, speedMode, generationModel, cleaningModel
}
```

- [ ] **Step 4: Run format and type checks**

Run: `pnpm exec prettier --write packages/types/src/hatchet.ts packages/hatchet/src/kbIngestion.ts packages/hatchet/src/kbGraphIngestion.ts packages/hatchet/test/kbGraphIngestion.test.ts packages/graphql/src/services/chatbotKnowledgeGraphs.ts packages/graphql/src/schema/mutation.ts packages/graphql/src/graphql/ops/MRebuildChatbotKnowledgeGraph.graphql packages/graphql/test/chatbotKnowledgeGraphs.test.ts apps/frontend-manage/src/components/resources/chatbots/ChatbotKnowledgeGraphPanel.tsx packages/i18n/messages/en.ts packages/i18n/messages/de.ts`

Expected: files are formatted without errors.

Run: `pnpm --filter @klicker-uzh/frontend-manage check`

Expected: PASS.

- [ ] **Step 5: Verify the lecturer form in a real browser**

Use the already configured local Klicker environment and run `npx agent-browser` against the lecturer chatbot edit page. Log in with delegated lecturer credentials. Confirm in both desktop and narrow viewports that:

- both selectors are visible with translated labels;
- each selector contains exactly the five allowed IDs;
- both default to `klickeruzh/azure/gpt-4.1-nano`;
- the controls remain usable and do not overflow;
- submitting Build sends the selected generation and cleaning models.

Capture before/after screenshots for the PR.

- [ ] **Step 6: Run final scoped verification and commit**

Run: `pnpm --filter @klicker-uzh/types check && pnpm --filter @klicker-uzh/hatchet check && pnpm --filter @klicker-uzh/graphql check && pnpm --filter @klicker-uzh/frontend-manage check`

Expected: all checks pass.

Run: `git diff --check`

Expected: no whitespace errors.

Commit the complete feature with:

```bash
git add packages/types/src/hatchet.ts packages/hatchet/src/kbIngestion.ts packages/hatchet/src/kbGraphIngestion.ts packages/hatchet/test/kbGraphIngestion.test.ts packages/graphql/src/services/chatbotKnowledgeGraphs.ts packages/graphql/src/schema/mutation.ts packages/graphql/src/graphql/ops/MRebuildChatbotKnowledgeGraph.graphql packages/graphql/test/chatbotKnowledgeGraphs.test.ts packages/graphql/src/ops.ts packages/graphql/src/ops.schema.json packages/graphql/src/public/schema.graphql packages/graphql/src/public/server.json apps/frontend-manage/src/components/resources/chatbots/ChatbotKnowledgeGraphPanel.tsx packages/i18n/messages/en.ts packages/i18n/messages/de.ts docs/superpowers/plans/2026-07-21-knowledge-graph-build-models.md
git commit -m "feat(kg): select ingestion models"
```
