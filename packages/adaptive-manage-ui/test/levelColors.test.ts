import {
  getAdaptiveLevelColors,
  hasAdaptiveLevelMarkerContrast,
} from '@klicker-uzh/adaptive-contract'
import {
  AdaptiveLevelMappingRule,
  AdaptiveNodeKind,
} from '@klicker-uzh/graphql/dist/ops'
import { describe, expect, test } from 'vitest'
import {
  getLevelColorRows,
  hasLevelColorOverrides,
  resetAllLevelColors,
  setLevelColor,
} from '../src/components/resources/competenceTrees/levelColors'
import {
  type CompetenceTreeForm,
  competenceTreeFormToInput,
  competenceTreeFormToMetadataInput,
  competenceTreeToForm,
  createDefaultCompetenceTreeForm,
} from '../src/components/resources/competenceTrees/types'

function savedTreeForm(): CompetenceTreeForm {
  return competenceTreeToForm({
    __typename: 'CompetenceTree',
    id: 'tree-1',
    name: 'Tree',
    displayName: 'Tree',
    description: null,
    maxDepth: 3,
    thetaMin: -3,
    thetaMax: 3,
    defaultDiscrimination: 1.2,
    levelMappingRule: AdaptiveLevelMappingRule.Nearest,
    levels: [
      { id: 12, label: 'B1', order: 1, color: '#ff8800', theta: 0 },
      { id: 11, label: 'A2', order: 0, color: null, theta: -1 },
    ],
    nodes: [
      {
        id: 1,
        kind: AdaptiveNodeKind.Competence,
        name: 'Root',
        description: null,
        order: 0,
        depth: 1,
        weight: 1,
        parentId: null,
      },
    ],
    levelCoverages: [],
    elementAssignments: [],
  } as unknown as Parameters<typeof competenceTreeToForm>[0])
}

describe('competence tree level colors', () => {
  test('rows use the shared palette as default and apply overrides only to that level', () => {
    const form = createDefaultCompetenceTreeForm({
      levels: ['Low', 'Medium', 'High'],
      root: 'Root',
      leaf: 'Leaf',
    })
    const defaults = getAdaptiveLevelColors(['Low', 'Medium', 'High'])
    expect(getLevelColorRows(form.levels).map((row) => row.color)).toEqual(
      defaults
    )

    const middleKey = form.levels[1]!.key
    const colored = setLevelColor(form, middleKey, '#FFAA00')
    const rows = getLevelColorRows(colored.levels)
    expect(rows.map((row) => row.color)).toEqual([
      defaults[0],
      '#ffaa00',
      defaults[2],
    ])
    expect(rows[1]).toMatchObject({
      override: '#ffaa00',
      defaultColor: defaults[1],
      lowContrast: false,
    })
    expect(rows[0]!.override).toBeNull()
    expect(hasLevelColorOverrides(colored)).toBe(true)
  })

  test('ignores invalid input, clears with null, and resets all colors', () => {
    const form = createDefaultCompetenceTreeForm({
      levels: ['Low', 'Medium', 'High'],
      root: 'Root',
      leaf: 'Leaf',
    })
    const key = form.levels[0]!.key
    expect(setLevelColor(form, key, '#12')).toBe(form)
    expect(setLevelColor(form, key, 'blue')).toBe(form)
    const colored = setLevelColor(form, key, '#123456')
    expect(setLevelColor(colored, key, null).levels[0]!.color).toBeNull()
    expect(setLevelColor(colored, key, '  ').levels[0]!.color).toBeNull()
    const reset = resetAllLevelColors(
      setLevelColor(colored, form.levels[2]!.key, '#abcdef')
    )
    expect(reset.levels.every((level) => level.color === null)).toBe(true)
    expect(hasLevelColorOverrides(reset)).toBe(false)
  })

  test('flags overrides with poor estimate-marker contrast only', () => {
    const form = createDefaultCompetenceTreeForm({
      levels: ['Low', 'Medium', 'High'],
      root: 'Root',
      leaf: 'Leaf',
    })
    const dark = setLevelColor(form, form.levels[2]!.key, '#102040')
    expect(hasAdaptiveLevelMarkerContrast('#102040')).toBe(false)
    expect(
      getLevelColorRows(dark.levels).map((row) => row.lowContrast)
    ).toEqual([false, false, true])
  })

  test('round-trips colors through form, tree input, and locked metadata input', () => {
    const form = savedTreeForm()
    expect(form.levels.map(({ key, color }) => ({ key, color }))).toEqual([
      { key: 'level:11', color: null },
      { key: 'level:12', color: '#ff8800' },
    ])

    const edited = setLevelColor(form, 'level:11', '#ABCDEF')
    expect(
      competenceTreeFormToInput(edited).levels.map(({ key, color }) => ({
        key,
        color,
      }))
    ).toEqual([
      { key: 'level:11', color: '#abcdef' },
      { key: 'level:12', color: '#ff8800' },
    ])

    const withNewLevel: CompetenceTreeForm = {
      ...resetAllLevelColors(edited),
      levels: [
        ...resetAllLevelColors(edited).levels,
        { key: 'level:local:1', label: 'C1', order: 2, color: '#00ff00' },
      ],
    }
    // Unsaved levels have no id; locked trees cannot add levels anyway.
    expect(competenceTreeFormToMetadataInput(withNewLevel)).toMatchObject({
      name: 'Tree',
      displayName: 'Tree',
      levelColors: [
        { levelId: 11, color: null },
        { levelId: 12, color: null },
      ],
    })
    expect(
      competenceTreeFormToMetadataInput(edited).levelColors
    ).toContainEqual({ levelId: 11, color: '#abcdef' })
  })
})
