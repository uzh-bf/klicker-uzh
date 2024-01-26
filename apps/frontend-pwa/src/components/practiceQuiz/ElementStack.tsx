import { useMutation } from '@apollo/client'
import {
  ElementStack as ElementStackType,
  ElementType,
  FlashcardCorrectnessType,
  RespondToPracticeQuizStackDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useLocalStorage } from '@uidotdev/usehooks'
import { Button, H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
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
    status: StackStatus
    score?: number | null
  }) => void
  handleNextElement: () => void
}

export type StackStatus =
  | 'unanswered'
  | 'manuallyGraded'
  | 'correct'
  | 'incorrect'
  | 'partial'

type StudentResponseType = Record<
  number,
  {
    type: ElementType
    response?: FlashcardCorrectnessType | boolean // TODO: augment this type for questions
    correct?: StackStatus
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

  // initialize student responses
  useEffect(() => {
    const newStudentResponse =
      stack.elements?.reduce((acc, element) => {
        return {
          ...acc,
          [element.id]: {
            type: element.elementData.type,
            response: undefined,
            correct: undefined,
          },
        }
      }, {} as StudentResponseType) || {}

    setStudentResponse(newStudentResponse)
  }, [currentStep])

  console.log(studentResponse)

  // TODO - replace
  // const [respondToFlashcardInstance] = useMutation(
  //   RespondToFlashcardInstanceDocument
  // )

  // TODO: enable handling multiple elements in a stack / extend state and submission logic accordingly
  // const elementInstance = stack.elements?.[0]

  // const [studentGrading, setStudentGrading] = useState<
  //   FlashcardResponseValues | undefined
  // >(undefined)

  return (
    <div className="pb-12">
      <div className="w-full">
        <div className="flex flex-row items-center justify-between">
          <div>{stack.displayName && <H2>{stack.displayName}</H2>}</div>
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

        <div className="flex flex-col gap-3">
          {stack.elements &&
            stack.elements.length > 0 &&
            stack.elements.map((element) => {
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
                            response: studentResponse,
                          },
                        }
                      })
                    }}
                    existingResponse={
                      stackStorage?.[element.id]
                        ?.response as FlashcardCorrectnessType
                    }
                  />
                )
              } else if (
                element.elementData.type === ElementType.Sc ||
                element.elementData.type === ElementType.Mc ||
                element.elementData.type === ElementType.Kprim ||
                element.elementData.type === ElementType.Numerical ||
                element.elementData.type === ElementType.FreeText
              ) {
                return <div key={element.id}>TODO Question</div> // TODO - include student question here
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
                            response: true,
                          },
                        }
                      })
                    }}
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
        // TODO - disable continue if not all responses are different from undefined
        disabled={false}
        onClick={async () => {
          // TODO: check if all instances have a response before starting submission (once questions are implemented)

          const result = await respondToPracticeQuizStack({
            variables: {
              stackId: stack.id,
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
                  }
                  // TODO - handle question data here
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
          // TODO: set status and score according to returned correctness
          // setStepStatus({
          //   status: 'manuallyGraded',
          //   score: null,
          // })
          setStudentResponse({})

          if (currentStep === totalSteps) {
            // TODO: re-introduce summary page for practice quiz
            router.push(`/`)
          }
          handleNextElement()
        }}
        data={{ cy: 'practice-quiz-stack-submit' }}
      >
        {currentStep === totalSteps
          ? t('shared.generic.finish')
          : t('shared.generic.continue')}
      </Button>
    </div>
  )
}

export default ElementStack
