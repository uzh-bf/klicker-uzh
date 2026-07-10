# Adaptive Feature Plan Template

## Contents

- [How To Use](#how-to-use)
- [Template](#template)

## How To Use

Use or adapt these sections in the repository's canonical in-progress plan file. Follow the repository's path and naming convention rather than assuming one fixed location.

## Template

```markdown
# <Feature> Production-Readiness Plan

Created: YYYY-MM-DD
Updated: YYYY-MM-DD

Review corpus:

- `<review paths>`

Reference concepts:

- `<prototype paths or URLs>`

## Goal

<One paragraph describing the complete production outcome.>

## Non-Goals

- <Explicit exclusions and legacy surfaces not to revive.>

## Requirement And Review Coverage

| Requirement/finding | Current evidence | Plan coverage |
| ------------------- | ---------------- | ------------- |
| ...                 | ...              | Phase ...     |

## Domain Vocabulary And Decisions

- Activity type:
- Reusable object:
- Quiz/activity config:
- Source versus snapshot:
- Actors:
- Hierarchy and maximum depth:
- Supported item types:
- Presets, attempts, gamification, results:

## Measurement Contract

### Item Parameters

### Selection And Stopping

### Hierarchical Estimation

### Weight And Uncertainty Aggregation

### Level Mapping And Insufficient Data

### Student Result Trajectory

## Experience Architecture

### Reference-To-Product Mapping

### Authoring And Tree Editor

### Activity Wizard

### Participant Runtime And Result

### Lecturer Results

### Design-System And Accessibility Contract

## Data And Lifecycle Contract

### Publication Snapshot

### Edit/Version/Deletion Policy

### Legacy Migration

## Permissions And Privacy

| Operation | Actor | Authorization/redaction |
| --------- | ----- | ----------------------- |
| ...       | ...   | ...                     |

## Layer Footprint

- Prisma/data:
- Adaptive computation package:
- GraphQL services/schema/ops/codegen:
- Manage UI:
- Participant UI:
- i18n/shared components:
- Async/gamification/embed compatibility:
- Docs/CI:

## Canonical Service Boundaries

- `<helper/service names and responsibilities>`

## Implementation Slices

### Phase N - <Outcome>

Purpose: <why this phase exists>

Tasks:

- [ ] <Exact implementation action and owner boundary>

Acceptance criteria:

- <Observable behavior>

Verification:

- `<targeted commands>`
- <service/contract/browser evidence>

## Next Recommended Slice

<Smallest stable vertical slice, excluding dependent UI when the API is not ready.>

## Verification Matrix

| Change type | Required evidence |
| ----------- | ----------------- |
| ...         | ...               |

## Seeds, Fixtures, And Migration

## Pilot, Rollout, And Cleanup

## Open Evolution Decisions

<Only decisions that do not block the first slice; state interim defaults.>

## Progress Log

- YYYY-MM-DD: <implemented and verified state>
```
