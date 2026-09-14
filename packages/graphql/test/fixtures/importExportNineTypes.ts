import {
  gradeQuestionCaseStudy,
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
  gradeQuestionSelection,
} from '@klicker-uzh/grading'
import { ElementType } from '@klicker-uzh/prisma/client'
import {
  answerCollectionSchema,
  elementSchema,
  manifestSchema,
  type PackageAnswerCollection,
  type PackageElement,
} from '../../src/lib/importExportPackageContract.js'
import { createZip, parseZip } from '../../src/lib/zip.js'

const COLLECTION_REF = 'all-types-pool'

type ChoiceGradingOptions = {
  choices: Array<{ ix: number; correct?: boolean | null }>
}

type NumericalGradingOptions = {
  exactSolutions?: number[] | null
  solutionRanges?: Array<{ min?: number | null; max?: number | null }> | null
}

type FreeTextGradingOptions = {
  solutions?: string[] | null
}

type SelectionGradingOptions = {
  numberOfInputs: number
}

type CaseStudyGradingOptions = {
  cases: Array<{
    id: string
    solutions: Array<{
      itemRef: string
      criteriaSolutions: Array<{
        criterionId: string
        min: number
        max: number
      }>
    }>
  }>
}

function choice(ix: number, correct: boolean) {
  return { ix, value: `Choice ${ix + 1}`, correct }
}

function createAllTypesCollection(): PackageAnswerCollection {
  return answerCollectionSchema.parse({
    ref: COLLECTION_REF,
    name: 'All-types answer pool',
    description: 'Portable answers shared by selection and case study',
    entries: [
      { ref: 'pool-entry-alpha', value: 'Alpha' },
      { ref: 'pool-entry-beta', value: 'Beta' },
      { ref: 'pool-entry-gamma', value: 'Gamma' },
    ],
  })
}

function createAllTypesElements(
  collection: PackageAnswerCollection
): PackageElement[] {
  const common = {
    content: 'Portable didactic content',
    pointsMultiplier: 1,
    basePoints: true,
    explanation: null,
  }
  const parse = (value: Record<string, unknown>) => elementSchema.parse(value)

  return [
    parse({
      ...common,
      ref: 'sc',
      name: 'Single choice',
      type: ElementType.SC,
      options: {
        displayMode: 'LIST',
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
        choices: [
          { ...choice(0, true), feedback: 'Correct reasoning' },
          { ...choice(1, false), feedback: 'Why this is wrong' },
        ],
      },
    }),
    parse({
      ...common,
      ref: 'mc',
      name: 'Multiple choice',
      type: ElementType.MC,
      options: {
        displayMode: 'LIST',
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        choices: [choice(0, true), choice(1, true), choice(2, false)],
      },
    }),
    parse({
      ...common,
      ref: 'kprim',
      name: 'KPRIM',
      type: ElementType.KPRIM,
      options: {
        displayMode: 'LIST',
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        choices: [
          choice(0, true),
          choice(1, false),
          choice(2, true),
          choice(3, false),
        ],
      },
    }),
    parse({
      ...common,
      ref: 'free-text',
      name: 'Free text',
      type: ElementType.FREE_TEXT,
      options: {
        hasSampleSolution: true,
        restrictions: { maxLength: 240 },
        solutions: ['Accepted answer'],
      },
    }),
    parse({
      ...common,
      ref: 'numerical',
      name: 'Numerical',
      type: ElementType.NUMERICAL,
      options: {
        hasSampleSolution: true,
        restrictions: { min: -10, max: 10 },
        exactSolutions: [0],
        placeholder: 'Δx ≈ 0,00\u202fµm 🧪',
        unit: 'µm',
      },
    }),
    parse({
      ...common,
      ref: 'content',
      name: 'Content',
      type: ElementType.CONTENT,
      options: {},
    }),
    parse({
      ...common,
      ref: 'flashcard',
      name: 'Flashcard',
      type: ElementType.FLASHCARD,
      explanation: 'Portable flashcard answer',
      options: {},
    }),
    parse({
      ...common,
      ref: 'selection',
      name: 'Selection',
      type: ElementType.SELECTION,
      options: { hasSampleSolution: true, numberOfInputs: 1 },
      answerCollectionRef: collection.ref,
      answerCollectionItemRefs: [collection.entries[0]!.ref],
    }),
    parse({
      ...common,
      ref: 'case-study',
      name: 'Case study',
      type: ElementType.CASE_STUDY,
      options: {
        hasSampleSolution: true,
        criteria: [
          {
            id: 'quality',
            name: 'Quality',
            order: 0,
            min: 0,
            max: 5,
            step: 1,
          },
        ],
        cases: [
          {
            id: 'case-alpha',
            title: 'Case Alpha',
            description: 'Evaluate the answer quality',
            order: 0,
            solutions: [
              {
                itemRef: collection.entries[0]!.ref,
                criteriaSolutions: [{ criterionId: 'quality', min: 4, max: 5 }],
              },
              {
                itemRef: collection.entries[1]!.ref,
                criteriaSolutions: [{ criterionId: 'quality', min: 1, max: 2 }],
              },
            ],
          },
        ],
      },
      answerCollectionRef: collection.ref,
      answerCollectionItemRefs: collection.entries
        .slice(0, 2)
        .map((entry) => entry.ref),
    }),
  ]
}

export function createNineTypeImportPackage() {
  const collection = createAllTypesCollection()
  const elements = createAllTypesElements(collection)
  const manifest = manifestSchema.parse({
    type: 'klicker-element-package',
    version: 3,
    createdAt: '2026-07-13T00:00:00.000Z',
    elements: elements.map((element) => ({
      ref: element.ref,
      file: `elements/${element.ref}.json`,
      ...(element.answerCollectionRef
        ? { answerCollectionRef: element.answerCollectionRef }
        : {}),
    })),
    answerCollections: [
      {
        ref: collection.ref,
        file: `answer-collections/${collection.ref}.json`,
      },
    ],
    media: [],
  })

  return {
    buffer: createZip([
      { path: 'manifest.json', data: JSON.stringify(manifest) },
      {
        path: `answer-collections/${collection.ref}.json`,
        data: JSON.stringify(collection),
      },
      ...elements.map((element) => ({
        path: `elements/${element.ref}.json`,
        data: JSON.stringify(element),
      })),
    ]),
    elementRefs: elements.map((element) => element.ref),
  }
}

function readPackage(buffer: Buffer) {
  const files = new Map(
    parseZip(buffer).map((entry) => [entry.path, entry.data] as const)
  )
  const readJson = (path: string) => {
    const data = files.get(path)
    if (!data) throw new Error(`Package fixture is missing ${path}.`)
    return JSON.parse(data.toString('utf8')) as unknown
  }
  const manifest = manifestSchema.parse(readJson('manifest.json'))
  const collections = manifest.answerCollections.map((entry) =>
    answerCollectionSchema.parse(readJson(entry.file))
  )
  const elements = manifest.elements.map((entry) =>
    elementSchema.parse(readJson(entry.file))
  )
  return { manifest, collections, elements }
}

export function normalizedPackageJson(buffer: Buffer) {
  return parseZip(buffer)
    .filter((entry) => entry.path.endsWith('.json'))
    .map((entry) => {
      const value = JSON.parse(entry.data.toString('utf8')) as Record<
        string,
        unknown
      >
      if (entry.path === 'manifest.json') {
        value.createdAt = '<normalized>'
      }
      return { path: entry.path, value }
    })
    .sort((left, right) => left.path.localeCompare(right.path))
}

export function packageGradingScores(buffer: Buffer) {
  const { collections, elements } = readPackage(buffer)
  const entryNumberByRef = new Map(
    collections.flatMap((collection) =>
      collection.entries.map((entry, index) => [entry.ref, index + 1] as const)
    )
  )
  const scores: Partial<Record<ElementType, number | null>> = {}

  for (const element of elements) {
    switch (element.type) {
      case ElementType.SC:
      case ElementType.MC:
      case ElementType.KPRIM: {
        const options = element.options as ChoiceGradingOptions
        const response = options.choices.map((item) => ({
          ix: item.ix,
          selected: item.correct === true,
        }))
        const solution = options.choices
          .filter((item) => item.correct === true)
          .map((item) => item.ix)
        const args = {
          responseCount: options.choices.length,
          response,
          solution,
        }
        scores[element.type] =
          element.type === ElementType.SC
            ? gradeQuestionSC(args)
            : element.type === ElementType.MC
              ? gradeQuestionMC(args)
              : gradeQuestionKPRIM(args)
        break
      }
      case ElementType.NUMERICAL: {
        const options = element.options as NumericalGradingOptions
        scores[element.type] = gradeQuestionNumerical({
          response: 0,
          exactSolutions: options.exactSolutions,
          solutionRanges: options.solutionRanges,
        })
        break
      }
      case ElementType.FREE_TEXT: {
        const options = element.options as FreeTextGradingOptions
        scores[element.type] = gradeQuestionFreeText({
          response: options.solutions?.[0] ?? '',
          solutions: options.solutions,
        })
        break
      }
      case ElementType.SELECTION: {
        const options = element.options as SelectionGradingOptions
        const correctAnswers = (element.answerCollectionItemRefs ?? []).map(
          (ref) => entryNumberByRef.get(ref)!
        )
        scores[element.type] = gradeQuestionSelection({
          numberOfInputs: options.numberOfInputs,
          response: correctAnswers.slice(0, options.numberOfInputs),
          correctAnswers,
        })
        break
      }
      case ElementType.CASE_STUDY: {
        const options = element.options as CaseStudyGradingOptions
        const solutions = options.cases.map((caseItem) => ({
          caseId: caseItem.id,
          itemSolutions: caseItem.solutions.map((solution) => ({
            itemId: entryNumberByRef.get(solution.itemRef)!,
            criteriaSolutions: solution.criteriaSolutions,
          })),
        }))
        const response = solutions.map((caseItem) => ({
          caseId: caseItem.caseId,
          itemResponses: caseItem.itemSolutions.map((solution) => ({
            itemId: solution.itemId,
            criterionResponses: solution.criteriaSolutions.map((criterion) => ({
              criterionId: criterion.criterionId,
              response: (criterion.min + criterion.max) / 2,
            })),
          })),
        }))
        scores[element.type] = gradeQuestionCaseStudy({ response, solutions })
        break
      }
      case ElementType.CONTENT:
      case ElementType.FLASHCARD:
        break
    }
  }

  return scores
}
