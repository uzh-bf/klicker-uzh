import {
  ApolloCache,
  DefaultContext,
  FetchResult,
  MutationFunctionOptions,
} from '@apollo/client'
import {
  CodeLanguage,
  CreateAnswerCollectionMutation,
  ElementStatus,
  Exact,
  GetAnswerCollectionsInfoDocument,
  Scalars,
} from '@klicker-uzh/graphql/dist/ops'
import {
  ElementFormTypesCaseStudy,
  ElementFormTypesCaseStudySolutions,
  ElementFormTypesChoices,
  ElementFormTypesCode,
  ElementFormTypesContent,
  ElementFormTypesFlashcard,
  ElementFormTypesFreeText,
  ElementFormTypesNumerical,
  ElementFormTypesSelection,
} from './types'

interface PrepareContentArgsProps {
  elementId?: number
  isDuplication: boolean
  values: ElementFormTypesContent & { status: ElementStatus }
}
export function prepareContentArgs({
  elementId,
  isDuplication,
  values,
}: PrepareContentArgsProps) {
  return {
    id: isDuplication ? undefined : elementId,
    name: values.name,
    status: values.status,
    content: values.content,
    basePoints: values.basePoints,
    pointsMultiplier: parseInt(values.pointsMultiplier),
    tags: values.tags,
  }
}

interface PrepareFlashcardArgsProps {
  elementId?: number
  isDuplication: boolean
  values: ElementFormTypesFlashcard & { status: ElementStatus }
}
export function prepareFlashcardArgs({
  elementId,
  isDuplication,
  values,
}: PrepareFlashcardArgsProps) {
  return {
    id: isDuplication ? undefined : elementId,
    name: values.name,
    status: values.status,
    content: values.content,
    explanation: values.explanation,
    basePoints: values.basePoints,
    pointsMultiplier: parseInt(values.pointsMultiplier),
    tags: values.tags,
  }
}

interface PrepareChoicesArgsProps {
  elementId?: number
  isDuplication: boolean
  values: ElementFormTypesChoices & { status: ElementStatus }
}
export function prepareChoicesArgs({
  elementId,
  isDuplication,
  values,
}: PrepareChoicesArgsProps) {
  return {
    id: isDuplication ? undefined : elementId,
    name: values.name,
    type: values.type,
    status: values.status,
    content: values.content,
    explanation:
      !values.explanation?.match(/^(<br>(\n)*)$/g) && values.explanation !== ''
        ? values.explanation
        : null,
    basePoints: values.basePoints,
    pointsMultiplier: parseInt(values.pointsMultiplier),

    options: {
      hasSampleSolution: values.options.hasSampleSolution,
      hasAnswerFeedbacks: values.options.hasAnswerFeedbacks,
      displayMode: values.options.displayMode,
      choices: values.options.choices.map((choice, index) => {
        return {
          ix: index,
          value: choice.value!,
          correct: values.options.hasSampleSolution
            ? (choice.correct ?? false)
            : undefined,
          feedback: choice.feedback ?? undefined,
        }
      }),
    },

    tags: values.tags,
  }
}

interface PrepareNumericalArgsProps {
  elementId?: number
  isDuplication: boolean
  values: ElementFormTypesNumerical & { status: ElementStatus }
}
export function prepareNumericalArgs({
  elementId,
  isDuplication,
  values,
}: PrepareNumericalArgsProps) {
  return {
    id: isDuplication ? undefined : elementId,
    name: values.name,
    status: values.status,
    content: values.content,
    explanation:
      !values.explanation?.match(/^(<br>(\n)*)$/g) && values.explanation !== ''
        ? values.explanation
        : null,
    basePoints: values.basePoints,
    pointsMultiplier: parseInt(values.pointsMultiplier),

    options: {
      hasSampleSolution: values.options.hasSampleSolution,
      accuracy: values.options.accuracy
        ? parseInt(String(values.options.accuracy))
        : undefined,
      unit: values.options.unit,
      restrictions: {
        min:
          !values.options.restrictions ||
          values.options.restrictions.min === null ||
          typeof values.options.restrictions.min === 'undefined' ||
          values.options.restrictions.min === ''
            ? undefined
            : parseFloat(String(values.options.restrictions.min)),
        max:
          !values.options.restrictions ||
          values.options.restrictions.max === null ||
          typeof values.options.restrictions.max === 'undefined' ||
          values.options.restrictions.max === ''
            ? undefined
            : parseFloat(String(values.options.restrictions.max)),
      },
      solutionRanges:
        values.options.hasSampleSolution &&
        values.options.solutionType === 'range'
          ? values.options.solutionRanges?.map((range) => ({
              min: range.min === '' ? undefined : parseFloat(String(range.min)),
              max: range.max === '' ? undefined : parseFloat(String(range.max)),
            }))
          : undefined,
      exactSolutions:
        values.options.hasSampleSolution &&
        values.options.solutionType === 'exact'
          ? values.options.exactSolutions?.map((solution) => {
              if (typeof solution === 'number') {
                return solution
              }

              const precision = parseInt(String(values.options.accuracy))
              return parseFloat(parseFloat(solution).toFixed(precision))
            })
          : undefined,
    },

    tags: values.tags,
  }
}

interface PrepareFreeTextArgsProps {
  elementId?: number
  isDuplication: boolean
  values: ElementFormTypesFreeText & { status: ElementStatus }
}
export function prepareFreeTextArgs({
  elementId,
  isDuplication,
  values,
}: PrepareFreeTextArgsProps) {
  return {
    id: isDuplication ? undefined : elementId,
    name: values.name,
    status: values.status,
    content: values.content,
    explanation:
      !values.explanation?.match(/^(<br>(\n)*)$/g) && values.explanation !== ''
        ? values.explanation
        : null,
    basePoints: values.basePoints,
    pointsMultiplier: parseInt(values.pointsMultiplier),

    options: {
      hasSampleSolution: values.options.hasSampleSolution,
      //   placeholder: values.options.placeholder,
      restrictions: {
        maxLength:
          !values.options.restrictions?.maxLength ||
          !values.options.restrictions?.maxLength ||
          values.options.restrictions.maxLength === ''
            ? undefined
            : parseInt(String(values.options.restrictions.maxLength)),
      },
      solutions: values.options.solutions,
    },

    tags: values.tags,
  }
}

interface PrepareCodeArgsProps {
  elementId?: number
  isDuplication: boolean
  values: ElementFormTypesCode & { status: ElementStatus }
}
export function prepareCodeArgs({
  elementId,
  isDuplication,
  values,
}: PrepareCodeArgsProps) {
  return {
    id: isDuplication ? undefined : elementId,
    name: values.name,
    status: values.status,
    content: values.content,
    explanation:
      !values.explanation?.match(/^(<br>(\n)*)$/g) && values.explanation !== ''
        ? values.explanation
        : null,
    basePoints: values.basePoints,
    pointsMultiplier: parseInt(values.pointsMultiplier),
    options: {
      language: CodeLanguage.Python,
      starterCode: values.options.starterCode || undefined,
      sampleSolution: values.options.hasSampleSolution
        ? values.options.sampleSolution
        : undefined,
      entrypoint: values.options.entrypoint.trim(),
      hasSampleSolution: values.options.hasSampleSolution,
      testCases: values.options.testCases.map((testCase) => ({
        id: testCase.id.trim(),
        name: testCase.name.trim(),
        args: JSON.parse(testCase.args),
        expectedOutput: JSON.parse(testCase.expectedOutput),
        visibility: testCase.visibility,
        weight: Number(testCase.weight),
      })),
    },
    tags: values.tags,
  }
}

type CreateAnswerCollectionType = (
  options?:
    | MutationFunctionOptions<
        CreateAnswerCollectionMutation,
        Exact<{
          name: Scalars['String']['input']
          description: Scalars['String']['input']
          answers:
            | Array<Scalars['String']['input']>
            | Scalars['String']['input']
        }>,
        DefaultContext,
        ApolloCache<any>
      >
    | undefined
) => Promise<FetchResult<CreateAnswerCollectionMutation>>

interface CreateInlineSelectionCollectionProps {
  values: ElementFormTypesSelection
  createAnswerCollection: CreateAnswerCollectionType
}

export async function createInlineSelectionCollection({
  values,
  createAnswerCollection,
}: CreateInlineSelectionCollectionProps) {
  if (!values.options.manuallyCreatedItems) {
    return null
  }

  // create a deep copy of the element form values to ensure successful mutation
  const innerValues: ElementFormTypesSelection & {
    status: ElementStatus
  } = JSON.parse(JSON.stringify(values))

  const { data } = await createAnswerCollection({
    variables: {
      name: `AC: ${values.name}`,
      description: `Answer collection containing all the items used in the context of the selection question ${values.name}`,
      answers:
        values.options.manuallyCreatedItems.map((item) => item.value) ?? [],
    },
    update: (cache, { data }) => {
      if (!data?.createAnswerCollection) return

      const queryData = cache.readQuery({
        query: GetAnswerCollectionsInfoDocument,
      })
      const previousCollections = queryData?.getAnswerCollectionsInfo
      if (!previousCollections) return

      cache.writeQuery({
        query: GetAnswerCollectionsInfoDocument,
        data: {
          getAnswerCollectionsInfo: [
            ...previousCollections,
            data.createAnswerCollection,
          ],
        },
      })
    },
  })

  if (!data?.createAnswerCollection) {
    return null
  }

  // set the answer collection id to the newly created answer collection
  innerValues.options.answerCollection = String(data.createAnswerCollection.id)

  if (values.options.hasSampleSolution) {
    // create a map between the old item index and the new correct answer collection entry ids
    const entries = data.createAnswerCollection.entries ?? []
    const itemOldIdNewIdMap = new Map<number, number>()
    values.options.manuallyCreatedItems.forEach((createdItem) => {
      const entry = entries.find((entry) => entry.value === createdItem.value)
      if (entry) {
        itemOldIdNewIdMap.set(createdItem.id, entry.id)
      }
    })

    // update the ids of the correct answer options
    innerValues.options.correctAnswers =
      values.options.correctAnswers?.flatMap((oldId) => {
        const newItemId = itemOldIdNewIdMap.get(oldId)
        if (typeof newItemId === 'undefined') {
          return []
        }
        return [newItemId]
      }) ?? []
  }

  return innerValues
}

interface PrepareSelectionArgsProps {
  elementId?: number
  isDuplication: boolean
  values: ElementFormTypesSelection & { status: ElementStatus }
}
export function prepareSelectionArgs({
  elementId,
  isDuplication,
  values,
}: PrepareSelectionArgsProps) {
  return {
    id: isDuplication ? undefined : elementId,
    name: values.name,
    status: values.status,
    content: values.content,
    explanation:
      !values.explanation?.match(/^(<br>(\n)*)$/g) && values.explanation !== ''
        ? values.explanation
        : null,
    basePoints: values.basePoints,
    pointsMultiplier: parseInt(values.pointsMultiplier),

    options: {
      hasSampleSolution: values.options.hasSampleSolution,
      answerCollection: parseInt(values.options.answerCollection!),
      numberOfInputs: parseInt(values.options.numberOfInputs),
      correctAnswers: values.options.correctAnswers,
    },

    tags: values.tags,
  }
}

interface CreateInlineCaseStudyCollectionProps {
  values: ElementFormTypesCaseStudy
  createAnswerCollection: CreateAnswerCollectionType
}

export async function createInlineCaseStudyCollection({
  values,
  createAnswerCollection,
}: CreateInlineCaseStudyCollectionProps) {
  if (!values.options.manuallyCreatedItems) {
    return null
  }

  // create a deep copy of the element form values to ensure successful mutation
  const innerValues: ElementFormTypesCaseStudy & {
    status: ElementStatus
  } = JSON.parse(JSON.stringify(values))

  const { data } = await createAnswerCollection({
    variables: {
      name: `AC: ${values.name}`,
      description: `Answer collection containing all the items used in the context of the case study ${values.name}`,
      answers:
        values.options.manuallyCreatedItems.map((item) => item.value) ?? [],
    },
    update: (cache, { data }) => {
      if (!data?.createAnswerCollection) return

      const queryData = cache.readQuery({
        query: GetAnswerCollectionsInfoDocument,
      })
      const previousCollections = queryData?.getAnswerCollectionsInfo
      if (!previousCollections) return

      cache.writeQuery({
        query: GetAnswerCollectionsInfoDocument,
        data: {
          getAnswerCollectionsInfo: [
            ...previousCollections,
            data.createAnswerCollection,
          ],
        },
      })
    },
  })

  if (!data?.createAnswerCollection) {
    return null
  }

  // set the answer collection id to the newly created answer collection
  innerValues.options.answerCollection = String(data.createAnswerCollection.id)

  // set the items to the newly created answer collection items (in the same order as the values were defined)
  const entries = data.createAnswerCollection.entries ?? []
  const entryIds = values.options.manuallyCreatedItems.flatMap(
    (createdItem) => {
      const entry = entries.find((entry) => entry.value === createdItem.value)
      return entry ? entry.id : []
    }
  )
  innerValues.options.selectedItems = entryIds

  if (values.options.hasSampleSolution) {
    // create a map between the old item id and the new correct answer collection entry ids
    const itemOldIdNewIdMap = new Map<number, number>()
    values.options.manuallyCreatedItems.forEach((createdItem) => {
      const entry = entries.find((entry) => entry.value === createdItem.value)
      if (entry) {
        itemOldIdNewIdMap.set(createdItem.id, entry.id)
      }
    })

    // update the ids of the criterion solutions for all cases
    innerValues.options.cases = values.options.cases.map((c) => {
      const mappedSolutions: ElementFormTypesCaseStudySolutions =
        Object.fromEntries(
          Object.entries(c.solutions ?? {}).flatMap(([key, value]) => {
            const oldId = parseInt(key.split('-')[1])
            const newItemId = itemOldIdNewIdMap.get(oldId)

            if (typeof newItemId === 'undefined') {
              return []
            }

            return [[`itemId-${newItemId}`, value]]
          })
        )

      return { ...c, solutions: mappedSolutions }
    })
  }

  return innerValues
}

interface PrepareCaseStudyArgsProps {
  elementId?: number
  isDuplication: boolean
  values: ElementFormTypesCaseStudy & { status: ElementStatus }
}
export function prepareCaseStudyArgs({
  elementId,
  isDuplication,
  values,
}: PrepareCaseStudyArgsProps) {
  return {
    id: isDuplication ? undefined : elementId,
    name: values.name,
    status: values.status,
    content: values.content,
    explanation:
      !values.explanation?.match(/^(<br>(\n)*)$/g) && values.explanation !== ''
        ? values.explanation
        : null,
    basePoints: values.basePoints,
    pointsMultiplier: parseInt(values.pointsMultiplier),

    options: {
      hasSampleSolution: values.options.hasSampleSolution,
      answerCollection: parseInt(values.options.answerCollection!),
      collectionItemIds: values.options.selectedItems,
      criteria: values.options.criteria.map((criterion, index) => ({
        id: criterion.id,
        name: criterion.name,
        order: index,
        min: parseFloat(String(criterion.min)),
        max: parseFloat(String(criterion.max)),
        step: parseFloat(criterion.step),
        unit:
          criterion.unit && criterion.unit !== '' ? criterion.unit : undefined,
        labels: criterion.labels
          ? {
              min: criterion.labels.min,
              mid: criterion.labels.mid,
              max: criterion.labels.max,
            }
          : undefined,
      })),

      cases: values.options.cases.map((c, index) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        order: index,
        solutions: Object.entries(c.solutions ?? {}).map(([key, value]) => ({
          itemId: parseInt(key.split('-')[1]),
          criteriaSolutions: Object.entries(value).map(
            ([criterionId, criterionValue]) => ({
              criterionId,
              min: parseFloat(criterionValue.min),
              max: parseFloat(criterionValue.max),
            })
          ),
        })),
      })),
    },

    tags: values.tags,
  }
}
