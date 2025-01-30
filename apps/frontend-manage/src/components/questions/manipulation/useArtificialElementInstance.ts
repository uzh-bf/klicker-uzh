import {
  ElementData,
  ElementInstance,
  ElementInstanceType,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'
import { ElementFormTypes } from './types'

function useArtificialElementInstance({
  values,
  elementDataTypename,
  answerCollectionEntries,
}: {
  values: ElementFormTypes
  elementDataTypename?: ElementData['__typename']
  answerCollectionEntries?: { id: number; value: string }[]
}): ElementInstance | undefined {
  const instance = useMemo(() => {
    // verify that the element data typename is set
    if (!elementDataTypename) {
      return undefined
    }

    // for selection and case study questions, verify that the answer collection are set
    if (
      (values.type === ElementType.Selection ||
        values.type === ElementType.CaseStudy) &&
      (!answerCollectionEntries || answerCollectionEntries.length === 0)
    ) {
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
        pointsMultiplier: parseInt(values.pointsMultiplier ?? '1'),
        type: values.type,
        options:
          'options' in values
            ? {
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
                  typeof answerCollectionEntries !== 'undefined' &&
                  answerCollectionEntries.length > 0
                    ? { entries: answerCollectionEntries }
                    : undefined,
                items:
                  typeof answerCollectionEntries !== 'undefined' &&
                  answerCollectionEntries.length > 0
                    ? answerCollectionEntries.flatMap((entry) => {
                        if (
                          'selectedItems' in values.options &&
                          values.options.selectedItems.includes(entry.id)
                        ) {
                          return {
                            id: entry.id,
                            value: entry.value,
                          }
                        }

                        return []
                      })
                    : [],
                criteria:
                  'criteria' in values.options && values.options.criteria
                    ? values.options.criteria.map((criterion, criterionIx) => ({
                        ...criterion,
                        min: parseFloat(criterion.min),
                        max: parseFloat(criterion.max),
                        step: parseFloat(criterion.step),
                        order: criterionIx,
                      }))
                    : [],
                cases:
                  'cases' in values.options && values.options.cases
                    ? values.options.cases.map((caseItem) => ({
                        id: caseItem.id,
                        title: caseItem.title,
                        description: caseItem.description,
                      }))
                    : [],
              }
            : undefined,
      },
    } as ElementInstance
  }, [values, answerCollectionEntries, elementDataTypename])

  return instance
}

export default useArtificialElementInstance
