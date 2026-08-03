# Competence Authoring And Element Assignment UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make root and nested competence creation explicit and make optional competence-tree assignment discoverable while creating a supported element before its first save.

**Architecture:** Extend the existing pure hierarchy command reducer with an `addRoot` command and keep all hierarchy reconciliation in `treeHelpers.ts`. Reposition and progressively disclose the existing pending-mapping editor instead of adding another persistence path. Use a narrow query parameter to connect the tree assignment empty state to the existing element-creation modal.

**Tech Stack:** Next.js 15 pages router, React, TypeScript, `@uzh-bf/design-system`, next-intl, Vitest, Playwright.

## Global Constraints

- Supported element types remain Numerical, SC, MC, KPRIM, and controlled-answer Free Text.
- First-save creation supports one optional initial tree assignment; additional mappings are added when editing the saved element.
- Save order remains element first, assignment second, with idempotent retry or explicit keep-unmapped recovery.
- Authors select tree, leaf, and level; `b` comes from the level, `c` is inferred, and `a` uses the reviewed default.
- Duplicate remains a copy operation.
- English and German copy change together.
- No new dependency and no new activity type.

---

### Task 1: Explicit Root And Child Creation

**Files:**

- Modify: `apps/frontend-manage/src/components/resources/competenceTrees/treeHelpers.ts`
- Modify: `apps/frontend-manage/test/treeHelpers.test.ts`
- Modify: `apps/frontend-manage/src/components/resources/competenceTrees/HierarchyEditor.tsx`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`

**Interfaces:**

- Consumes: `applyCompetenceTreeStructuralCommand(state, command)`.
- Produces: `CompetenceTreeStructuralCommand` variant `{ type: 'addRoot'; name: string }`.

- [x] **Step 1: Add a failing reducer test for root creation**

```ts
test('adds and selects a new root competence without duplicating a branch', () => {
  const initial = state(
    form([node('root', null), node('leaf', 'root')], {
      coverages: defaultCoverages('leaf'),
    }),
    'root'
  )

  const next = applyCompetenceTreeStructuralCommand(initial, {
    type: 'addRoot',
    name: 'New competence',
  })

  expect(getChildren(next.form.nodes, null)).toHaveLength(2)
  expect(next.form.nodes).toContainEqual(
    expect.objectContaining({
      key: 'node:local:1',
      parentKey: null,
      kind: AdaptiveNodeKind.Competence,
      name: 'New competence',
      weight: 1,
    })
  )
  expect(next.selectedNodeKey).toBe('node:local:1')
  expect(next.form.coverages).toStrictEqual(initial.form.coverages)
})
```

- [x] **Step 2: Run the reducer test and confirm the command is missing**

Run:

```bash
pnpm --filter @klicker-uzh/frontend-manage test:run -- treeHelpers.test.ts
```

Expected: TypeScript/Vitest failure because `addRoot` is not a valid command.

- [x] **Step 3: Implement the pure `addRoot` command**

Add the union variant and reducer branch:

```ts
export type CompetenceTreeStructuralCommand =
  | { type: 'addRoot'; name: string }
  | { type: 'addChild'; parentKey: string; name: string }
  | { type: 'move'; nodeKey: string; direction: -1 | 1 }
  | { type: 'reorder'; nodeKey: string; order: number }
  | { type: 'reparent'; nodeKey: string; parentKey: string }
  | { type: 'duplicate'; nodeKey: string }
  | { type: 'delete'; nodeKey: string }

case 'addRoot': {
  const rootKey = getNextLocalKey(
    form.nodes.map((node) => node.key),
    'node'
  )
  return {
    ...emptyMutation,
    nodes: [
      ...form.nodes,
      {
        key: rootKey,
        parentKey: null,
        kind: AdaptiveNodeKind.Competence,
        name: command.name,
        description: '',
        order: getChildren(form.nodes, null).length,
        weight: 1,
      },
    ],
    addedRootKey: rootKey,
  }
}
```

Extend `NodeMutation` with `addedRootKey: string | null`, initialize it to
`null`, and select it in `applyCompetenceTreeStructuralCommand`.

- [x] **Step 4: Add explicit hierarchy controls**

Above the hierarchy outline, add:

```tsx
<Button
  onClick={() => {
    requestNodeNameFocus()
    onStructuralCommand({
      type: 'addRoot',
      name: t('manage.competenceTree.newCompetence'),
    })
  }}
  disabled={disabled}
  data={{ cy: 'competence-tree-add-root' }}
>
  <Button.Icon icon={faPlus} />
  <Button.Label>{t('manage.competenceTree.addRootCompetence')}</Button.Label>
</Button>
```

Replace the selected-node icon-only plus with a labelled design-system button
using `manage.competenceTree.addSubcompetence`. Keep maximum-depth disabling and
all existing move/duplicate/delete icon actions.

After either add command updates `selectedKey`, focus the node-name input once.
Use a pending-focus ref and the existing node-name test hook; ordinary node
selection must not steal focus:

```tsx
const focusNewNode = useRef(false)

useEffect(() => {
  if (!focusNewNode.current || !selectedKey) return
  focusNewNode.current = false
  requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>('[data-cy="competence-tree-node-name"]')
      ?.focus()
  })
}, [selectedKey])
```

- [x] **Step 5: Add paired English/German copy**

```ts
addRootCompetence: 'Add root competence',
addSubcompetence: 'Add subcompetence',
newCompetence: 'New competence',
```

```ts
addRootCompetence: 'Kompetenz hinzufügen',
addSubcompetence: 'Teilkompetenz hinzufügen',
newCompetence: 'Neue Kompetenz',
```

- [x] **Step 6: Run focused tests and typecheck**

```bash
pnpm --filter @klicker-uzh/frontend-manage test:run
pnpm --filter @klicker-uzh/frontend-manage check
```

Expected: all Manage tests and TypeScript checks pass.

---

### Task 2: Visible First-Save Competence Assignment

**Files:**

- Modify: `apps/frontend-manage/src/components/elements/manipulation/ElementEditForm.tsx`
- Modify: `apps/frontend-manage/src/components/elements/manipulation/adaptive/AdaptiveElementMapping.tsx`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`
- Test: `apps/frontend-manage/src/components/elements/manipulation/adaptive/elementMappingRecovery.test.ts`

**Interfaces:**

- Consumes: `PendingAdaptiveMapping`, `savePendingMapping`, and the existing recovery state machine.
- Produces: optional create-mode disclosure and dynamic submit text; persistence APIs remain unchanged.

- [x] **Step 1: Extend recovery coverage for an optional first-save mapping**

Add an assertion that a payload with no pending mapping completes as
`element-saved`, while a complete pending mapping preserves the existing
`mapping-pending` and idempotent retry behavior. Do not add a second mapping
state machine.

- [x] **Step 2: Move mapping near the top of the supported element form**

Render `AdaptiveElementMapping` immediately after
`ElementInformationFields`, before content/answer configuration and before the
preview column. Remove its old rendering after `</Form>`.

The component remains outside Formik field ownership and continues receiving
the current element type and choice count.

- [x] **Step 3: Add create-mode progressive disclosure**

In `AdaptiveElementMapping`, maintain create-mode disclosure separately from
`pendingMapping`:

```tsx
const [createAssignmentEnabled, setCreateAssignmentEnabled] = useState(
  pendingMapping !== null
)

<Switch
  label={t('manage.elements.adaptiveMapping.assignDuringCreation')}
  checked={createAssignmentEnabled}
  onCheckedChange={(checked) => {
    setCreateAssignmentEnabled(checked)
    if (!checked) onPendingMappingChange(null)
  }}
  disabled={inputsDisabled}
  data={{ cy: 'adaptive-mapping-create-toggle' }}
/>
```

Show `PendingAdaptiveMappingEditor` only while the switch is enabled. Editing an
existing element continues to show its persisted mappings directly.

- [x] **Step 4: Make the create action describe the combined outcome**

In the primary submit button:

```tsx
{
  mode === ElementEditMode.CREATE && pendingMapping
    ? t('manage.elements.adaptiveMapping.createAndAssign')
    : t('shared.generic.save')
}
```

The label changes only after tree, leaf, and level produce a complete
`pendingMapping`.

- [x] **Step 5: Add paired English/German copy**

```ts
assignDuringCreation: 'Assign to a competence tree',
createAndAssign: 'Create element and assign',
```

```ts
assignDuringCreation: 'Einem Kompetenzbaum zuweisen',
createAndAssign: 'Element erstellen und zuweisen',
```

- [x] **Step 6: Run mapping tests and Manage typecheck**

```bash
pnpm --filter @klicker-uzh/frontend-manage test:run
pnpm --filter @klicker-uzh/frontend-manage check
```

Expected: recovery, tree-helper, navigation, and TypeScript checks pass.

---

### Task 3: Tree-Side Assignment Guidance

**Files:**

- Modify: `apps/frontend-manage/src/components/resources/competenceTrees/AssignmentTable.tsx`
- Modify: `apps/frontend-manage/src/pages/index.tsx`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`

**Interfaces:**

- Consumes: pages-router query parameter `createElement=true`.
- Produces: an empty-state action that opens the existing element creation modal.

- [x] **Step 1: Add a query-driven element-creation entry point**

In `pages/index.tsx`, extract the existing autosave-aware create handler and call
it from both the toolbar button and a guarded effect:

```tsx
useEffect(() => {
  if (!router.isReady || router.query.createElement !== 'true') return
  openElementCreation()
  const { createElement, ...query } = router.query
  void router.replace({ pathname: '/', query }, undefined, { shallow: true })
}, [openElementCreation, router])
```

Use `useCallback` so the effect is stable and preserve the existing autosave
recovery prompt behavior.

- [x] **Step 2: Add assignment guidance and the empty-state action**

Update the assignment description to state that mappings are added while
creating or editing elements. When there are no assignments and the tree is
editable, render:

```tsx
<Button
  onClick={() =>
    void router.push({
      pathname: '/',
      query: { createElement: 'true' },
    })
  }
  data={{ cy: 'competence-tree-create-element' }}
>
  <Button.Icon icon={faPlus} />
  <Button.Label>{t('manage.competenceTree.createElement')}</Button.Label>
</Button>
```

Keep the semantic table and its `colSpan={10}` empty row.

- [x] **Step 3: Add paired English/German guidance**

```ts
assignmentsDescription:
  'Review mappings for this tree. Add mappings while creating or editing an element.',
createElement: 'Create element',
```

Use the matching German keys:

```ts
assignmentsDescription:
  'Überprüfen Sie die Zuordnungen dieses Baums. Zuordnungen werden beim Erstellen oder Bearbeiten eines Elements hinzugefügt.',
createElement: 'Element erstellen',
```

- [x] **Step 4: Run Manage checks**

```bash
pnpm --filter @klicker-uzh/frontend-manage test:run
pnpm --filter @klicker-uzh/frontend-manage check
```

Expected: all focused tests and TypeScript checks pass.

---

### Task 4: Browser Regression And Documentation

**Files:**

- Modify: `playwright/tests/Z-adaptive-learning.spec.ts`
- Modify: `docs/adaptive-learning.md`
- Modify: `docs/log.md`
- Create: `project/screenshots/adaptive-learning-final/manage-add-root-competence.png`
- Create: `project/screenshots/adaptive-learning-final/manage-create-element-assignment.png`

**Interfaces:**

- Consumes: `competence-tree-add-root`,
  `adaptive-mapping-create-toggle`, and existing mapping selectors.
- Produces: release evidence for the complete author workflow.

- [x] **Step 1: Add a browser test for explicit hierarchy creation**

Extend the competence-tree editor journey to:

1. Click `competence-tree-add-root`.
2. Assert a second root exists and the name input is focused.
3. Rename it without using Duplicate.
4. Click the labelled add-subcompetence action.
5. Save and verify both branches after reload.

- [x] **Step 2: Add a browser test for first-save assignment**

From an empty/editable tree:

1. Follow **Create element**.
2. Choose a supported element type and complete valid content.
3. Enable `adaptive-mapping-create-toggle`.
4. Select the tree, leaf, and level.
5. Assert the submit text is **Create element and assign**.
6. Save once.
7. Reopen the tree and verify exactly one assignment row.

- [x] **Step 3: Run the focused Chromium suite**

```bash
pnpm --filter @klicker-uzh/playwright test -- \
  tests/Z-adaptive-learning.spec.ts \
  --project=chromium
```

Expected: all adaptive authoring journeys pass.

- [x] **Step 4: Perform real browser QA**

Use the running Manage app at `http://localhost:3302` with
`lecturer` / `abcd`. Capture desktop and mobile screenshots of:

- explicit root/subcompetence creation;
- the visible first-save competence assignment section.

Verify keyboard focus, no horizontal component overflow, English/German copy,
and no browser-console errors.

- [x] **Step 5: Update stable documentation**

Document the explicit root/child commands and first-save element assignment in
`docs/adaptive-learning.md`. Add a dated implementation/verification entry to
`docs/log.md`.

- [x] **Step 6: Run final verification**

```bash
pnpm --filter @klicker-uzh/frontend-manage test:run
pnpm --filter @klicker-uzh/frontend-manage check
pnpm --filter @klicker-uzh/playwright check
pnpm exec prettier --check \
  apps/frontend-manage/src/components/resources/competenceTrees \
  apps/frontend-manage/src/components/elements/manipulation \
  apps/frontend-manage/src/pages/index.tsx \
  packages/i18n/messages/en.ts \
  packages/i18n/messages/de.ts \
  playwright/tests/Z-adaptive-learning.spec.ts \
  docs/adaptive-learning.md \
  docs/log.md \
  --config .prettierrc.mjs
git diff --check
```

Expected: all commands pass with no formatting or whitespace errors.
