import { useMutation } from '@apollo/client'
import {
  ChoicesElementData,
  ChoicesQuestionData,
  ElementStack as ElementStackType,
  ElementType,
  FlashcardCorrectnessType,
  RespondToPracticeQuizStackDocument,
  StackFeedbackStatus,
} from '@klicker-uzh/graphql/dist/ops'
import ChoicesQuestion from '@klicker-uzh/shared-components/src/ChoicesQuestion'
import FreeTextQuestion from '@klicker-uzh/shared-components/src/FreeTextQuestion'
import NumericalQuestion from '@klicker-uzh/shared-components/src/NumericalQuestion'
import { useLocalStorage } from '@uidotdev/usehooks'
import { Button, H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import DynamicMarkdown from 'src/components/learningElements/DynamicMarkdown'
import ContentElement from './ContentElement'
import Flashcard from './Flashcard'

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
}

type ElementChoicesType = ElementType.Sc | ElementType.Mc | ElementType.Kprim

type StudentResponseType = Record<
  number,
  | {
      type: ElementType.Flashcard
      response?: FlashcardCorrectnessType
      correct?: StackFeedbackStatus
    }
  | {
      type: ElementType.Content
      response?: boolean
      correct?: StackFeedbackStatus
    }
  | {
      type: ElementType.Sc | ElementType.Mc | ElementType.Kprim
      response?: Record<number, boolean | undefined>
      correct?: StackFeedbackStatus
    }
  | {
      type: ElementType.Numerical
      response?: number
      correct?: StackFeedbackStatus
    }
  | {
      type: ElementType.FreeText
      response?: string
      correct?: StackFeedbackStatus
    }
>

function ElementStack({
  parentId,
  courseId,
  stack,
  currentStep,
  totalSteps,
  setStepStatus,
  handleNextElement,
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
        if (element.elementData.type === ElementType.Kprim) {
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
            },
          }
        }
        // TODO: set initial value for numerical questions
        // TODO: set initial value for free text questions
        else {
          return {
            ...acc,
            [element.id]: {
              type: element.elementData.type,
              response: undefined,
              correct: undefined,
            },
          }
        }
      }, {} as StudentResponseType) || {}

    setStudentResponse(newStudentResponse)
  }, [currentStep])

  // TODO: remove logging
  console.log('student response:', studentResponse)

  return (
    <div className="pb-12">
      <div className="w-full">
        <div className="flex flex-row items-center justify-between">
          {stack.displayName && <H2>{stack.displayName}</H2>}
          {/* <div
                className={twMerge(
                  'flex flex-row gap-2',
                  !data?.getBookmarksLearningElement && 'hidden'
                )}
              >
                <div>Bookmark</div>
                <Button basic onClick={() => bookmarkQuestion()}>
                  {isBookmarked ? (
                    <FontAwesomeIcon
                      className="text-red-600 sm:hover:text-red-500"
                      icon={faBookmarkFilled}
                    />
                  ) : (
                    <FontAwesomeIcon
                      className="sm:hover:text-red-400"
                      icon={faBookmark}
                    />
                  )}
                </Button>
              </div> */}
        </div>

        {stack.description && (
          <div className="mb-4">
            <DynamicMarkdown content={stack.description} withProse />
          </div>
        )}

        {/* // TODO: extract this part to a new component "StudentElement" */}
        <div className="flex flex-col gap-3">
          {stack.elements &&
            stack.elements.length > 0 &&
            stack.elements.map((element, elementIx) => {
              if (element.elementData.type === ElementType.Flashcard) {
                return (
                  <Flashcard
                    key={element.id}
                    content={element.elementData.content}
                    explanation={element.elementData.explanation!}
                    response={
                      studentResponse[element.id]
                        ?.response as FlashcardCorrectnessType
                    }
                    setResponse={(studentResponse) => {
                      setStudentResponse((response) => {
                        return {
                          ...response,
                          [element.id]: {
                            ...response[element.id],
                            type: ElementType.Flashcard,
                            response: studentResponse,
                          },
                        }
                      })
                    }}
                    existingResponse={
                      stackStorage?.[element.id]
                        ?.response as FlashcardCorrectnessType
                    }
                    elementIx={elementIx}
                  />
                )
              } else if (
                element.elementData.type === ElementType.Sc ||
                element.elementData.type === ElementType.Mc ||
                element.elementData.type === ElementType.Kprim
              ) {
                return (
                  <ChoicesQuestion
                    key={element.id}
                    content={element.elementData.content}
                    type={element.elementData.type}
                    options={
                      (element.elementData as ChoicesQuestionData).options
                    }
                    response={
                      studentResponse[element.id]?.response as Record<
                        number,
                        boolean
                      >
                    }
                    setResponse={(newValue, valid) => {
                      // TODO: use validity type
                      setStudentResponse((response) => {
                        return {
                          ...response,
                          [element.id]: {
                            ...response[element.id],
                            type: element.elementData
                              .type as ElementChoicesType,
                            response: newValue,
                          },
                        }
                      })
                    }}
                    existingResponse={
                      stackStorage?.[element.id]?.response as Record<
                        number,
                        boolean
                      >
                    }
                    elementIx={elementIx}
                  />
                )
              } else if (element.elementData.type === ElementType.Numerical) {
                return <NumericalQuestion key={element.id} />
              } else if (element.elementData.type === ElementType.FreeText) {
                return <FreeTextQuestion key={element.id} />
              } else if (element.elementData.type === ElementType.Content) {
                return (
                  <ContentElement
                    key={element.id}
                    element={element}
                    read={
                      (stackStorage?.[element.id]?.response as boolean) ||
                      (studentResponse[element.id]?.response as boolean)
                    }
                    onRead={() => {
                      setStudentResponse((response) => {
                        return {
                          ...response,
                          [element.id]: {
                            ...response[element.id],
                            type: ElementType.Content,
                            response: true,
                          },
                        }
                      })
                    }}
                    elementIx={elementIx}
                  />
                )
              } else {
                return null
              }
            })}
        </div>
      </div>
      <Button
        className={{ root: 'float-right text-lg mt-4' }}
        disabled={
          // TODO: questions and flashcards with undefined answer should lead to disabling the continue button
          // TODO: content elements without answers should not disable button, but change functionality to "mark all as read"
          typeof stackStorage !== 'undefined'
            ? false
            : Object.values(studentResponse).some(
                (response) =>
                  typeof response.response === 'undefined' &&
                  response.type === ElementType.Flashcard
              )
        }
        onClick={async () => {
          // TODO: check if all instances have a response before starting submission (once questions are implemented)

          // if stack was already answered, just go to next element
          if (typeof stackStorage !== 'undefined') {
            setStudentResponse({})

            if (currentStep === totalSteps) {
              // TODO: re-introduce summary page for practice quiz
              router.push(`/`)
            }
            handleNextElement()
          } else if (showMarkAsRead) {
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
          }
          // only submit answer if not already answered before
          else if (typeof stackStorage === 'undefined') {
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
                    // TODO: submission logic for numerical questions
                    // TODO: submission logic for free text questions
                    else {
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

            setStackStorage(studentResponse)

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

            if (currentStep === totalSteps) {
              // TODO: re-introduce summary page for practice quiz
              router.push(`/`)
            }
            handleNextElement()
          }
        }}
        data={{ cy: 'practice-quiz-stack-submit' }}
      >
        {showMarkAsRead
          ? t('pwa.practiceQuiz.markAllAsRead')
          : currentStep === totalSteps
          ? t('shared.generic.finish')
          : t('shared.generic.continue')}
      </Button>
    </div>
  )
}

export default ElementStack
