import { ElementData, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import useSingleStudentResponse from '@klicker-uzh/shared-components/src/hooks/useSingleStudentResponse'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import StudentElement, {
  InstanceStackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import { H3 } from '@uzh-bf/design-system'
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
    <div className="max-w-sm flex-1" data-cy="student-element-preview">
      <H3>{t('shared.generic.preview')}</H3>
      <div className="rounded border p-4">
        <StudentElement
          preview
          element={artificialInstance}
          elementIx={0}
          singleStudentResponse={studentResponse}
          setSingleStudentResponse={setStudentResponse}
        />
      </div>
      {'explanation' in values && values.explanation ? (
        <div className="mt-4">
          <H3>{t('shared.generic.explanation')}</H3>
          <Markdown
            className={{
              root: 'prose prose-p:!m-0 prose-img:!m-0 leading-6',
            }}
            content={values.explanation}
          />
        </div>
      ) : null}
      {(values.type === ElementType.Sc ||
        values.type === ElementType.Mc ||
        values.type === ElementType.Kprim) &&
        values.options.hasAnswerFeedbacks && (
          <div className="mt-4">
            <H3>{t('shared.generic.feedbacks')}</H3>
            {values.options.choices.map((choice) => (
              <div
                key={`choice-${choice.id}`}
                className="border-b pb-1 pt-1 last:border-b-0"
              >
                {choice.feedback ? (
                  <Markdown
                    className={{
                      root: 'prose prose-p:!m-0 prose-img:!m-0 leading-6',
                    }}
                    content={choice.feedback}
                  />
                ) : (
                  t('manage.questionForms.noFeedbackDefined')
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

export default StudentElementPreview
