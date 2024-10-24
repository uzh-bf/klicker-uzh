import { useMutation, useQuery } from '@apollo/client'
import {
  ElementStack as ElementStackType,
  ElementType,
  FlashcardCorrectness,
  FlashcardCorrectnessType,
  GetPreviousStackEvaluationDocument,
  RespondToElementStackDocument,
  StackFeedbackStatus,
} from '@klicker-uzh/graphql/dist/ops'
import StudentElement, {
  StudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import useStudentResponse from '@klicker-uzh/shared-components/src/hooks/useStudentResponse'
import { useLocalStorage } from '@uidotdev/usehooks'
import { Button, H2, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import useComponentVisibleCounter from '../hooks/useComponentVisibleCounter'
import useStackElementFeedbacks from '../hooks/useStackElementFeedbacks'
import Bookmark from './Bookmark'
import InstanceHeader from './InstanceHeader'

interface ElementStackProps {
  parentId: string
  courseId: string
  stack: ElementStackType
  currentStep: number
  totalSteps: number
  setStepStatus?: ({
    status,
    score,
  }: {
    status: StackFeedbackStatus
    score?: number | null
  }) => void
  handleNextElement: () => void
  onAllStacksCompletion: () => void
  withParticipant?: boolean
  bookmarks?: number[] | null
  hideBookmark?: boolean
  singleSubmission?: boolean
  activityExpired?: boolean
  activityExpiredMessage?: string
}

function ElementStack({
  parentId,
  courseId,
  stack,
  currentStep,
  totalSteps,
  setStepStatus,
  handleNextElement,
  onAllStacksCompletion,
  withParticipant = false,
  bookmarks,
  hideBookmark = false,
  singleSubmission = false,
  activityExpired = false,
  activityExpiredMessage,
}: ElementStackProps) {
  const t = useTranslations()
  const timeRef = useRef(0)
  useComponentVisibleCounter({ timeRef })

  const [respondToElementStack, { loading: submittingResponse }] = useMutation(
    RespondToElementStackDocument
  )
  const elementFeedbacks = useStackElementFeedbacks({
    instanceIds: stack.elements?.map((element) => element.id) ?? [],
    withParticipant: withParticipant,
  })

  const [stackStorage, setStackStorage] = useLocalStorage<StudentResponseType>(
    `qi-${parentId}-${stack.id}`,
    undefined
  )

  const [studentResponse, setStudentResponse] = useState<StudentResponseType>(
    {}
  )

  const showMarkAsRead = useMemo(() => {
    if (
      Object.entries(studentResponse).some(
        ([key, response]) =>
          response.type === ElementType.Content &&
          typeof response.response === 'undefined' &&
          !stackStorage?.[parseInt(key)]?.response
      )
    ) {
      return true
    } else {
      return false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentResponse])

  // initialize student responses
  useStudentResponse({
    stack,
    currentStep,
    setStudentResponse,
  })

  // if single submission is enabled, fetch the previous answer & evaluation and do not submit again
  const { data: evaluationData } = useQuery(
    GetPreviousStackEvaluationDocument,
    {
      skip: !singleSubmission || !!stackStorage,
      variables: {
        stackId: stack.id,
      },
    }
  )

  // if single submission is enabled, fetch the previous answer & evaluation from the database (if available)
  useEffect(() => {
    if (
      singleSubmission &&
      !stackStorage &&
      evaluationData?.getPreviousStackEvaluation &&
      evaluationData.getPreviousStackEvaluation.evaluations &&
      evaluationData.getPreviousStackEvaluation.evaluations.length > 0
    ) {
      const evaluations = evaluationData.getPreviousStackEvaluation.evaluations

      setStackStorage(
        evaluations.reduce<StudentResponseType>((acc, evaluation) => {
          const foundElement = stack.elements?.find(
            (element) => element.id === evaluation.instanceId
          )
          const commonAttributes = {
            valid: true,
            evaluation,
          }

          if (!foundElement || !evaluation.lastResponse) {
            // Handle the error, log a warning, or skip this evaluation
            console.warn(`Element with ID ${evaluation.instanceId} not found.`)
            return acc
          } else {
            const elementType = foundElement.elementType
            if (
              elementType === ElementType.Flashcard &&
              evaluation.__typename === 'FlashcardInstanceEvaluation'
            ) {
              return {
                ...acc,
                [evaluation.instanceId]: {
                  ...commonAttributes,
                  type: elementType,
                  response: evaluation.lastResponse.correctness,
                },
              }
            } else if (
              elementType === ElementType.Content &&
              evaluation.__typename === 'ContentInstanceEvaluation'
            ) {
              return {
                ...acc,
                [evaluation.instanceId]: {
                  ...commonAttributes,
                  type: elementType,
                  response: evaluation.lastResponse.viewed,
                },
              }
            } else if (
              (elementType === ElementType.Sc ||
                elementType === ElementType.Mc) &&
              evaluation.__typename === 'ChoicesInstanceEvaluation'
            ) {
              const storedChoices = evaluation.lastResponse.choices
              return {
                ...acc,
                [evaluation.instanceId]: {
                  ...commonAttributes,
                  type: elementType,
                  response: storedChoices.reduce<Record<number, boolean>>(
                    (acc, choice) => {
                      return {
                        ...acc,
                        [choice]: true,
                      }
                    },
                    {}
                  ),
                },
              }
            } else if (
              elementType === ElementType.Kprim &&
              evaluation.__typename === 'ChoicesInstanceEvaluation'
            ) {
              const storedChoices = evaluation.lastResponse.choices
              return {
                ...acc,
                [evaluation.instanceId]: {
                  ...commonAttributes,
                  type: elementType,
                  response: {
                    0: storedChoices.includes(0),
                    1: storedChoices.includes(1),
                    2: storedChoices.includes(2),
                    3: storedChoices.includes(3),
                  },
                },
              }
            } else if (
              (elementType === ElementType.Numerical ||
                elementType === ElementType.FreeText) &&
              (evaluation.__typename === 'FreeTextInstanceEvaluation' ||
                evaluation.__typename === 'NumericalInstanceEvaluation')
            ) {
              return {
                ...acc,
                [evaluation.instanceId]: {
                  ...commonAttributes,
                  type: elementType,
                  response: evaluation.lastResponse.value,
                },
              }
            }

            return acc
          }
        }, {})
      )

      // set status and score according to returned correctness
      setStudentResponse({})

      // ? if used for practice quizzes, optionally set the step status here
      // const score = evaluationData?.getPreviousStackEvaluation.score
      // const status = evaluationData?.getPreviousStackEvaluation.status
      // if (typeof setStepStatus !== 'undefined') {
      //   setStepStatus({
      //     status,
      //     score,
      //   })
      // }
    }
  }, [evaluationData, setStackStorage, singleSubmission, stack, stackStorage])

  return (
    <div className="pb-12">
      <div className="w-full">
        {activityExpired && activityExpiredMessage && (
          <UserNotification
            type="error"
            message={activityExpiredMessage}
            className={{ root: 'mb-2' }}
          />
        )}

        {!hideBookmark ? (
          <div className="flex flex-row items-center justify-between">
            <div>{stack.displayName && <H2>{stack.displayName}</H2>}</div>
            <Bookmark
              bookmarks={bookmarks}
              quizId={parentId === 'bookmarks' ? undefined : parentId}
              stackId={stack.id}
            />
          </div>
        ) : (
          <div>{stack.displayName && <H2>{stack.displayName}</H2>}</div>
        )}

        {stack.description && (
          <div className="mb-4">
            <DynamicMarkdown
              content={stack.description}
              data={{ cy: 'element-stack-description' }}
              withProse
            />
          </div>
        )}

        <div className="flex flex-col gap-8 md:gap-12">
          {stack.elements &&
            stack.elements.length > 0 &&
            stack.elements.map((element, elementIx) => {
              return (
                <div key={`${element.id}-student`}>
                  <InstanceHeader
                    index={elementIx}
                    instanceId={element.id}
                    elementId={parseInt(element.elementData.id)}
                    name={element.elementData.name}
                    withParticipant={withParticipant}
                    previousElementFeedback={
                      withParticipant ? elementFeedbacks[element.id] : undefined
                    }
                    stackInstanceIds={
                      stack.elements?.map((element) => element.id) ?? []
                    }
                    showSeparator={
                      element.elementType === ElementType.Flashcard
                    }
                  />
                  <StudentElement
                    element={element}
                    elementIx={elementIx}
                    studentResponse={studentResponse}
                    setStudentResponse={setStudentResponse}
                    stackStorage={stackStorage}
                  />
                </div>
              )
            })}
        </div>
      </div>

      {/* display continue button if question was already answered */}
      {typeof stackStorage !== 'undefined' && !showMarkAsRead && (
        <Button
          className={{ root: 'float-right mt-4 text-lg' }}
          onClick={() => {
            setStudentResponse({})

            if (currentStep === totalSteps) {
              onAllStacksCompletion()
            } else {
              handleNextElement()
            }
          }}
          data={{ cy: 'student-stack-continue' }}
        >
          {currentStep === totalSteps
            ? t('shared.generic.finish')
            : t('shared.generic.continue')}
        </Button>
      )}

      {/* display mark all as read button, if only content elements have not been answered yet */}
      {typeof stackStorage === 'undefined' && showMarkAsRead && (
        <Button
          className={{ root: 'float-right mt-4 text-lg' }}
          disabled={Object.values(studentResponse).some(
            (response) => !response.valid
          )}
          onClick={() => {
            // update the read status of all content elements in studentResponse to true
            setStudentResponse((currentResponses) =>
              Object.entries(currentResponses).reduce<StudentResponseType>(
                (acc, [instanceId, value]) => {
                  if (value.type === ElementType.Content) {
                    return {
                      ...acc,
                      [instanceId]: {
                        ...value,
                        response: true,
                      },
                    }
                  } else {
                    return { ...acc, [instanceId]: value }
                  }
                },
                {}
              )
            )
          }}
          data={{ cy: 'practice-quiz-mark-all-as-read' }}
        >
          {t('pwa.practiceQuiz.markAllAsRead')}
        </Button>
      )}

      {typeof stackStorage === 'undefined' && !showMarkAsRead && (
        <Button
          loading={submittingResponse}
          disabled={
            activityExpired ||
            Object.values(studentResponse).some((response) => !response.valid)
          }
          className={{ root: 'float-right mt-4 text-lg' }}
          onClick={async () => {
            const result = await respondToElementStack({
              variables: {
                stackId: stack.id,
                courseId: courseId,
                stackAnswerTime: timeRef.current,
                responses: Object.entries(studentResponse).map(
                  ([instanceId, value]) => {
                    if (value.type === ElementType.Flashcard) {
                      let responseValue: FlashcardCorrectnessType
                      if (value.response === FlashcardCorrectness.Correct) {
                        responseValue = FlashcardCorrectnessType.Correct
                      } else if (
                        value.response === FlashcardCorrectness.Partial
                      ) {
                        responseValue = FlashcardCorrectnessType.Partial
                      } else {
                        responseValue = FlashcardCorrectnessType.Incorrect
                      }

                      return {
                        instanceId: parseInt(instanceId),
                        type: ElementType.Flashcard,
                        flashcardResponse: responseValue,
                      }
                    } else if (value.type === ElementType.Content) {
                      return {
                        instanceId: parseInt(instanceId),
                        type: ElementType.Content,
                        contentReponse: value.response,
                      }
                    } else if (
                      value.type === ElementType.Sc ||
                      value.type === ElementType.Mc ||
                      value.type === ElementType.Kprim
                    ) {
                      // convert the solution objects into integer lists
                      const responseList = Object.entries(value.response!)
                        .filter(([, value]) => value)
                        .map(([key]) => parseInt(key))

                      return {
                        instanceId: parseInt(instanceId),
                        type: value.type,
                        choicesResponse: responseList,
                      }
                    }
                    // submission logic for numerical questions
                    else if (value.type === ElementType.Numerical) {
                      return {
                        instanceId: parseInt(instanceId),
                        type: ElementType.Numerical,
                        numericalResponse: parseFloat(value.response!),
                      }
                    } else if (value.type === ElementType.FreeText) {
                      return {
                        instanceId: parseInt(instanceId),
                        type: ElementType.FreeText,
                        freeTextResponse: value.response,
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

            if (!result.data || !result.data?.respondToElementStack) {
              console.error('Error submitting response')
              return
            }

            setStackStorage(
              Object.entries(studentResponse).reduce<StudentResponseType>(
                (acc, [key, value]) => {
                  return {
                    ...acc,
                    [key]: {
                      ...value,
                      evaluation:
                        result.data!.respondToElementStack!.evaluations?.find(
                          (evaluation) =>
                            evaluation.instanceId === parseInt(key)
                        ),
                    },
                  }
                },
                {}
              )
            )

            // set status and score according to returned correctness
            const grading = result.data?.respondToElementStack
            setStudentResponse({})

            if (typeof setStepStatus !== 'undefined') {
              setStepStatus({
                status: grading.status,
                score: grading.score,
              })
            }

            // continue if stack only included content elements and/or flashcards, otherwise show evaluation
            if (
              Object.values(studentResponse).every(
                (response) =>
                  response.type === ElementType.Content ||
                  response.type === ElementType.Flashcard
              )
            ) {
              if (currentStep === totalSteps) {
                onAllStacksCompletion()
              } else {
                handleNextElement()
              }
            }
          }}
          data={{ cy: 'student-stack-submit' }}
        >
          {t('shared.generic.submit')}
        </Button>
      )}
    </div>
  )
}

export default ElementStack
