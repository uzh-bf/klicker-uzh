import { ElementData, ElementType } from '@klicker-uzh/graphql/dist/ops'
import useSingleStudentResponse from '@klicker-uzh/shared-components/src/hooks/useSingleStudentResponse'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import StudentElement, {
  InstanceStackStudentResponseType,
  StackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import { Checkbox, FormLabel } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'
import { ElementFormTypes } from './types'
import useArtificialElementInstance from './useArtificialElementInstance'

interface StudentElementPreviewProps {
  values: ElementFormTypes
  elementDataTypename?: ElementData['__typename']
  answerCollectionEntries?: { id: number; value: string }[]
}

function StudentElementPreview({
  values,
  elementDataTypename,
  answerCollectionEntries,
}: StudentElementPreviewProps): React.ReactElement {
  const t = useTranslations()
  const [showFeedbacksExplanation, setShowFeedbacksExplanation] =
    useState(false)

  const explanationOrFeedbacksDefined =
    'explanation' in values &&
    values.type !== ElementType.Flashcard &&
    ((values.explanation &&
      !values.explanation.match(/^(<br>(\n)*)$/g) &&
      values.explanation !== '') ||
      ('options' in values &&
        'hasAnswerFeedbacks' in values.options &&
        values.options.hasAnswerFeedbacks))

  // generate artificial instance from form content
  const artificialInstance = useArtificialElementInstance({
    values,
    elementDataTypename,
    answerCollectionEntries,
  })

  // initialize student response with default state (SC question = default form state) - is overwritten on instance change
  const [studentResponse, setStudentResponse] =
    useState<InstanceStackStudentResponseType>({
      type: ElementType.Sc,
      response: undefined,
      valid: false,
    })

  // hook running on every instance change to initialize the student response correctly
  useSingleStudentResponse({
    instance: artificialInstance,
    setStudentResponse,
  })

  if (!artificialInstance) {
    return <Loader />
  }

  return (
    <div className="max-w-sm" data-cy="student-element-preview">
      <div className="rounded border p-4">
        {explanationOrFeedbacksDefined && (
          <div className="mb-2 flex flex-row items-center gap-2">
            <Checkbox
              checked={showFeedbacksExplanation}
              onCheck={() =>
                setShowFeedbacksExplanation(!showFeedbacksExplanation)
              }
            />
            <FormLabel
              required={false}
              labelType="large"
              label={
                [ElementType.Sc, ElementType.Mc, ElementType.Kprim].includes(
                  values.type
                )
                  ? t('manage.questionPool.showFeedbacksExplanation')
                  : t('manage.questionPool.showExplanation')
              }
              tooltip={
                [ElementType.Sc, ElementType.Mc, ElementType.Kprim].includes(
                  values.type
                )
                  ? t.rich(
                      'manage.questionPool.showFeedbacksExplanationTooltip',
                      { b: (text) => <b>{text}</b> }
                    )
                  : t.rich('manage.questionPool.showExplanationTooltip', {
                      b: (text) => <b>{text}</b>,
                    })
              }
              className={{ label: 'font-normal' }}
            />
          </div>
        )}
        <StudentElement
          preview
          element={artificialInstance}
          elementIx={0}
          singleStudentResponse={studentResponse}
          setSingleStudentResponse={setStudentResponse}
          stackStorage={
            showFeedbacksExplanation && explanationOrFeedbacksDefined
              ? (() => {
                  const explanation =
                    values.explanation &&
                    !values.explanation.match(/^(<br>(\n)*)$/g) &&
                    values.explanation !== ''
                      ? values.explanation
                      : undefined

                  switch (values.type) {
                    case ElementType.Sc:
                    case ElementType.Mc:
                    case ElementType.Kprim:
                      return {
                        ['0']: {
                          evaluation: {
                            __typename: 'ChoicesInstanceEvaluation',
                            explanation,
                            feedbacks: values.options.hasAnswerFeedbacks
                              ? values.options.choices
                              : undefined,
                          },
                        },
                      } as unknown as StackStudentResponseType

                    case ElementType.Numerical:
                      return {
                        ['0']: {
                          evaluation: {
                            __typename: 'NumericalInstanceEvaluation',
                            explanation,
                          },
                        },
                      } as unknown as StackStudentResponseType

                    case ElementType.FreeText:
                      return {
                        ['0']: {
                          evaluation: {
                            __typename: 'FreeTextInstanceEvaluation',
                            explanation,
                          },
                        },
                      } as unknown as StackStudentResponseType

                    case ElementType.Selection:
                      return {
                        ['0']: {
                          evaluation: {
                            __typename: 'SelectionInstanceEvaluation',
                            explanation,
                          },
                        },
                      } as unknown as StackStudentResponseType

                    case ElementType.CaseStudy:
                      return {
                        ['0']: {
                          evaluation: {
                            __typename: 'CaseStudyInstanceEvaluation',
                            explanation,
                          },
                        },
                      } as unknown as StackStudentResponseType

                    default:
                      return undefined
                  }
                })()
              : undefined
          }
        />
      </div>
    </div>
  )
}

export default StudentElementPreview
