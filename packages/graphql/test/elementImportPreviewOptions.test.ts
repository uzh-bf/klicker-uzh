import { ElementType } from '@klicker-uzh/prisma/client'
import { DisplayMode } from '@klicker-uzh/types'
import {
  graphql,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  isUnionType,
} from 'graphql/index.js'
import { schema } from '../src/index.js'
import { createElementImportPackagePreviewOptions } from '../src/schema/elementImportPreviewOptions.js'

const optionsUnion = schema.getType('ElementImportPackagePreviewOptions')
if (!optionsUnion || !isUnionType(optionsUnion)) {
  throw new Error('Element import preview options union is not registered.')
}

const optionsSchema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'ElementImportPackagePreviewOptionsTestQuery',
    fields: {
      options: {
        type: new GraphQLNonNull(optionsUnion),
        resolve: (value) => value,
      },
    },
  }),
})

const optionsQuery = `
  query PreviewOptions {
    options {
      __typename
      ... on ElementImportPackagePreviewSCOptions {
        type displayMode hasSampleSolution hasAnswerFeedbacks
        choices { ix value correct feedback }
      }
      ... on ElementImportPackagePreviewMCOptions {
        type displayMode hasSampleSolution hasAnswerFeedbacks
        choices { ix value correct feedback }
      }
      ... on ElementImportPackagePreviewKPRIMOptions {
        type displayMode hasSampleSolution hasAnswerFeedbacks
        choices { ix value correct feedback }
      }
      ... on ElementImportPackagePreviewNumericalOptions {
        type hasSampleSolution accuracy placeholder unit
        restrictions { min max }
        solutionRanges { min max }
        exactSolutions
      }
      ... on ElementImportPackagePreviewFreeTextOptions {
        type hasSampleSolution restrictions { maxLength } solutions
      }
      ... on ElementImportPackagePreviewContentOptions { type }
      ... on ElementImportPackagePreviewFlashcardOptions { type }
      ... on ElementImportPackagePreviewSelectionOptions {
        type hasSampleSolution numberOfInputs
      }
      ... on ElementImportPackagePreviewCaseStudyOptions {
        type hasSampleSolution
        criteria {
          id name order min max step unit labels { min mid max }
        }
        cases {
          id title description order
          solutions {
            itemId criteriaSolutions { criterionId min max }
          }
        }
      }
    }
  }
`

async function executeOptions(
  type: ElementType,
  options: Record<string, unknown>
) {
  return await graphql({
    schema: optionsSchema,
    source: optionsQuery,
    rootValue: createElementImportPackagePreviewOptions({ type, options }),
  })
}

describe('element import preview option contract', () => {
  it.each([
    [ElementType.CONTENT, 'ElementImportPackagePreviewContentOptions'],
    [ElementType.FLASHCARD, 'ElementImportPackagePreviewFlashcardOptions'],
  ])('resolves empty %s options to a concrete object', async (type, name) => {
    const result = await executeOptions(type, {})

    expect(result.errors).toBeUndefined()
    expect(result.data?.options).toEqual({ __typename: name, type })
  })

  it.each([
    [ElementType.SC, 'ElementImportPackagePreviewSCOptions', 2],
    [ElementType.MC, 'ElementImportPackagePreviewMCOptions', 3],
    [ElementType.KPRIM, 'ElementImportPackagePreviewKPRIMOptions', 4],
  ])(
    'preserves %s choice review fields and nullable correctness',
    async (type, name, choiceCount) => {
      const choices = Array.from({ length: choiceCount }, (_, ix) => ({
        ix,
        value: `Choice ${ix + 1}`,
      }))
      const result = await executeOptions(type, {
        displayMode: DisplayMode.LIST,
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        choices,
      })

      expect(result.errors).toBeUndefined()
      expect(result.data?.options).toEqual({
        __typename: name,
        type,
        displayMode: DisplayMode.LIST,
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        choices: choices.map((choice) => ({
          ...choice,
          correct: null,
          feedback: null,
        })),
      })
    }
  )

  it('preserves choice correctness and feedback when a scoring key exists', async () => {
    const result = await executeOptions(ElementType.SC, {
      displayMode: DisplayMode.GRID,
      hasSampleSolution: true,
      hasAnswerFeedbacks: true,
      choices: [
        {
          ix: 0,
          value: 'Correct choice',
          correct: true,
          feedback: 'Exactly.',
        },
        {
          ix: 1,
          value: 'Distractor',
          correct: false,
          feedback: 'Not this one.',
        },
      ],
    })

    expect(result.errors).toBeUndefined()
    expect(result.data?.options).toMatchObject({
      __typename: 'ElementImportPackagePreviewSCOptions',
      displayMode: DisplayMode.GRID,
      hasSampleSolution: true,
      hasAnswerFeedbacks: true,
      choices: [
        { correct: true, feedback: 'Exactly.' },
        { correct: false, feedback: 'Not this one.' },
      ],
    })
  })

  it('preserves numerical bounds, solutions, and a Unicode placeholder', async () => {
    const placeholder = 'Δx ≈ 3,14\u202fµm 🧪'
    const result = await executeOptions(ElementType.NUMERICAL, {
      hasSampleSolution: true,
      accuracy: 3,
      placeholder,
      unit: 'µm',
      restrictions: { min: -5, max: 10 },
      solutionRanges: [{ min: 3.139, max: 3.141 }],
      exactSolutions: null,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data?.options).toEqual({
      __typename: 'ElementImportPackagePreviewNumericalOptions',
      type: ElementType.NUMERICAL,
      hasSampleSolution: true,
      accuracy: 3,
      placeholder,
      unit: 'µm',
      restrictions: { min: -5, max: 10 },
      solutionRanges: [{ min: 3.139, max: 3.141 }],
      exactSolutions: null,
    })
  })

  it('preserves numerical exact solutions independently of ranges', async () => {
    const result = await executeOptions(ElementType.NUMERICAL, {
      hasSampleSolution: true,
      accuracy: null,
      placeholder: null,
      unit: null,
      restrictions: { min: null, max: null },
      solutionRanges: null,
      exactSolutions: [-1.5, 2.25],
    })

    expect(result.errors).toBeUndefined()
    expect(result.data?.options).toMatchObject({
      __typename: 'ElementImportPackagePreviewNumericalOptions',
      solutionRanges: null,
      exactSolutions: [-1.5, 2.25],
    })
  })

  it('preserves free-text scoring fields', async () => {
    const result = await executeOptions(ElementType.FREE_TEXT, {
      hasSampleSolution: true,
      restrictions: { maxLength: 240 },
      solutions: ['First answer', 'Second answer'],
    })

    expect(result.errors).toBeUndefined()
    expect(result.data?.options).toEqual({
      __typename: 'ElementImportPackagePreviewFreeTextOptions',
      type: ElementType.FREE_TEXT,
      hasSampleSolution: true,
      restrictions: { maxLength: 240 },
      solutions: ['First answer', 'Second answer'],
    })
  })

  it('preserves selection input and scoring-key settings', async () => {
    const result = await executeOptions(ElementType.SELECTION, {
      hasSampleSolution: false,
      numberOfInputs: 3,
    })

    expect(result.errors).toBeUndefined()
    expect(result.data?.options).toEqual({
      __typename: 'ElementImportPackagePreviewSelectionOptions',
      type: ElementType.SELECTION,
      hasSampleSolution: false,
      numberOfInputs: 3,
    })
  })

  it('preserves every nested case-study review field', async () => {
    const result = await executeOptions(ElementType.CASE_STUDY, {
      hasSampleSolution: true,
      criteria: [
        {
          id: 'quality',
          name: 'Quality',
          order: 0,
          min: 0,
          max: 5,
          step: 0.5,
          unit: 'pts',
          labels: { min: 'Low', mid: 'Medium', max: 'High' },
        },
      ],
      cases: [
        {
          id: 'case-a',
          title: 'Case A',
          description: 'Evaluate the candidate.',
          order: 0,
          solutions: [
            {
              itemId: 17,
              criteriaSolutions: [
                { criterionId: 'quality', min: 3.5, max: 4.5 },
              ],
            },
          ],
        },
      ],
    })

    expect(result.errors).toBeUndefined()
    expect(result.data?.options).toEqual({
      __typename: 'ElementImportPackagePreviewCaseStudyOptions',
      type: ElementType.CASE_STUDY,
      hasSampleSolution: true,
      criteria: [
        {
          id: 'quality',
          name: 'Quality',
          order: 0,
          min: 0,
          max: 5,
          step: 0.5,
          unit: 'pts',
          labels: { min: 'Low', mid: 'Medium', max: 'High' },
        },
      ],
      cases: [
        {
          id: 'case-a',
          title: 'Case A',
          description: 'Evaluate the candidate.',
          order: 0,
          solutions: [
            {
              itemId: 17,
              criteriaSolutions: [
                { criterionId: 'quality', min: 3.5, max: 4.5 },
              ],
            },
          ],
        },
      ],
    })
  })
})
