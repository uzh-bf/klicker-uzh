import { useMutation } from '@apollo/client'
import useComponentVisibleCounter from '@components/hooks/useComponentVisibleCounter'
import {
  ElementStack as ElementStackType,
  ElementType,
  FlashcardCorrectnessType,
  RespondToElementStackDocument,
  StackFeedbackStatus,
} from '@klicker-uzh/graphql/dist/ops'
import StudentElement, {
  ElementChoicesType,
  StudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import useStudentResponse from '@klicker-uzh/shared-components/src/hooks/useStudentResponse'
import { useLocalStorage } from '@uidotdev/usehooks'
import { Button, H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
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
}: ElementStackProps) {
  const t = useTranslations()
  const timeSpent = useComponentVisibleCounter()

  const [respondToElementStack] = useMutation(RespondToElementStackDocument)

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

  return (
    <div className="pb-12">
      <div className="w-full">
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

        <div className="flex flex-col gap-3">
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
                    previousRating={
                      element.feedbacks?.[0]?.upvote
                        ? 1
                        : element.feedbacks?.[0]?.downvote
                        ? -1
                        : 0
                    }
                    previousFeedback={
                      element.feedbacks?.[0]?.feedback ?? undefined
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
          className={{ root: 'float-right text-lg mt-4' }}
          onClick={() => {
            setStudentResponse({})

            if (currentStep === totalSteps) {
              onAllStacksCompletion()
            } else {
              handleNextElement()
            }
          }}
          data={{ cy: 'practice-quiz-continue' }}
        >
          {currentStep === totalSteps
            ? t('shared.generic.finish')
            : t('shared.generic.continue')}
        </Button>
      )}

      {/* display mark all as read button, if only content elements have not been answered yet */}
      {typeof stackStorage === 'undefined' && showMarkAsRead && (
        <Button
          className={{ root: 'float-right text-lg mt-4' }}
          disabled={Object.values(studentResponse).some(
            (response) => !response.valid
          )}
          onClick={() => {
            // update the read status of all content elements in studentResponse to true
            setStudentResponse((currentResponses) =>
              Object.entries(currentResponses).reduce(
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
                {} as StudentResponseType
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
          className={{ root: 'float-right text-lg mt-4' }}
          disabled={Object.values(studentResponse).some(
            (response) => !response.valid
          )}
          onClick={async () => {
            const result = await respondToElementStack({
              variables: {
                stackId: stack.id,
                courseId: courseId,
                stackAnswerTime: timeSpent,
                responses: Object.entries(studentResponse).map(
                  ([instanceId, value]) => {
                    if (value.type === ElementType.Flashcard) {
                      return {
                        instanceId: parseInt(instanceId),
                        type: ElementType.Flashcard,
                        flashcardResponse:
                          value.response as FlashcardCorrectnessType,
                      }
                    } else if (value.type === ElementType.Content) {
                      return {
                        instanceId: parseInt(instanceId),
                        type: ElementType.Content,
                        contentReponse: value.response as boolean,
                      }
                    } else if (
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
                    }
                    // submission logic for numerical questions
                    else if (value.type === ElementType.Numerical) {
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

            setStackStorage(
              Object.entries(studentResponse).reduce((acc, [key, value]) => {
                return {
                  ...acc,
                  [key]: {
                    ...value,
                    evaluation:
                      result.data?.respondToElementStack?.evaluations?.find(
                        (evaluation) => evaluation.instanceId === parseInt(key)
                      ),
                  },
                }
              }, {} as StudentResponseType)
            )

            if (!result.data?.respondToElementStack) {
              console.error('Error submitting response')
              return
            }

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
          data={{ cy: 'practice-quiz-stack-submit' }}
        >
          {t('shared.generic.submit')}
        </Button>
      )}
    </div>
  )
}

export default ElementStack
