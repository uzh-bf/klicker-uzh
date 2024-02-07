import { useMutation } from '@apollo/client'
import {
  ChoicesElementData,
  ElementStack as ElementStackType,
  ElementType,
  FlashcardCorrectnessType,
  RespondToPracticeQuizStackDocument,
  StackFeedbackStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { useLocalStorage } from '@uidotdev/usehooks'
import { Button, H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import DynamicMarkdown from 'src/components/learningElements/DynamicMarkdown'
import Bookmark from './Bookmark'
import InstanceHeader from './InstanceHeader'
import StudentElement, {
  ElementChoicesType,
  StudentResponseType,
} from './StudentElement'

interface ElementStackProps {
  parentId: string
  courseId: string
  stack: ElementStackType
  currentStep: number
  totalSteps: number
  setStepStatus: ({
    status,
    score,
  }: {
    status: StackFeedbackStatus
    score?: number | null
  }) => void
  handleNextElement: () => void
  withParticipant?: boolean
}

function ElementStack({
  parentId,
  courseId,
  stack,
  currentStep,
  totalSteps,
  setStepStatus,
  handleNextElement,
  withParticipant = false,
}: ElementStackProps) {
  const t = useTranslations()
  const router = useRouter()

  const [respondToPracticeQuizStack] = useMutation(
    RespondToPracticeQuizStackDocument
  )

  const [stackStorage, setStackStorage] = useLocalStorage<StudentResponseType>(
    `qi-${parentId}-${stack.id}`,
    undefined
  )

  const [studentResponse, setStudentResponse] = useState<StudentResponseType>(
    {}
  )

  const showMarkAsRead = useMemo(() => {
    if (
      Object.values(studentResponse).some(
        (response) =>
          response.type === ElementType.Content &&
          typeof response.response === 'undefined'
      )
    ) {
      return true
    } else {
      return false
    }
  }, [studentResponse])

  // initialize student responses
  useEffect(() => {
    const newStudentResponse =
      stack.elements?.reduce((acc, element) => {
        if (
          element.elementData.type === ElementType.Kprim ||
          element.elementData.type === ElementType.Mc ||
          element.elementData.type === ElementType.Sc
        ) {
          return {
            ...acc,
            [element.id]: {
              type: element.elementData.type,
              response: (
                element.elementData as ChoicesElementData
              ).options.choices.reduce((acc, _, ix) => {
                return { ...acc, [ix]: undefined }
              }, {} as Record<number, boolean | undefined>),
              correct: undefined,
              valid: false,
            },
          }
        } else if (element.elementData.type === ElementType.Content) {
          return {
            ...acc,
            [element.id]: {
              type: element.elementData.type,
              response: undefined,
              correct: undefined,
              valid: true,
            },
          }
        }
        // default case - valid for FREE_TEXT, NUMERICAL, FLASHCARD elements
        else {
          return {
            ...acc,
            [element.id]: {
              type: element.elementData.type,
              response: undefined,
              correct: undefined,
              valid: false,
            },
          }
        }
      }, {} as StudentResponseType) || {}

    setStudentResponse(newStudentResponse)
  }, [currentStep])

  return (
    <div className="pb-12">
      <div className="w-full">
        <div className="flex flex-row items-center justify-between">
          {stack.displayName && <H2>{stack.displayName}</H2>}
          <Bookmark quizId={parentId} stackId={stack.id} />
        </div>

        {stack.description && (
          <div className="mb-4">
            <DynamicMarkdown content={stack.description} withProse />
          </div>
        )}

        <div className="flex flex-col gap-3">
          {stack.elements &&
            stack.elements.length > 0 &&
            stack.elements.map((element, elementIx) => {
              return (
                <div key={`${element.id}-student`}>
                  <InstanceHeader
                    instanceId={element.id}
                    name={element.elementData.name}
                    withParticipant={withParticipant}
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
              // TODO: re-introduce summary page for practice quiz
              router.push(`/`)
            }
            handleNextElement()
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
            const result = await respondToPracticeQuizStack({
              variables: {
                stackId: stack.id,
                courseId: courseId,
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
                      result.data?.respondToPracticeQuizStack?.evaluations?.find(
                        (evaluation) => evaluation.instanceId === parseInt(key)
                      ),
                  },
                }
              }, {} as StudentResponseType)
            )

            if (!result.data?.respondToPracticeQuizStack) {
              console.error('Error submitting response')
              return
            }

            // set status and score according to returned correctness
            const grading = result.data?.respondToPracticeQuizStack
            setStepStatus({
              status: grading.status,
              score: grading.score,
            })
            setStudentResponse({})

            // continue if stack only included content elements and/or flashcards, otherwise show evaluation
            if (
              Object.values(studentResponse).every(
                (response) =>
                  response.type === ElementType.Content ||
                  response.type === ElementType.Flashcard
              )
            ) {
              if (currentStep === totalSteps) {
                // TODO: re-introduce summary page for practice quiz
                router.push(`/`)
              }
              handleNextElement()
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
