import {
  ElementData,
  ElementInstance,
  ElementInstanceType,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import StudentElement, {
  StudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import { H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'
import { ElementFormTypes } from './types'

interface StudentElementPreviewProps {
  values: ElementFormTypes
  elementDataTypename: ElementData['__typename']
}

function StudentElementPreview({
  values,
  elementDataTypename,
}: StudentElementPreviewProps): React.ReactElement {
  const t = useTranslations()
  const [studentResponse, setStudentResponse] = useState<StudentResponseType>(
    {}
  )

  return (
    <div className="max-w-sm flex-1">
      <H3>{t('shared.generic.preview')}</H3>
      <div className="rounded border p-4">
        <StudentElement
          element={
            {
              id: 0,
              type: ElementInstanceType.LiveQuiz,
              elementType: values.type,
              elementData: {
                id: '0',
                elementId: 0,
                __typename: elementDataTypename,
                content: values.content,
                explanation:
                  'explanation' in values ? values.explanation : undefined,
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
                          values.options.accuracy
                            ? parseInt(String(values.options.accuracy))
                            : undefined,
                        unit:
                          'unit' in values.options
                            ? values.options.unit
                            : undefined,
                        restrictions: {
                          min:
                            'restrictions' in values.options &&
                            values.options.restrictions &&
                            'min' in values.options.restrictions &&
                            values.options.restrictions.min
                              ? parseFloat(
                                  String(values.options.restrictions.min)
                                )
                              : undefined,
                          max:
                            'restrictions' in values.options &&
                            values.options.restrictions &&
                            'max' in values.options.restrictions &&
                            values.options.restrictions.max
                              ? parseFloat(
                                  String(values.options.restrictions.max)
                                )
                              : undefined,
                          maxLength:
                            'restrictions' in values.options &&
                            values.options.restrictions &&
                            'maxLength' in values.options.restrictions &&
                            values.options.restrictions.maxLength
                              ? parseFloat(
                                  String(values.options.restrictions.maxLength)
                                )
                              : undefined,
                        },
                      }
                    : undefined,
              },
            } as ElementInstance
          }
          elementIx={0}
          studentResponse={studentResponse}
          setStudentResponse={setStudentResponse}
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
            {values.options.choices.map((choice, index) => (
              <div key={index} className="border-b pb-1 pt-1 last:border-b-0">
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
