import { GraphQLError } from 'graphql'
import { prepareTreeInput } from '../src/services/competenceTreeInput.js'
import {
  assertValidCompetenceTreeShape,
  deriveAdaptiveItemParameters,
  hasControlledAdaptiveAnswer,
  isSupportedAdaptiveElementType,
  validateCompetenceTreeShape,
  type CompetenceTreeValidationInput,
} from '../src/services/competenceTrees.js'

const validTree: CompetenceTreeValidationInput = {
  maxDepth: 5,
  levels: [
    { id: 1, label: 'A1', order: 0 },
    { id: 2, label: 'A2', order: 1 },
    { id: 3, label: 'B1', order: 2 },
  ],
  nodes: [
    {
      id: 10,
      kind: 'COMPETENCE',
      name: 'Reading',
      order: 0,
      depth: 1,
      weight: 2,
    },
    {
      id: 11,
      kind: 'SUBCOMPETENCE',
      name: 'Scanning',
      parentId: 10,
      order: 0,
      depth: 2,
    },
  ],
  coverages: [{ leafNodeId: 11, levelId: 1, targetItemCount: 3 }],
  assignments: [{ elementId: 100, type: 'SC', leafNodeId: 11, levelId: 1 }],
}

describe('competence tree validation', () => {
  it('accepts a valid competence tree and normalizes root weights', () => {
    const result = validateCompetenceTreeShape(validTree)

    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.normalizedRootWeights).toEqual([{ nodeId: 10, weight: 1 }])
  })

  it('enforces root kind, child kind, and depth semantics', () => {
    const result = validateCompetenceTreeShape({
      ...validTree,
      maxDepth: 6,
      nodes: [
        {
          id: 10,
          kind: 'SUBCOMPETENCE',
          name: 'Reading',
          order: 0,
          depth: 2,
        },
        {
          id: 11,
          kind: 'COMPETENCE',
          name: 'Scanning',
          parentId: 10,
          order: 0,
          depth: 4,
        },
      ],
    })

    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        'TREE_MAX_DEPTH_TOO_DEEP',
        'ROOT_KIND_INVALID',
        'ROOT_DEPTH_INVALID',
        'CHILD_KIND_INVALID',
        'NODE_DEPTH_MISMATCH',
      ])
    )
  })

  it('rejects unsupported assignment types and assignments to non-leaves', () => {
    const result = validateCompetenceTreeShape({
      ...validTree,
      nodes: [
        ...validTree.nodes,
        {
          id: 12,
          kind: 'SUBCOMPETENCE',
          name: 'Details',
          parentId: 11,
          order: 0,
          depth: 3,
        },
      ],
      coverages: [],
      assignments: [
        { elementId: 100, type: 'CONTENT', leafNodeId: 11, levelId: 1 },
      ],
    })

    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        'ASSIGNMENT_TYPE_UNSUPPORTED',
        'ASSIGNMENT_LEAF_NOT_LEAF',
        'LEAF_WITHOUT_COVERAGE',
      ])
    )
  })

  it('requires enabled roots to have enabled leaves and leaves to have coverage', () => {
    const result = validateCompetenceTreeShape({
      ...validTree,
      nodes: [
        {
          id: 10,
          kind: 'COMPETENCE',
          name: 'Reading',
          order: 0,
          depth: 1,
        },
        {
          id: 11,
          kind: 'SUBCOMPETENCE',
          name: 'Scanning',
          parentId: 10,
          order: 0,
          depth: 2,
          enabled: false,
        },
        {
          id: 20,
          kind: 'COMPETENCE',
          name: 'Writing',
          order: 1,
          depth: 1,
        },
        {
          id: 21,
          kind: 'SUBCOMPETENCE',
          name: 'Structure',
          parentId: 20,
          order: 0,
          depth: 2,
        },
      ],
      coverages: [],
      assignments: [],
    })

    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        'ROOT_WITHOUT_ENABLED_LEAF',
        'LEAF_WITHOUT_COVERAGE',
      ])
    )
  })

  it('warns for shallow levels and non-root weights', () => {
    const result = validateCompetenceTreeShape({
      ...validTree,
      levels: [
        { id: 1, label: 'A1', order: 0 },
        { id: 2, label: 'A2', order: 1 },
      ],
      nodes: [
        {
          id: 10,
          kind: 'COMPETENCE',
          name: 'Reading',
          order: 0,
          depth: 1,
        },
        {
          id: 11,
          kind: 'SUBCOMPETENCE',
          name: 'Scanning',
          parentId: 10,
          order: 0,
          depth: 2,
          weight: 3,
        },
      ],
    })

    expect(result.valid).toBe(true)
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['LEVEL_COUNT_LOW', 'NON_ROOT_WEIGHT_IGNORED'])
    )
  })

  it('throws a GraphQL error with validation issues for invalid trees', () => {
    expect(() =>
      assertValidCompetenceTreeShape({ ...validTree, levels: [] })
    ).toThrow(GraphQLError)
  })

  it('derives adaptive item parameters from supported item type and level theta', () => {
    expect(
      deriveAdaptiveItemParameters({
        type: 'SC',
        choiceCount: 4,
        levelTheta: -1,
      })
    ).toEqual({ a: 1.2, b: -1, c: 0.25 })

    expect(() =>
      deriveAdaptiveItemParameters({
        type: 'CONTENT',
        levelTheta: -1,
      })
    ).toThrow(GraphQLError)
  })

  it('supports exactly the five reviewed adaptive element types', () => {
    expect(
      ['NUMERICAL', 'SC', 'MC', 'KPRIM', 'FREE_TEXT'].every(
        isSupportedAdaptiveElementType
      )
    ).toBe(true)
    expect(
      ['CONTENT', 'FLASHCARD', 'SELECTION', 'CASE_STUDY'].every(
        (type) => !isSupportedAdaptiveElementType(type)
      )
    ).toBe(true)
  })

  it('requires controlled non-empty answers for adaptive free text', () => {
    expect(
      hasControlledAdaptiveAnswer('FREE_TEXT', {
        solutions: [' Zurich ', 'Zuerich'],
      })
    ).toBe(true)
    expect(
      hasControlledAdaptiveAnswer('FREE_TEXT', { solutions: ['   '] })
    ).toBe(false)
    expect(
      hasControlledAdaptiveAnswer('FREE_TEXT', { solutions: ['Zurich', 42] })
    ).toBe(false)
    expect(
      hasControlledAdaptiveAnswer('FREE_TEXT', { solutions: ['Zurich', ''] })
    ).toBe(false)

    const result = validateCompetenceTreeShape({
      ...validTree,
      assignments: [
        {
          elementId: 100,
          type: 'FREE_TEXT',
          leafNodeId: 11,
          levelId: 1,
          controlledAnswerReady: false,
        },
      ],
    })
    expect(result.errors.map(({ code }) => code)).toContain(
      'ASSIGNMENT_CONTROLLED_ANSWER_REQUIRED'
    )
  })

  it('rejects zero weights on every enabled root', () => {
    const result = validateCompetenceTreeShape({
      ...validTree,
      nodes: validTree.nodes.map((node) =>
        node.parentId == null ? { ...node, weight: 0 } : node
      ),
    })

    expect(result.normalizedRootWeights).toEqual([])
    expect(result.errors.map(({ code }) => code)).toContain(
      'ROOT_WEIGHT_INVALID'
    )
  })

  it('rejects a zero enabled root even when another root is positive', () => {
    const result = validateCompetenceTreeShape({
      ...validTree,
      nodes: [
        ...validTree.nodes,
        {
          id: 20,
          kind: 'COMPETENCE',
          name: 'Writing',
          order: 1,
          depth: 1,
          weight: 0,
        },
        {
          id: 21,
          kind: 'SUBCOMPETENCE',
          name: 'Composition',
          parentId: 20,
          order: 0,
          depth: 2,
        },
      ],
      coverages: [
        ...(validTree.coverages ?? []),
        { leafNodeId: 21, levelId: 1, targetItemCount: 3 },
      ],
    })

    expect(result.normalizedRootWeights).toEqual([])
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'ROOT_WEIGHT_INVALID',
        path: 'nodes.2.weight',
      })
    )
  })

  it('rejects cycles and duplicate sibling positions', () => {
    const result = validateCompetenceTreeShape({
      ...validTree,
      nodes: [
        {
          id: 10,
          kind: 'SUBCOMPETENCE',
          name: 'Reading',
          parentId: 11,
          order: 0,
          depth: 6,
        },
        {
          id: 11,
          kind: 'SUBCOMPETENCE',
          name: 'Scanning',
          parentId: 10,
          order: 0,
          depth: 6,
        },
      ],
      coverages: [],
      assignments: [],
    })

    expect(result.valid).toBe(false)
    expect(result.errors.map(({ code }) => code)).toEqual(
      expect.arrayContaining(['NODE_CYCLE', 'ROOT_COUNT_TOO_LOW'])
    )

    const duplicateOrder = validateCompetenceTreeShape({
      ...validTree,
      nodes: [
        ...validTree.nodes,
        {
          id: 12,
          kind: 'SUBCOMPETENCE',
          name: 'Skimming',
          parentId: 10,
          order: 0,
          depth: 2,
        },
      ],
      coverages: [
        ...validTree.coverages!,
        { leafNodeId: 12, levelId: 1, targetItemCount: 3 },
      ],
    })

    expect(duplicateOrder.errors.map(({ code }) => code)).toContain(
      'NODE_SIBLING_ORDER_DUPLICATE'
    )
  })

  it('rejects duplicate coverage cells and element assignments', () => {
    const result = validateCompetenceTreeShape({
      ...validTree,
      coverages: [
        ...validTree.coverages!,
        { leafNodeId: 11, levelId: 1, targetItemCount: 4 },
      ],
      assignments: [
        ...validTree.assignments!,
        { elementId: 100, type: 'SC', leafNodeId: 11, levelId: 1 },
      ],
    })

    expect(result.errors.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'COVERAGE_DUPLICATE',
        'ASSIGNMENT_ELEMENT_DUPLICATE',
      ])
    )

    const disabledCoverage = validateCompetenceTreeShape({
      ...validTree,
      coverages: validTree.coverages?.map((coverage) => ({
        ...coverage,
        enabled: false,
      })),
    })
    expect(disabledCoverage.errors.map(({ code }) => code)).toContain(
      'ASSIGNMENT_COVERAGE_DISABLED'
    )
  })

  it('requires subcompetence leaves and limits percent input to numerical items', () => {
    const result = validateCompetenceTreeShape({
      ...validTree,
      nodes: [
        {
          id: 10,
          kind: 'COMPETENCE',
          name: 'Reading',
          order: 0,
          depth: 1,
        },
      ],
      coverages: [{ leafNodeId: 10, levelId: 1, targetItemCount: 3 }],
      assignments: [
        {
          elementId: 100,
          type: 'SC',
          leafNodeId: 10,
          levelId: 1,
          enablePercentInput: true,
        },
      ],
    })

    expect(result.errors.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'ROOT_WITHOUT_SUBCOMPETENCE',
        'COVERAGE_LEAF_KIND_INVALID',
        'ASSIGNMENT_LEAF_KIND_INVALID',
        'ASSIGNMENT_PERCENT_INPUT_INVALID',
      ])
    )
  })

  it('rejects non-contiguous ordering and branches deeper than five', () => {
    const result = validateCompetenceTreeShape({
      ...validTree,
      levels: validTree.levels.map((level, index) => ({
        ...level,
        order: index + 1,
      })),
      nodes: [
        {
          id: 10,
          kind: 'COMPETENCE',
          name: 'Reading',
          order: 1,
          depth: 1,
        },
        ...[11, 12, 13, 14, 15].map((id, index) => ({
          id,
          kind: 'SUBCOMPETENCE' as const,
          name: `Depth ${index + 2}`,
          parentId: id - 1,
          order: 0,
          depth: index + 2,
        })),
      ],
      coverages: [{ leafNodeId: 15, levelId: 1, targetItemCount: 3 }],
      assignments: [{ elementId: 100, type: 'SC', leafNodeId: 15, levelId: 1 }],
    })

    expect(result.errors.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'LEVEL_ORDER_NOT_CONTIGUOUS',
        'NODE_SIBLING_ORDER_NOT_CONTIGUOUS',
        'NODE_DEPTH_OUT_OF_RANGE',
      ])
    )
  })

  it('validates tree metadata together with its hierarchy', () => {
    const result = validateCompetenceTreeShape({
      ...validTree,
      name: ' ',
      displayName: '',
      thetaMin: 2,
      thetaMax: -2,
      defaultDiscrimination: 0,
    })

    expect(result.errors.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'TREE_NAME_EMPTY',
        'TREE_DISPLAY_NAME_EMPTY',
        'TREE_THETA_RANGE_INVALID',
        'TREE_DISCRIMINATION_INVALID',
      ])
    )

    const extremeValues = validateCompetenceTreeShape({
      ...validTree,
      thetaMin: -1e308,
      thetaMax: 1e308,
      defaultDiscrimination: 11,
      nodes: validTree.nodes.map((node, index) => ({
        ...node,
        weight: index === 0 ? 1e308 : node.weight,
      })),
      assignments: validTree.assignments?.map((assignment) => ({
        ...assignment,
        discrimination: 11,
      })),
    })

    expect(extremeValues.errors.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        'TREE_THETA_RANGE_INVALID',
        'TREE_DISCRIMINATION_INVALID',
        'ASSIGNMENT_DISCRIMINATION_INVALID',
      ])
    )
    expect(
      extremeValues.normalizedRootWeights.every(({ weight }) =>
        Number.isFinite(weight)
      )
    ).toBe(true)
  })

  it('rejects oversized hierarchy inputs before deriving depth', () => {
    const prepared = prepareTreeInput({
      name: 'depths',
      displayName: 'Depths',
      levels: [
        { key: 'one', label: 'One', order: 0 },
        { key: 'two', label: 'Two', order: 1 },
      ],
      nodes: [
        {
          key: 'root',
          kind: 'COMPETENCE',
          name: 'Root',
          order: 0,
        },
        {
          key: 'leaf',
          parentKey: 'root',
          kind: 'SUBCOMPETENCE',
          name: 'Leaf',
          order: 0,
        },
      ],
      coverages: [],
      assignments: [],
    })
    expect(prepared.nodes.map(({ depth }) => depth)).toEqual([1, 2])

    expect(() =>
      prepareTreeInput({
        name: 'oversized',
        displayName: 'Oversized',
        levels: [
          { key: 'one', label: 'One', order: 0 },
          { key: 'two', label: 'Two', order: 1 },
        ],
        nodes: Array.from({ length: 501 }, (_, index) => ({
          key: `node-${index}`,
          kind: 'COMPETENCE',
          name: `Node ${index}`,
          order: index,
        })),
        coverages: [],
        assignments: [],
      })
    ).toThrow('the maximum is 500')
  })
})
