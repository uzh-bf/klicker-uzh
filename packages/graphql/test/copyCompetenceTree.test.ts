import type { CompetenceTreeInput } from '@klicker-uzh/adaptive-server/services/competenceTreeInput'
import {
  filterReadableAssignments,
  readCopyCompetenceTreeConfig,
  remapAssignedElements,
  summarizeIds,
} from '../src/scripts/copyCompetenceTree.js'

const TREE_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'

describe('copyCompetenceTree config', () => {
  it('defaults to a dry run that fails on unreadable assignments', () => {
    const config = readCopyCompetenceTreeConfig({
      SOURCE_TREE_ID: TREE_ID,
      TARGET_USERNAME: 'lecturer2',
    })
    expect(config).toMatchObject({
      sourceTreeId: TREE_ID,
      targetUsername: 'lecturer2',
      targetUserId: null,
      assignedElements: 'require-readable',
      dryRun: true,
    })
  })

  it('writes only when DRY_RUN is exactly "false"', () => {
    const base = { SOURCE_TREE_ID: TREE_ID, TARGET_USER_ID: USER_ID }
    expect(
      readCopyCompetenceTreeConfig({ ...base, DRY_RUN: 'no' }).dryRun
    ).toBe(true)
    expect(
      readCopyCompetenceTreeConfig({ ...base, DRY_RUN: 'false' }).dryRun
    ).toBe(false)
  })

  it.each([
    [{ TARGET_USERNAME: 'lecturer2' }, 'SOURCE_TREE_ID'],
    [{ SOURCE_TREE_ID: 'not-a-uuid', TARGET_USERNAME: 'x' }, 'SOURCE_TREE_ID'],
    [{ SOURCE_TREE_ID: TREE_ID }, 'exactly one'],
    [
      {
        SOURCE_TREE_ID: TREE_ID,
        TARGET_USERNAME: 'x',
        TARGET_USER_ID: USER_ID,
      },
      'exactly one',
    ],
    [
      { SOURCE_TREE_ID: TREE_ID, TARGET_USERNAME: 'someone@example.com' },
      'not an email',
    ],
    [
      {
        SOURCE_TREE_ID: TREE_ID,
        TARGET_USERNAME: 'x',
        ASSIGNED_ELEMENTS: 'skip',
      },
      'ASSIGNED_ELEMENTS must be one of',
    ],
    [
      {
        SOURCE_TREE_ID: TREE_ID,
        TARGET_USERNAME: 'x',
        UNREADABLE_ASSIGNMENTS: 'drop',
      },
      'replaced by ASSIGNED_ELEMENTS',
    ],
  ])('rejects invalid input %#', (env, message) => {
    expect(() => readCopyCompetenceTreeConfig(env)).toThrow(message)
  })
})

describe('filterReadableAssignments', () => {
  const input = {
    name: 'tree',
    displayName: 'Tree',
    levels: [],
    nodes: [],
    coverages: [],
    assignments: [
      { elementId: 3, leafKey: 'a', levelKey: 'l', enabled: true },
      { elementId: 1, leafKey: 'b', levelKey: 'l', enabled: true },
      { elementId: 3, leafKey: 'c', levelKey: 'l', enabled: true },
      { elementId: 2, leafKey: 'a', levelKey: 'l', enabled: true },
    ],
  } as unknown as CompetenceTreeInput

  it('keeps every assignment when all elements are readable', () => {
    const result = filterReadableAssignments(input, new Set([1, 2, 3]))
    expect(result.droppedElementIds).toEqual([])
    expect(result.input.assignments).toHaveLength(4)
  })

  it('drops assignments of unreadable elements and reports them once', () => {
    const result = filterReadableAssignments(input, new Set([2]))
    expect(result.droppedElementIds).toEqual([1, 3])
    expect(result.input.assignments.map((a) => a.elementId)).toEqual([2])
    expect(input.assignments).toHaveLength(4)
  })
})

describe('remapAssignedElements', () => {
  it('points copied questions at their copies and keeps owned ones', () => {
    const input = {
      name: 'tree',
      displayName: 'Tree',
      levels: [],
      nodes: [],
      coverages: [],
      assignments: [
        { elementId: 1, leafKey: 'a', levelKey: 'l', enabled: true },
        { elementId: 2, leafKey: 'b', levelKey: 'l', enabled: true },
      ],
    } as unknown as CompetenceTreeInput
    const result = remapAssignedElements(input, new Map([[1, 101]]))
    expect(result.assignments.map((a) => a.elementId)).toEqual([101, 2])
    expect(result.assignments[0]).toMatchObject({ leafKey: 'a' })
    expect(input.assignments[0]?.elementId).toBe(1)
  })
})

describe('summarizeIds', () => {
  it('prints short lists in full', () => {
    expect(summarizeIds([1, 2, 3])).toBe('1, 2, 3')
  })

  it('truncates long lists and states the total', () => {
    const ids = Array.from({ length: 3822 }, (_, index) => index + 1)
    const summary = summarizeIds(ids)
    expect(summary.startsWith('1, 2, 3')).toBe(true)
    expect(summary).toContain('(3822 in total')
    expect(summary).not.toContain(', 21,')
  })
})
