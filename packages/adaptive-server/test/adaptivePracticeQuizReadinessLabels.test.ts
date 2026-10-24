import { describe, expect, it } from 'vitest'
import type { AdaptiveQuizReadiness } from '../src/services/adaptivePracticeQuizReadiness.js'
import { annotateAdaptiveReadinessIssueLabels } from '../src/services/adaptivePracticeQuizReadinessLabels.js'

const nodes = [
  { id: 1, parentId: null, name: 'Grammar', depth: 0, order: 1 },
  { id: 2, parentId: null, name: 'Vocabulary', depth: 0, order: 0 },
  { id: 3, parentId: 1, name: 'Gender', depth: 1, order: 0 },
  { id: 4, parentId: 2, name: 'Food', depth: 1, order: 0 },
]
const levels = [
  { id: 10, label: 'A1.1', order: 0 },
  { id: 11, label: 'B2.1', order: 1 },
]

function readiness(
  overrides: Partial<AdaptiveQuizReadiness>
): AdaptiveQuizReadiness {
  return {
    ready: false,
    errors: [],
    warnings: [],
    coverages: [],
    rootReachability: [],
    enabledRootCount: 2,
    enabledLeafCount: 2,
    enabledAssignmentCount: 0,
    expectedQuestionCount: 0,
    estimatedDurationMinutes: 0,
    ...overrides,
  }
}

describe('annotateAdaptiveReadinessIssueLabels', () => {
  it('adds leaf, root and level labels to coverage issues', () => {
    const result = annotateAdaptiveReadinessIssueLabels(
      readiness({
        errors: [
          {
            code: 'ADAPTIVE_COVERAGE_BELOW_PRODUCT_MINIMUM',
            message: 'below',
            parameters: { minimumValue: 5, enabledAssignmentCount: 3 },
            leafNodeId: 3,
            levelId: 11,
          },
        ],
        warnings: [
          {
            code: 'ADAPTIVE_COVERAGE_BELOW_TARGET',
            message: 'target',
            parameters: {},
            leafNodeId: 4,
            levelId: 10,
          },
        ],
      }),
      { nodes, levels }
    )

    expect(result.errors[0]?.parameters).toEqual({
      minimumValue: 5,
      enabledAssignmentCount: 3,
      rootName: 'Grammar',
      leafName: 'Gender',
      leafOrder: 3,
      levelLabel: 'B2.1',
      levelOrder: 1,
    })
    // Vocabulary is ordered before Grammar, so its leaf comes first.
    expect(result.warnings[0]?.parameters).toMatchObject({
      rootName: 'Vocabulary',
      leafName: 'Food',
      leafOrder: 1,
      levelLabel: 'A1.1',
      levelOrder: 0,
    })
  })

  it('leaves issues without cell references and readiness flags unchanged', () => {
    const issue = {
      code: 'ADAPTIVE_NO_ENABLED_COMPETENCE',
      message: 'none',
      parameters: {},
    }
    const input = readiness({ errors: [issue] })
    const result = annotateAdaptiveReadinessIssueLabels(input, {
      nodes,
      levels,
    })

    expect(result.errors[0]).toBe(issue)
    expect(result.ready).toBe(false)
    expect(result.coverages).toBe(input.coverages)
  })
})
