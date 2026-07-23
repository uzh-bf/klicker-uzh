import {
  CodeLanguage,
  CodeTestVisibility,
  ElementData,
  ElementInstance,
  ElementInstanceType,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { nanoid } from 'nanoid'
import { useMemo } from 'react'
import { ElementFormTypes } from './types'

function parseJson(value: string, fallback: unknown) {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function useArtificialElementInstance({
  values,
  elementDataTypename,
  answerCollectionEntries,
}: {
  values?: ElementFormTypes | null
  elementDataTypename?: ElementData['__typename']
  answerCollectionEntries?: { id: number; value: string }[]
}): ElementInstance | undefined {
  const instance = useMemo(() => {
    // verify that the element data typename is set
    if (!elementDataTypename || !values) {
      return undefined
    }

    return {
      id: 0,
      type: ElementInstanceType.LiveQuiz,
      elementType: values.type,
      elementData: {
        id: '0',
        elementId: 0,
        __typename: elementDataTypename,
        content: values.content,
        explanation: 'explanation' in values ? values.explanation : undefined,
        name: values.name,
        basePoints: values.basePoints,
        pointsMultiplier: parseInt(values.pointsMultiplier ?? '1'),
        type: values.type,
        options:
          'options' in values
            ? {
                hasSampleSolution:
                  'hasSampleSolution' in values.options
                    ? values.options.hasSampleSolution
                    : undefined,
                language:
                  values.type === ElementType.Code
                    ? CodeLanguage.Python
                    : undefined,
                starterCode:
                  'starterCode' in values.options
                    ? values.options.starterCode || undefined
                    : undefined,
                entrypoint:
                  'entrypoint' in values.options
                    ? values.options.entrypoint
                    : undefined,
                executionLimits:
                  values.type === ElementType.Code
                    ? {
                        perTestTimeoutSeconds: 5,
                      }
                    : undefined,
                testCases:
                  'testCases' in values.options
                    ? values.options.testCases
                        .filter(
                          (testCase) =>
                            testCase.visibility === CodeTestVisibility.Public
                        )
                        .map((testCase) => ({
                          id: testCase.id,
                          name: testCase.name,
                          args: parseJson(testCase.args, []),
                          expectedOutput: parseJson(
                            testCase.expectedOutput,
                            null
                          ),
                        }))
                    : undefined,
                hasAnswerFeedbacks:
                  'hasAnswerFeedbacks' in values.options
                    ? values.options.hasAnswerFeedbacks
                    : undefined,
                displayMode:
                  'displayMode' in values.options
                    ? values.options.displayMode
                    : undefined,
                choices:
                  'choices' in values.options
                    ? values.options.choices
                    : undefined,
                accuracy:
                  'accuracy' in values.options &&
                  typeof values.options.accuracy !== 'undefined' &&
                  values.options.accuracy !== null
                    ? parseInt(String(values.options.accuracy))
                    : undefined,
                unit:
                  'unit' in values.options ? values.options.unit : undefined,
                restrictions: {
                  min:
                    'restrictions' in values.options &&
                    values.options.restrictions &&
                    'min' in values.options.restrictions &&
                    typeof values.options.restrictions.min !== 'undefined' &&
                    values.options.restrictions.min !== null
                      ? parseFloat(String(values.options.restrictions.min))
                      : undefined,
                  max:
                    'restrictions' in values.options &&
                    values.options.restrictions &&
                    'max' in values.options.restrictions &&
                    typeof values.options.restrictions.max !== 'undefined' &&
                    values.options.restrictions.max !== null
                      ? parseFloat(String(values.options.restrictions.max))
                      : undefined,
                  maxLength:
                    'restrictions' in values.options &&
                    values.options.restrictions &&
                    'maxLength' in values.options.restrictions &&
                    typeof values.options.restrictions.maxLength !==
                      'undefined' &&
                    values.options.restrictions.maxLength !== null
                      ? parseFloat(
                          String(values.options.restrictions.maxLength)
                        )
                      : undefined,
                },
                numberOfInputs:
                  'numberOfInputs' in values.options &&
                  values.options.numberOfInputs
                    ? values.options.numberOfInputs
                    : 1,
                answerCollection:
                  'itemSelectionMode' in values.options &&
                  values.options.itemSelectionMode === 'new'
                    ? { entries: values.options.manuallyCreatedItems }
                    : { entries: answerCollectionEntries },
                items:
                  (!('itemSelectionMode' in values.options) ||
                    values.options.itemSelectionMode === 'existing' ||
                    typeof values.options.itemSelectionMode === 'undefined') &&
                  typeof answerCollectionEntries !== 'undefined' &&
                  answerCollectionEntries.length > 0
                    ? answerCollectionEntries.flatMap((entry) => {
                        if (
                          'selectedItems' in values.options &&
                          values.options.selectedItems?.includes(entry.id)
                        ) {
                          return {
                            id: entry.id,
                            value: entry.value,
                          }
                        }

                        return []
                      })
                    : 'manuallyCreatedItems' in values.options
                      ? (values.options.manuallyCreatedItems ?? [])
                      : [],
                criteria:
                  'criteria' in values.options && values.options.criteria
                    ? values.options.criteria.map((criterion, criterionIx) => ({
                        ...criterion,
                        min: parseFloat(String(criterion.min)),
                        max: parseFloat(String(criterion.max)),
                        step: parseFloat(criterion.step),
                        order: criterionIx,
                      }))
                    : [],
                cases:
                  'cases' in values.options && values.options.cases
                    ? values.options.cases.map((caseItem) => ({
                        id: caseItem.id,
                        title: caseItem.title ?? '',
                        description: caseItem.description,
                      }))
                    : [{ id: nanoid(), title: '', description: '' }],
              }
            : undefined,
      },
    } as ElementInstance
  }, [values, answerCollectionEntries, elementDataTypename])

  return instance
}

export default useArtificialElementInstance
