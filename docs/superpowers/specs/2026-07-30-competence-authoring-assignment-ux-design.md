# Competence Authoring And Element Assignment UX

Date: 2026-07-30

## Problem

The competence-tree hierarchy exposes an icon-only plus action that adds a child
to the selected node, but it has no explicit action for adding another root
competence. Authors therefore discover branch duplication as the only practical
way to create a second competence.

Supported elements can already be assigned to a competence tree during their
first save, but the adaptive-mapping section is buried near the bottom of the
element modal. The tree editor's assignment table can review, enable, and
remove assignments, but does not explain where assignments are created.

## Decisions

- Creating a root competence and creating a nested subcompetence are separate,
  explicitly labelled actions.
- Duplicate remains a copy operation and is never presented as a creation path.
- Competence assignment is an optional, visible part of creating a supported
  element before its first save.
- The element form remains the single place that creates assignments. The tree
  assignment table remains a review surface and links authors to element
  creation rather than implementing a second assignment workflow.
- The first-save flow supports one initial tree assignment. Additional tree
  assignments remain available when editing the saved element.
- Existing psychometric rules remain unchanged: the author selects the leaf and
  level, `b` comes from that level, `c` is inferred from the element type, and
  `a` uses the reviewed tree/default value.

## Hierarchy Interaction

The hierarchy outline has a visible **Add root competence** button above the
node list. It creates a new root with a default name and weight, selects it, and
moves focus to its name field.

The selected-node panel has a labelled **Add subcompetence** command. It creates
a child beneath the selected node, expands the parent, selects the new child,
and moves focus to its name field. At maximum depth the command is disabled
with the existing maximum-depth explanation.

Move, duplicate, and delete remain secondary icon actions with tooltips and
accessible names. **Duplicate branch** copies the selected branch and is not
used to create an empty competence.

## Element Creation Interaction

For Numerical, SC, MC, KPRIM, and controlled-answer Free Text elements, the
create form shows a prominent **Competence assignment** section before the
preview. Unsupported element types show no assignment controls.

The section starts with an optional **Assign to a competence tree** switch.
When disabled, element creation behaves exactly as it does today. When enabled,
the section exposes:

- a searchable competence-tree selector;
- a leaf-subcompetence selector using the full hierarchy breadcrumb;
- a level selector limited to enabled coverage cells;
- the derived difficulty `b`;
- the default/effective discrimination `a`;
- the inferred guessing parameter `c`;
- percentage-input behavior for Numerical elements.

Once the required assignment fields are complete, the primary form action reads
**Create element and assign**. Without an assignment it retains the standard
create label. The assignment is optional and does not block ordinary element
creation while the switch is off.

## Persistence And Recovery

The persistence boundary remains honest:

1. Validate the element and assignment draft.
2. Create the element and receive its ID.
3. Create the competence-tree assignment using that ID.
4. Close the form only after both outcomes are known.

If element creation fails, no assignment is attempted. If the element succeeds
but assignment fails, keep the modal in the existing recovery state and offer
**Retry assignment** or **Keep element unmapped**. Retrying is idempotent and
must not create a duplicate element or assignment.

## Assignment Overview

The competence-tree assignment table continues to show element, type, leaf,
level, `a`, `b`, `c`, enabled state, numerical percentage input, and removal.
Its description and empty state explain that mappings are created while
creating or editing elements.

When editable, the empty state includes **Create element**. The action opens the
normal element-creation surface; it does not preselect an unsupported element
type or introduce a tree-owned element picker. Existing assignments remain
filterable through leaf-level coverage cells.

## Accessibility And Responsive Behavior

- Root and child creation use visible text plus familiar icons.
- Every command has an accessible name and stable focus behavior.
- New nodes are announced through selection and focus rather than transient
  color alone.
- The assignment switch is programmatically associated with its section.
- Tree, leaf, and level selectors retain explicit labels and keyboard support.
- Parameter summaries use descriptive terms in addition to `a`, `b`, and `c`.
- The hierarchy commands and assignment form fit narrow viewports without
  overlapping or resizing their containers.
- English and German copy are added together.

## Verification

- Unit tests cover adding a root, adding a child, maximum depth, normalized root
  weights, branch duplication, selection, and focus targets.
- Element-form tests cover the optional assignment switch, required fields,
  supported and unsupported element types, and dynamic create-button copy.
- Service/UI integration tests cover successful first-save assignment, element
  failure, assignment failure, idempotent retry, and keeping the element
  unmapped.
- Playwright covers creating two root competences without duplication, creating
  a nested subcompetence, assigning a newly created element before first save,
  and verifying the assignment in the tree table.
- Browser verification includes desktop and mobile English/German states.

## Non-Goals

- Bulk assignment from the tree editor.
- Multiple initial tree assignments before the first element save.
- Changes to psychometric parameter inference or readiness rules.
- New activity types or changes to adaptive PracticeQuiz delivery.

## Success Criteria

An author can create a second root competence without using Duplicate and can
discover, configure, save, and verify an element's initial competence-tree
assignment without leaving the element-creation workflow.
