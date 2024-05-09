import { useMutation } from '@apollo/client'
import {
  ElementStack,
  ElementType,
  GroupActivityDecision,
  GroupActivityDetailsDocument,
  GroupActivityResults,
  ResponseCorrectnessType,
  SubmitGroupActivityDecisionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import StudentElement, {
  ElementChoicesType,
  StudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import useStudentResponse from '@klicker-uzh/shared-components/src/hooks/useStudentResponse'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import InstanceHeader from '../practiceQuiz/InstanceHeader'

interface GroupActivityStackProps {
  activityId: number
  stack: ElementStack
  decisions?: GroupActivityDecision[]
  results: GroupActivityResults
  submittedAt?: string
}

function GroupActivityStack({
  activityId,
  stack,
  decisions,
  results,
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

  useStudentResponse({
    stack,
    currentStep: 0,
    setStudentResponse,
    defaultRead: true,
  })

  useEffect(() => {
    const loadedResponses = decisions?.reduce((acc, decision) => {
      if (!decision) return acc

      if (
        decision.type === ElementType.Sc ||
        decision.type === ElementType.Mc
      ) {
        return {
          ...acc,
          [decision.instanceId]: {
            type: decision.type,
            response: decision.choicesResponse?.reduce(
              (acc, choice) => ({ ...acc, [choice]: true }),
              {} as Record<number, boolean>
            ),
            valid: true,
          },
        }
      } else if (decision.type === ElementType.Kprim) {
        const responseObj = Array.from({ length: 4 }, (_, i) => i).reduce(
          (acc, choice) => ({ ...acc, [choice]: false }),
          {} as Record<number, boolean>
        )

        return {
          ...acc,
          [decision.instanceId]: {
            type: decision.type,
            response: decision.choicesResponse?.reduce(
              (acc, choice) => ({ ...acc, [choice]: true }),
              responseObj as Record<number, boolean>
            ),
            valid: true,
          },
        }
      } else if (decision.type === ElementType.Numerical) {
        return {
          ...acc,
          [decision.instanceId]: {
            type: decision.type,
            response: decision.numericalResponse
              ? String(decision.numericalResponse)
              : undefined,
            valid: true,
          },
        }
      } else if (decision.type === ElementType.FreeText) {
        return {
          ...acc,
          [decision.instanceId]: {
            type: decision.type,
            response: decision.freeTextResponse ?? undefined,
            valid: true,
          },
        }
      } else if (decision.type === ElementType.Content) {
        return {
          ...acc,
          [decision.instanceId]: {
            type: decision.type,
            response: decision.contentResponse ?? undefined,
            valid: true,
          },
        }
      } else {
        return acc
      }
    }, {} as StudentResponseType)

    setStudentResponse((prev) => loadedResponses || prev)
  }, [decisions])

  return (
    <>
      <div className="flex flex-col gap-3">
        {stack.elements &&
          stack.elements.length > 0 &&
          stack.elements.map((element, elementIx) => {
            const grading = results?.grading.find(
              (grading) => grading.instanceId === element.id
            )
            const correctness = grading
              ? grading.score < grading.maxPoints
                ? grading.score > 0
                  ? ResponseCorrectnessType.Partial
                  : ResponseCorrectnessType.Incorrect
                : ResponseCorrectnessType.Correct
              : undefined

            return (
              <div key={`${element.id}-student`} className="mb-2 text-lg">
                <InstanceHeader
                  instanceId={element.id}
                  name={element.elementData.name}
                  className="mb-0"
                  correctness={correctness}
                  withParticipant
                />
                <StudentElement
                  element={element}
                  elementIx={elementIx}
                  studentResponse={studentResponse}
                  setStudentResponse={setStudentResponse}
                  hideReadButton
                  disabledInput={!!decisions}
                />
                {grading && correctness && (
                  <div
                    className={twMerge(
                      'rounded mb-6 mt-3 shadow !border-l-4 text-base',
                      correctness === ResponseCorrectnessType.Correct &&
                        '!border-l-green-500',
                      correctness === ResponseCorrectnessType.Partial &&
                        '!border-l-yellow-500',
                      correctness === ResponseCorrectnessType.Incorrect &&
                        '!border-l-red-700'
                    )}
                  >
                    <div
                      className={twMerge(
                        'flex flex-row justify-between px-2 py-1',
                        correctness === ResponseCorrectnessType.Correct &&
                          'bg-green-100',
                        correctness === ResponseCorrectnessType.Partial &&
                          'bg-yellow-100',
                        correctness === ResponseCorrectnessType.Incorrect &&
                          'bg-red-200'
                      )}
                    >
                      <div>{t(`pwa.groupActivity.answer${correctness}`)}</div>
                      <div className="font-bold self-end">{`${grading.score}/${
                        grading.maxPoints
                      } ${t('shared.generic.points')}`}</div>
                    </div>
                    {grading.feedback && (
                      <DynamicMarkdown
                        className={{ root: 'mt-1 p-2 !pt-0' }}
                        content={grading.feedback}
                      />
                    )}
                  </div>
                )}
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
