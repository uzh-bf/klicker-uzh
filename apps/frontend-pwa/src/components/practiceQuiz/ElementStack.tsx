import { useMutation } from '@apollo/client'
import {
  ElementStack as ElementStackType,
  ElementType,
  RespondToFlashcardInstanceDocument,
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
    status: InstanceStatus
    score?: number | null
  }) => void
  handleNextElement: () => void
}

export type InstanceStatus =
  | 'unanswered'
  | 'manuallyGraded'
  | 'correct'
  | 'incorrect'
  | 'partial'

export type FlashcardResponseValues = 'correct' | 'partial' | 'incorrect'

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
  useEffect(() => {
    setStudentGrading(undefined)
  }, [currentStep])

  const [respondToFlashcardInstance] = useMutation(
    RespondToFlashcardInstanceDocument
  )

  // TODO: extend state for other answer objects once return value from mutation is used correctly
  const [stackStorage, setStackStorage] = useLocalStorage<
    Record<string, { response: FlashcardResponseValues }>
  >(`qi-${parentId}-${stack.id}`, undefined)

  // TODO: enable handling multiple elements in a stack / extend state and submission logic accordingly
  const elementInstance = stack.elements?.[0]

  const [studentGrading, setStudentGrading] = useState<
    FlashcardResponseValues | undefined
  >(undefined)

  const flashcardGradingMap: Record<FlashcardResponseValues, number> = {
    incorrect: 0,
    partial: 1,
    correct: 2,
  }

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
                    response={studentGrading} // TODO - adapt code to work for multiple elements in a stack
                    setResponse={setStudentGrading} // TODO - adapt code to work for multiple elements in a stack
                    existingResponse={stackStorage?.[element.id]?.response}
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
                return <ContentElement key={element.id} element={element} /> // TODO - add tracking of student progress and send to backend
              } else {
                return null
              }
            })}
        </div>
      </div>
      <Button
        className={{ root: 'float-right text-lg mt-4' }}
        disabled={!studentGrading && !stackStorage}
        onClick={async () => {
          if (
            typeof stackStorage === 'undefined' &&
            typeof elementInstance !== 'undefined' &&
            elementInstance.elementType === ElementType.Flashcard &&
            typeof studentGrading !== 'undefined'
          ) {
            // TODO: loop over all instances in a stack to respond to them or implement backend endpoint, which allows answering multiple instances
            const value = flashcardGradingMap[studentGrading]
            const result = await respondToFlashcardInstance({
              variables: {
                id: elementInstance.id,
                courseId: courseId,
                correctness: value,
              },
            })

            // TODO: use mutation return value to update states
            setStackStorage({
              // TODO: use this once multiple instances in a stack are supported
              // ...stackStorage,
              [elementInstance.id]: {
                response: studentGrading,
              },
            })
            setStepStatus({
              status: studentGrading,
              score: null,
            })
            setStudentGrading(undefined)
          }

          // TODO: handle other types of questions / content elements in practice quiz

          if (currentStep === totalSteps) {
            // redirect to repetition page
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
