import type {
  KBGraphSourceSnapshot,
  QuestionGenerationConfiguration,
} from '@klicker-uzh/types'
import { createQuestionGenerationBlueprint } from '../src/services/questionGenerationBlueprint.js'

const sourceSnapshot: KBGraphSourceSnapshot = [
  {
    resourceId: '98a8fe52-c154-4450-8392-cf78d095695b',
    title: 'Wine Chemistry',
    sourceFile: 'materials/wine-chemistry.pdf',
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
    pageCount: 8,
  },
]

const configuration: QuestionGenerationConfiguration = {
  itemType: 'SC',
  language: 'de',
  questionCount: 6,
  difficultyPreset: 'MIXED',
  difficultyCounts: { d1: 1, d2: 1, d3: 2, d4: 1, d5: 1 },
  sourceScopes: [
    {
      resourceId: sourceSnapshot[0]!.resourceId,
      pageFrom: 2,
      pageTo: 6,
    },
    {
      resourceId: sourceSnapshot[1]!.resourceId,
      pageFrom: null,
      pageTo: null,
    },
  ],
  objectives: [
    {
      id: 'OBJ-01',
      text: 'Explain malolactic fermentation.',
      bloomLevel: 'understand',
    },
  ],
  bloomLevels: ['understand'],
}

function parseBlueprint(bytes: Buffer): unknown {
  return JSON.parse(bytes.toString('utf8'))
}

describe('question generation blueprint', () => {
  it('emits canonical JSON v2 input for a bounded module scope', async () => {
    const bytes = await createQuestionGenerationBlueprint(
      configuration,
      sourceSnapshot
    )
    const payload = parseBlueprint(bytes)

    expect(payload).toEqual({
      assessment_profile: 'klicker_live',
      item_format: 'sc',
      objective_form: 1,
      modules: [
        {
          module_id: 'M1',
          module_name: 'All material',
          scope_type: 'module',
          questions_d1: 1,
          questions_d2: 1,
          questions_d3: 2,
          questions_d4: 1,
          questions_d5: 1,
        },
      ],
      objectives: [
        {
          module_id: 'M1',
          objective_id: 'OBJ-01',
          objective_text: 'Explain malolactic fermentation.',
          bloom_level: 'understand',
        },
      ],
      sources: [
        {
          module_id: 'M1',
          source_file: 'wine-chemistry.pdf',
          page_from: 2,
          page_to: 6,
        },
        {
          module_id: 'M1',
          source_file: 'fermentation-notes.pdf',
          page_from: 1,
          page_to: 8,
        },
      ],
      pool_allocation: [],
    })
    expect(bytes.toString('utf8')).toBe(`${JSON.stringify(payload, null, 2)}\n`)
  })

  it('keeps an unrestricted single-source graph in ordinary module scope', async () => {
    const source = sourceSnapshot[0]!
    const bytes = await createQuestionGenerationBlueprint(
      {
        ...configuration,
        sourceScopes: [
          {
            resourceId: source.resourceId,
            pageFrom: null,
            pageTo: null,
          },
        ],
      },
      [source]
    )

    expect(parseBlueprint(bytes)).toMatchObject({
      modules: [{ scope_type: 'module' }],
      sources: [],
    })
  })

  it('uses an unfiltered ordinary module scope for the complete graph', async () => {
    const bytes = await createQuestionGenerationBlueprint(
      {
        ...configuration,
        sourceScopes: sourceSnapshot.map((source) => ({
          resourceId: source.resourceId,
          pageFrom: null,
          pageTo: null,
        })),
      },
      sourceSnapshot
    )

    expect(parseBlueprint(bytes)).toMatchObject({
      modules: [{ scope_type: 'module' }],
      sources: [],
      pool_allocation: [],
    })
  })

  it('returns identical bytes for identical input', async () => {
    const first = await createQuestionGenerationBlueprint(
      configuration,
      sourceSnapshot
    )
    const second = await createQuestionGenerationBlueprint(
      configuration,
      sourceSnapshot
    )

    expect(first.equals(second)).toBe(true)
  })

  it('requests KPRIM from the worker for a KPRIM build', async () => {
    const bytes = await createQuestionGenerationBlueprint(
      {
        ...configuration,
        itemType: 'KPRIM',
      } as QuestionGenerationConfiguration,
      sourceSnapshot
    )

    expect(parseBlueprint(bytes)).toMatchObject({ item_format: 'kprim' })
  })

  it('requests MC from the worker for a multiple-choice build', async () => {
    const bytes = await createQuestionGenerationBlueprint(
      {
        ...configuration,
        itemType: 'MC',
      },
      sourceSnapshot
    )

    expect(parseBlueprint(bytes)).toMatchObject({ item_format: 'mc' })
  })

  it('fails closed for unknown or unbounded selected sources', async () => {
    await expect(
      createQuestionGenerationBlueprint(
        {
          ...configuration,
          sourceScopes: [
            { resourceId: 'unknown-resource', pageFrom: 1, pageTo: 1 },
          ],
        },
        sourceSnapshot
      )
    ).rejects.toThrow('absent from the graph snapshot')

    await expect(
      createQuestionGenerationBlueprint(configuration, [
        sourceSnapshot[0]!,
        { ...sourceSnapshot[1]!, pageCount: null },
      ])
    ).rejects.toThrow('page count')
  })
})
