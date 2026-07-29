import {
  ElementData,
  ElementInstance,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import CodeQuestion from '@klicker-uzh/shared-components/src/CodeQuestion'
import useSingleStudentResponse from '@klicker-uzh/shared-components/src/hooks/useSingleStudentResponse'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import StudentElement, {
  InstanceStackStudentResponseType,
  StackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import { Checkbox, FormLabel } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useMemo, useState } from 'react'
import { ElementFormTypes } from './types'

interface StudentElementPreviewWrapperProps {
  values: ElementData | ElementFormTypes
  instance: ElementInstance | undefined
  initialFeedbacksExplanation?: boolean
}

function StudentElementPreviewWrapper({
  values,
  instance,
  initialFeedbacksExplanation = false,
}: StudentElementPreviewWrapperProps): React.ReactElement {
  const t = useTranslations()
  const [showFeedbacksExplanation, setShowFeedbacksExplanation] = useState(
    initialFeedbacksExplanation
  )

  const explanationOrFeedbacksDefined =
    'explanation' in values &&
    values.type !== ElementType.Flashcard &&
    ((values.explanation &&
      !values.explanation.match(/^(<br>(\n)*)$/g) &&
      values.explanation !== '') ||
      ('options' in values &&
        'hasAnswerFeedbacks' in values.options &&
        values.options.hasAnswerFeedbacks))

  // initialize student response with default state (SC question = default form state) - is overwritten on instance change
  const [studentResponse, setStudentResponse] =
    useState<InstanceStackStudentResponseType>({
      type: ElementType.Sc,
      response: undefined,
      valid: false,
    })

  // hook running on every instance change to initialize the student response correctly
  useSingleStudentResponse({
    instance: instance,
    setStudentResponse,
  })
  const stackStorage = useMemo<StackStudentResponseType | undefined>(() => {
    if (
      !instance ||
      !explanationOrFeedbacksDefined ||
      !showFeedbacksExplanation
    ) {
      return undefined
    }

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
          [instance.id]: {
            evaluation: {
              __typename: 'ChoicesInstanceEvaluation',
              explanation,
              feedbacks:
                'options' in values &&
                'hasAnswerFeedbacks' in values.options &&
                values.options.hasAnswerFeedbacks
                  ? 'choices' in values.options
                    ? values.options.choices
                    : undefined
                  : undefined,
            },
          },
        } as StackStudentResponseType

      case ElementType.Numerical:
        return {
          [instance.id]: {
            evaluation: {
              __typename: 'NumericalInstanceEvaluation',
              explanation,
            },
          },
        } as StackStudentResponseType

      case ElementType.FreeText:
        return {
          [instance.id]: {
            evaluation: {
              __typename: 'FreeTextInstanceEvaluation',
              explanation,
            },
          },
        } as StackStudentResponseType

      case ElementType.Selection:
        return {
          [instance.id]: {
            evaluation: {
              __typename: 'SelectionInstanceEvaluation',
              explanation,
            },
          },
        } as StackStudentResponseType

      case ElementType.CaseStudy:
        return {
          [instance.id]: {
            evaluation: {
              __typename: 'CaseStudyInstanceEvaluation',
              explanation,
            },
          },
        } as StackStudentResponseType

      default:
        return undefined
    }
  }, [
    values,
    instance,
    explanationOrFeedbacksDefined,
    showFeedbacksExplanation,
  ])

  if (!instance) {
    return <Loader />
  }

  const codeData =
    instance.elementData.__typename === 'CodeElementData'
      ? instance.elementData
      : undefined
  const codeHasSampleSolution =
    'options' in values &&
    'hasSampleSolution' in values.options &&
    values.options.hasSampleSolution

  return (
    <div className="max-w-full" data-cy="student-element-preview">
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
        {codeData ? (
          <CodeQuestion
            content={codeData.content}
            options={codeData.options}
            response={
              studentResponse.type === ElementType.Code &&
              typeof studentResponse.response === 'string'
                ? (studentResponse.response ??
                  codeData.options.starterCode ??
                  '')
                : (codeData.options.starterCode ?? '')
            }
            setResponse={(response) =>
              setStudentResponse({
                type: ElementType.Code,
                response,
                valid: response.trim().length > 0,
              })
            }
            noPoints={codeData.basePoints === false && !codeHasSampleSolution}
          />
        ) : (
          <StudentElement
            preview
            element={instance}
            elementIx={0}
            singleStudentResponse={studentResponse}
            setSingleStudentResponse={setStudentResponse}
            stackStorage={stackStorage}
          />
        )}
      </div>
    </div>
  )
}

export default StudentElementPreviewWrapper
