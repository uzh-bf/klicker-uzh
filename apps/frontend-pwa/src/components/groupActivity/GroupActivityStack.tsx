import { useMutation } from '@apollo/client'
import {
  ElementStack,
  ElementType,
  GroupActivityDetailsDocument,
  SubmitGroupActivityDecisionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import StudentElement, {
  ElementChoicesType,
  StudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import useStudentResponse from '@klicker-uzh/shared-components/src/hooks/useStudentResponse'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import InstanceHeader from '../practiceQuiz/InstanceHeader'

interface GroupActivityStackProps {
  activityId: number
  stack: ElementStack
  decisions?: any // TODO: typing
  submittedAt?: string
}

function GroupActivityStack({
  activityId,
  stack,
  decisions, // TODO: load previous answers from instances and display them if existent
  submittedAt,
}: GroupActivityStackProps) {
  const t = useTranslations()
  const router = useRouter()

  const [submitGroupActivityDecisions, { loading: submitLoading }] =
    useMutation(SubmitGroupActivityDecisionsDocument, {
      refetchQueries: [
        {
          query: GroupActivityDetailsDocument,
          variables: {
            groupId: router.query.groupId,
            activityId: router.query.activityId,
          },
        },
      ],
    })

  const [studentResponse, setStudentResponse] = useState<StudentResponseType>(
    {}
  )

  // initialize student responses
  useStudentResponse({
    stack,
    currentStep: 0,
    setStudentResponse,
    defaultRead: true,
  })

  return (
    <>
      <div className="flex flex-col gap-3">
        {stack.elements &&
          stack.elements.length > 0 &&
          stack.elements.map((element, elementIx) => {
            return (
              <div key={`${element.id}-student`}>
                <InstanceHeader
                  instanceId={element.id}
                  name={element.elementData.name}
                  withParticipant
                />
                <StudentElement
                  element={element}
                  elementIx={elementIx}
                  studentResponse={studentResponse}
                  setStudentResponse={setStudentResponse}
                  hideReadButton
                />
              </div>
            )
          })}
      </div>
      {!decisions ? (
        <Button
          className={{
            root: 'mt-4 text-lg font-bold float-right',
          }}
          disabled={Object.values(studentResponse).some(
            (response) => !response.valid
          )}
          onClick={async () => {
            const result = await submitGroupActivityDecisions({
              variables: {
                activityId: activityId,
                responses: Object.entries(studentResponse).map(
                  ([instanceId, value]) => {
                    if (
                      value.type === ElementType.Sc ||
                      value.type === ElementType.Mc ||
                      value.type === ElementType.Kprim
                    ) {
                      // convert the solution objects into integer lists
                      const responseList = Object.entries(
                        value.response as Record<number, boolean>
                      )
                        .filter(([, value]) => value)
                        .map(([key]) => parseInt(key))

                      return {
                        instanceId: parseInt(instanceId),
                        type: value.type as ElementChoicesType,
                        choicesResponse: responseList,
                      }
                    } else if (value.type === ElementType.Numerical) {
                      return {
                        instanceId: parseInt(instanceId),
                        type: ElementType.Numerical,
                        numericalResponse: parseFloat(value.response as string),
                      }
                    } else if (value.type === ElementType.FreeText) {
                      return {
                        instanceId: parseInt(instanceId),
                        type: ElementType.FreeText,
                        freeTextResponse: value.response as string,
                      }
                    } else if (value.type === ElementType.Content) {
                      return {
                        instanceId: parseInt(instanceId),
                        type: ElementType.Content,
                        contentReponse: value.response as boolean,
                      }
                    } else {
                      return {
                        instanceId: parseInt(instanceId),
                        type: value.type,
                        response: value.response,
                      }
                    }
                  }
                ),
              },
            })

            if (!result?.data?.submitGroupActivityDecisions) {
              console.error('Error submitting response')
              return
            }

            // set status and score according to returned correctness
            setStudentResponse({})
          }}
          type="submit"
          loading={submitLoading}
          data={{ cy: 'submit-group-activity' }}
        >
          {t('pwa.groupActivity.sendAnswers')}
        </Button>
      ) : (
        <div className="p-2 mt-4 text-sm text-center rounded text-slate-500 bg-slate-100">
          {t.rich('pwa.groupActivity.alreadySubmittedAt', {
            br: () => <br />,
            date: submittedAt,
          })}
        </div>
      )}
    </>
  )
}

export default GroupActivityStack
