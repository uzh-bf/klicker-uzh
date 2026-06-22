import StudentElement, {
  CaseStudyStudentResponseType,
  StackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import useStudentResponse from '@klicker-uzh/shared-components/src/hooks/useStudentResponse'
import getEmptySelectionResponse from '@klicker-uzh/shared-components/src/utils/getEmptySelectionResponse'
import type {
  CaseStudyCaseResponse,
  ChoicesResponse,
  GroupActivityDecision,
  GroupActivityResults,
} from '@klicker-uzh/types'
import { Button, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { trpc, type RouterInputs } from '../../lib/trpc'
import useStackElementFeedbacks from '../hooks/useStackElementFeedbacks'
import InstanceHeader from '../practiceQuiz/InstanceHeader'

type GroupActivityResponseInput =
  RouterInputs['participant']['submitGroupActivityDecisions']['responses'][number]
type ElementStack = Parameters<typeof useStudentResponse>[0]['stack']
type ElementType = NonNullable<ElementStack['elements']>[number]['elementType']
type ResponseCorrectnessType = 'CORRECT' | 'INCORRECT' | 'PARTIAL'

const ElementType = {
  CaseStudy: 'CASE_STUDY' as ElementType,
  Content: 'CONTENT' as ElementType,
  Flashcard: 'FLASHCARD' as ElementType,
  FreeText: 'FREE_TEXT' as ElementType,
  Kprim: 'KPRIM' as ElementType,
  Mc: 'MC' as ElementType,
  Numerical: 'NUMERICAL' as ElementType,
  Sc: 'SC' as ElementType,
  Selection: 'SELECTION' as ElementType,
}

const ResponseCorrectnessType = {
  Correct: 'CORRECT' as ResponseCorrectnessType,
  Incorrect: 'INCORRECT' as ResponseCorrectnessType,
  Partial: 'PARTIAL' as ResponseCorrectnessType,
}

interface GroupActivityStackProps {
  activityId: number
  activityEnded: boolean
  stack: ElementStack
  decisions?: GroupActivityDecision[] | null
  onSubmitted: () => Promise<unknown>
  results?: GroupActivityResults | null
  submittedAt?: string
}

function GroupActivityStack({
  activityId,
  activityEnded,
  stack,
  decisions,
  onSubmitted,
  results,
  submittedAt,
}: GroupActivityStackProps) {
  const t = useTranslations()
  const submitGroupActivityDecisions =
    trpc.participant.submitGroupActivityDecisions.useMutation()
  const [submissionRefreshing, setSubmissionRefreshing] = useState(false)
  const elementFeedbacks = useStackElementFeedbacks({
    instanceIds: stack.elements?.map((element) => element.id) ?? [],
    withParticipant: true,
  })

  const [studentResponse, setStudentResponse] =
    useState<StackStudentResponseType>({})

  useStudentResponse({
    stack,
    currentStep: 0,
    setStudentResponse,
    defaultRead: true,
  })

  useEffect(() => {
    const loadedResponses = decisions?.reduce<StackStudentResponseType>(
      (acc, decision) => {
        if (!decision) return acc

        if (
          decision.type === ElementType.Sc ||
          decision.type === ElementType.Mc
        ) {
          acc[decision.instanceId] = {
            type: decision.type,
            response: decision.choicesResponse?.reduce<Record<number, boolean>>(
              (acc, choice) => ({ ...acc, [choice.ix]: true }),
              {}
            ),
            valid: true,
          } as StackStudentResponseType[number]
          return acc
        } else if (decision.type === ElementType.Kprim) {
          const responseObj = Array.from({ length: 4 }, (_, i) => i).reduce<
            Record<number, boolean>
          >((acc, choice) => ({ ...acc, [choice]: false }), {})

          acc[decision.instanceId] = {
            type: decision.type,
            response: decision.choicesResponse?.reduce<Record<number, boolean>>(
              (acc, choice) => ({ ...acc, [choice.ix]: true }),
              responseObj
            ),
            valid: true,
          } as StackStudentResponseType[number]
          return acc
        } else if (decision.type === ElementType.Numerical) {
          acc[decision.instanceId] = {
            type: decision.type,
            response: decision.numericalResponse
              ? String(decision.numericalResponse)
              : undefined,
            valid: true,
          } as StackStudentResponseType[number]
          return acc
        } else if (decision.type === ElementType.FreeText) {
          acc[decision.instanceId] = {
            type: decision.type,
            response: decision.freeTextResponse ?? undefined,
            valid: true,
          } as StackStudentResponseType[number]
          return acc
        } else if (decision.type === ElementType.Selection) {
          const instance = stack.elements?.find(
            (element) => element.id === decision.instanceId
          )
          const response = getEmptySelectionResponse({
            numberOfInputs:
              instance?.elementData.__typename === 'SelectionElementData'
                ? instance.elementData.options.numberOfInputs
                : 1,
          })
          decision.selectionResponse
            ? decision.selectionResponse.forEach((answerId, ix) => {
                response[ix] = answerId
              })
            : undefined

          acc[decision.instanceId] = {
            type: decision.type,
            response,
            valid: true,
          } as StackStudentResponseType[number]
          return acc
        } else if (decision.type === ElementType.CaseStudy) {
          const decisionsObject =
            decision.caseStudyResponse?.reduce<CaseStudyStudentResponseType>(
              (caseAcc, caseItem) => {
                caseAcc[caseItem.caseId] = caseItem.itemResponses.reduce<
                  CaseStudyStudentResponseType['']
                >((itemAcc, item) => {
                  itemAcc[String(item.itemId)] = item.criterionResponses.reduce<
                    CaseStudyStudentResponseType['']['']
                  >((criterionAcc, criterion) => {
                    criterionAcc[criterion.criterionId] = criterion.response
                    return criterionAcc
                  }, {})
                  return itemAcc
                }, {})
                return caseAcc
              },
              {}
            )

          acc[decision.instanceId] = {
            type: decision.type,
            response: decisionsObject ?? undefined,
            valid: true,
          } as StackStudentResponseType[number]
          return acc
        } else if (decision.type === ElementType.Content) {
          acc[decision.instanceId] = {
            type: decision.type,
            response: decision.contentResponse ?? undefined,
            valid: true,
          } as StackStudentResponseType[number]
          return acc
        }

        return acc
      },
      {}
    )

    setStudentResponse((prev) => loadedResponses || prev)
  }, [decisions, stack.elements])

  return (
    <>
      <div className="flex flex-col gap-12 md:gap-8">
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
                  index={elementIx}
                  instanceId={element.id}
                  elementId={parseInt(element.elementData.id)}
                  name={element.elementData.name}
                  className="mb-0"
                  correctness={correctness}
                  previousElementFeedback={elementFeedbacks[element.id]}
                  stackInstanceIds={
                    stack.elements?.map((element) => element.id) ?? []
                  }
                  showSeparator={element.elementType === ElementType.Flashcard}
                  withParticipant
                />
                <StudentElement
                  element={element}
                  elementIx={elementIx}
                  studentResponse={studentResponse}
                  setStudentResponse={setStudentResponse}
                  hideReadButton
                  disabledInput={!!decisions || activityEnded}
                />
                {grading && correctness && (
                  <div
                    className={twMerge(
                      'border-l-4! mb-6 mt-3 rounded text-base shadow',
                      correctness === ResponseCorrectnessType.Correct &&
                        'border-l-green-500!',
                      correctness === ResponseCorrectnessType.Partial &&
                        'border-l-yellow-500!',
                      correctness === ResponseCorrectnessType.Incorrect &&
                        'border-l-red-700!'
                    )}
                    data-cy={`group-activity-grading-feedback-${elementIx}`}
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
                      <div className="self-end font-bold">{`${grading.score}/${
                        grading.maxPoints
                      } ${t('shared.generic.points')}`}</div>
                    </div>
                    {grading.feedback && (
                      <DynamicMarkdown
                        className={{ root: 'pt-0! mt-1 p-2' }}
                        content={grading.feedback}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
      </div>
      {!decisions && !activityEnded ? (
        <Button
          primary
          disabled={
            Object.values(studentResponse).some(
              (response) => !response.valid
            ) ||
            activityEnded ||
            submitGroupActivityDecisions.isLoading ||
            submissionRefreshing
          }
          onClick={async () => {
            const responses = buildGroupActivityResponseInput(studentResponse)
            setSubmissionRefreshing(true)
            const submitDecisions = submitGroupActivityDecisions.mutateAsync
            try {
              const result = await submitDecisions({
                activityId,
                responses,
              }).catch((error) => {
                console.error(error)
                toast({
                  type: 'error',
                  message: t('shared.generic.systemError'),
                  options: { duration: 5000 },
                })
                return undefined
              })

              if (typeof result === 'undefined') {
                return
              }

              if (!result?.groupActivityInstanceId) {
                console.error('Error submitting response')
                toast({
                  type: 'error',
                  message: t('shared.generic.systemError'),
                  options: { duration: 5000 },
                })
                return
              }

              await onSubmitted().catch((error) => {
                console.error(error)
                toast({
                  type: 'error',
                  message: t('shared.generic.systemError'),
                  options: { duration: 5000 },
                })
              })

              // set status and score according to returned correctness
              setStudentResponse({})
            } finally {
              setSubmissionRefreshing(false)
            }
          }}
          type="submit"
          loading={
            submitGroupActivityDecisions.isLoading || submissionRefreshing
          }
          className={{
            root: 'float-right mt-4 text-lg font-bold',
          }}
          data={{ cy: 'submit-group-activity' }}
        >
          <Button.Label>{t('pwa.groupActivity.sendAnswers')}</Button.Label>
        </Button>
      ) : null}
      {!!decisions && submittedAt ? (
        <div className="mt-4 rounded bg-slate-100 p-2 text-center text-sm text-slate-500">
          {t.rich('pwa.groupActivity.alreadySubmittedAt', {
            br: () => <br />,
            date: submittedAt,
          })}
        </div>
      ) : null}
    </>
  )
}

export default GroupActivityStack

function buildGroupActivityResponseInput(
  studentResponse: StackStudentResponseType
): GroupActivityResponseInput[] {
  return Object.entries(studentResponse).map<GroupActivityResponseInput>(
    ([instanceId, value]) => {
      if (
        value.type === ElementType.Sc ||
        value.type === ElementType.Mc ||
        value.type === ElementType.Kprim
      ) {
        // convert the solution objects into integer lists
        const responseList: ChoicesResponse[] = Object.entries(
          value.response as Record<string, boolean | undefined>
        )
          .filter(([, value]) => value)
          .map(([key, value]) => ({
            ix: parseInt(key),
            selected: value ?? false,
          }))

        return {
          instanceId: parseInt(instanceId),
          type: toGroupActivityResponseElementType(value.type),
          choicesResponse: responseList,
        }
      } else if (value.type === ElementType.Numerical) {
        return {
          instanceId: parseInt(instanceId),
          type: toGroupActivityResponseElementType(ElementType.Numerical),
          numericalResponse: parseFloat(value.response as string),
        }
      } else if (value.type === ElementType.FreeText) {
        return {
          instanceId: parseInt(instanceId),
          type: toGroupActivityResponseElementType(ElementType.FreeText),
          freeTextResponse: value.response as string | undefined,
        }
      } else if (value.type === ElementType.Content) {
        return {
          instanceId: parseInt(instanceId),
          type: toGroupActivityResponseElementType(ElementType.Content),
          contentReponse: value.response as boolean | undefined,
        }
      } else if (value.type === ElementType.Selection) {
        return {
          instanceId: parseInt(instanceId),
          type: toGroupActivityResponseElementType(ElementType.Selection),
          selectionResponse: Object.values(
            value.response as Record<string, number | undefined>
          ).filter(
            (entry): entry is number =>
              entry !== -1 && typeof entry !== 'undefined' && entry !== null
          ),
        }
      } else if (value.type === ElementType.CaseStudy) {
        const caseStudyResponse: CaseStudyCaseResponse[] = Object.entries(
          value.response as CaseStudyStudentResponseType
        ).map(([caseId, caseResponse]) => {
          return {
            caseId,
            itemResponses: Object.entries(caseResponse).map(
              ([itemId, itemResponse]) => {
                return {
                  itemId: parseInt(itemId),
                  criterionResponses: Object.entries(itemResponse).flatMap(
                    ([criterionId, criterionResponse]) => {
                      if (typeof criterionResponse === 'undefined') {
                        return []
                      }

                      return {
                        criterionId: criterionId,
                        response: criterionResponse,
                      }
                    }
                  ),
                }
              }
            ),
          }
        })

        return {
          instanceId: parseInt(instanceId),
          type: toGroupActivityResponseElementType(value.type),
          caseStudyResponse,
        }
      } else {
        return {
          instanceId: parseInt(instanceId),
          type: toGroupActivityResponseElementType(value.type),
        }
      }
    }
  )
}

function toGroupActivityResponseElementType(
  type: ElementType
): GroupActivityResponseInput['type'] {
  return type as GroupActivityResponseInput['type']
}
