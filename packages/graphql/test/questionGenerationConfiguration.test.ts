import {
  allocateQuestionGenerationDifficulty,
  type KBGraphSourceSnapshot,
} from '@klicker-uzh/types'
import {
  normalizeQuestionGenerationConfiguration,
  type QuestionGenerationConfigurationInput,
} from '../src/services/questionGenerationConfiguration.js'

const sourceSnapshot: KBGraphSourceSnapshot = [
  {
    resourceId: '98a8fe52-c154-4450-8392-cf78d095695b',
    title: 'Wine Chemistry',
    sourceFile: 'wine-chemistry.pdf',
    contentSha256: 'a'.repeat(64),
    resourceVersion: 1,
    pageCount: 12,
  },
  {
    resourceId: 'cc63633a-4df5-4854-a7a3-37ca5eb60509',
    title: 'Fermentation Notes',
    sourceFile: 'fermentation-notes.pdf',
    contentSha256: 'b'.repeat(64),
    resourceVersion: 2,
    pageCount: null,
  },
]
const graphVersion = { language: 'de', sourceSnapshot }

function configurationInput(
  overrides: Partial<QuestionGenerationConfigurationInput> = {}
): QuestionGenerationConfigurationInput {
  return {
    language: 'de',
    questionCount: 6,
    difficultyPreset: 'MIXED',
    sourceScopes: [],
    objectives: [],
    bloomLevels: [],
    ...overrides,
  }
}

describe('question generation configuration', () => {
  it.each([
    'EASY',
    'MIXED',
    'HARD',
  ] as const)('allocates every supported total for %s without losing questions', (preset) => {
    for (let count = 1; count <= 20; count++) {
      const allocation = allocateQuestionGenerationDifficulty(count, preset)
      const values = Object.values(allocation)

      expect(values.reduce((sum, value) => sum + value, 0)).toBe(count)
      expect(values.every(Number.isInteger)).toBe(true)

      if (preset === 'EASY') {
        expect(allocation.d4).toBe(0)
        expect(allocation.d5).toBe(0)
      }
      if (preset === 'HARD') {
        expect(allocation.d1).toBe(0)
        expect(allocation.d2).toBe(0)
      }
    }
  })

  it('uses ascending difficulty number to break equal remainders', () => {
    expect(allocateQuestionGenerationDifficulty(6, 'MIXED')).toEqual({
      d1: 1,
      d2: 1,
      d3: 2,
      d4: 1,
      d5: 1,
    })
    expect(allocateQuestionGenerationDifficulty(1, 'EASY')).toEqual({
      d1: 1,
      d2: 0,
      d3: 0,
      d4: 0,
      d5: 0,
    })
    expect(allocateQuestionGenerationDifficulty(1, 'HARD')).toEqual({
      d1: 0,
      d2: 0,
      d3: 0,
      d4: 1,
      d5: 0,
    })
  })

  it('canonicalizes source scopes, objectives, Bloom levels, and its hash', () => {
    const first = normalizeQuestionGenerationConfiguration(
      configurationInput({
        sourceScopes: [
          {
            resourceId: sourceSnapshot[1]!.resourceId,
            pageFrom: 2,
            pageTo: 5,
          },
          {
            resourceId: sourceSnapshot[0]!.resourceId,
            pageFrom: null,
            pageTo: null,
          },
        ],
        objectives: [
          { text: '  Explain malolactic fermentation.  ', bloomLevel: 'apply' },
          { text: 'Compare acid profiles.', bloomLevel: null },
        ],
        bloomLevels: ['evaluate', 'remember', 'evaluate'],
      }),
      graphVersion
    )
    const second = normalizeQuestionGenerationConfiguration(
      configurationInput({
        sourceScopes: [
          {
            resourceId: sourceSnapshot[0]!.resourceId,
            pageFrom: null,
            pageTo: null,
          },
          {
            resourceId: sourceSnapshot[1]!.resourceId,
            pageFrom: 2,
            pageTo: 5,
          },
        ],
        objectives: [
          { text: 'Explain malolactic fermentation.', bloomLevel: 'apply' },
          { text: 'Compare acid profiles.', bloomLevel: null },
        ],
        bloomLevels: ['remember', 'evaluate'],
      }),
      graphVersion
    )

    expect(first).toEqual(second)
    expect(first.configuration).toMatchObject({
      difficultyCounts: { d1: 1, d2: 1, d3: 2, d4: 1, d5: 1 },
      sourceScopes: [
        {
          resourceId: sourceSnapshot[0]!.resourceId,
          pageFrom: null,
          pageTo: null,
        },
        {
          resourceId: sourceSnapshot[1]!.resourceId,
          pageFrom: 2,
          pageTo: 5,
        },
      ],
      objectives: [
        {
          id: 'OBJ-01',
          text: 'Explain malolactic fermentation.',
          bloomLevel: 'apply',
        },
        {
          id: 'OBJ-02',
          text: 'Compare acid profiles.',
          bloomLevel: null,
        },
      ],
      bloomLevels: ['remember', 'evaluate'],
    })
    expect(first.configurationHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('uses the complete graph snapshot when no source scope is selected', () => {
    const result = normalizeQuestionGenerationConfiguration(
      configurationInput(),
      graphVersion
    )

    expect(result.configuration.sourceScopes).toEqual(
      sourceSnapshot.map((source) => ({
        resourceId: source.resourceId,
        pageFrom: null,
        pageTo: null,
      }))
    )
  })

  it('defaults legacy callers to SC and hashes MC and KPRIM distinctly', () => {
    const singleChoice = normalizeQuestionGenerationConfiguration(
      configurationInput(),
      graphVersion
    )
    const kprim = normalizeQuestionGenerationConfiguration(
      configurationInput({
        itemType: 'KPRIM',
      } as Partial<QuestionGenerationConfigurationInput>),
      graphVersion
    )
    const multipleChoice = normalizeQuestionGenerationConfiguration(
      configurationInput({ itemType: 'MC' }),
      graphVersion
    )

    expect(singleChoice.configuration).toMatchObject({ itemType: 'SC' })
    expect(multipleChoice.configuration).toMatchObject({ itemType: 'MC' })
    expect(kprim.configuration).toMatchObject({ itemType: 'KPRIM' })
    expect(multipleChoice.configurationHash).not.toBe(
      singleChoice.configurationHash
    )
    expect(kprim.configurationHash).not.toBe(singleChoice.configurationHash)
  })

  it('creates localized neutral objectives for global Bloom intent', () => {
    const german = normalizeQuestionGenerationConfiguration(
      configurationInput({ bloomLevels: ['understand', 'apply'] }),
      graphVersion
    )
    const english = normalizeQuestionGenerationConfiguration(
      configurationInput({ language: 'en', bloomLevels: ['analyze'] }),
      { ...graphVersion, language: 'en' }
    )

    expect(german.configuration.objectives).toEqual([
      {
        id: 'OBJ-01',
        text: 'Prüfe das ausgewählte Wissensbasismaterial auf der kognitiven Stufe Verstehen.',
        bloomLevel: 'understand',
      },
      {
        id: 'OBJ-02',
        text: 'Prüfe das ausgewählte Wissensbasismaterial auf der kognitiven Stufe Anwenden.',
        bloomLevel: 'apply',
      },
    ])
    expect(english.configuration.objectives).toEqual([
      {
        id: 'OBJ-01',
        text: 'Assess the selected knowledge-base material at the analyze cognitive level.',
        bloomLevel: 'analyze',
      },
    ])
  })

  it.each([
    configurationInput({ questionCount: 0 }),
    configurationInput({ questionCount: 21 }),
    configurationInput({ language: 'fr' }),
    configurationInput({ language: 'en' }),
    configurationInput({ bloomLevels: ['create'] }),
    configurationInput({
      sourceScopes: [
        {
          resourceId: sourceSnapshot[0]!.resourceId,
          pageFrom: 0,
          pageTo: 1,
        },
      ],
    }),
    configurationInput({
      sourceScopes: [
        {
          resourceId: sourceSnapshot[0]!.resourceId,
          pageFrom: 2,
          pageTo: 13,
        },
      ],
    }),
    configurationInput({
      sourceScopes: [
        {
          resourceId: '5e21a46a-94b4-44e9-8966-b36dc1908790',
          pageFrom: null,
          pageTo: null,
        },
      ],
    }),
  ])('rejects unsupported or out-of-bounds input %#', (input) => {
    expect(() =>
      normalizeQuestionGenerationConfiguration(input, graphVersion)
    ).toThrowError(expect.objectContaining({ code: 'CONFIGURATION_INVALID' }))
  })
})
