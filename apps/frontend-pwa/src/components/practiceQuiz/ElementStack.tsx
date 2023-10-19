import { useMutation } from '@apollo/client'
import DynamicMarkdown from '@components/learningElements/DynamicMarkdown'
import {
  ElementStack,
  ElementType,
  RespondToFlashcardInstanceDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2 } from '@uzh-bf/design-system'
import { useEffect, useState } from 'react'
import Flashcard from './Flashcard'

interface ElementStackProps {
  id: number
  courseId: string
  quizId: string
  stack: ElementStack
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

function ElementStack({
  id,
  courseId,
  quizId,
  stack,
  currentStep,
  totalSteps,
  setStepStatus,
  handleNextElement,
}: ElementStackProps) {
  useEffect(() => {
    setStudentGrading(undefined)
  }, [currentStep])

  const [respondToFlashcardInstance] = useMutation(
    RespondToFlashcardInstanceDocument
  )

  // TODO: enable handling multiple elements in a stack / extend state and submission logic accordingly
  const elementInstance = stack.elements?.[0]

  const [studentGrading, setStudentGrading] = useState<
    'no' | 'partial' | 'yes' | undefined
  >(undefined)

  const flashcardGradingMap: Record<string, number> = {
    no: 0,
    partial: 1,
    yes: 2,
  }

  return (
    <div>
      <div className="flex flex-col w-full h-full">
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
            <DynamicMarkdown content={stack.description} />
          </div>
        )}

        {elementInstance &&
          elementInstance.elementData.type === 'FLASHCARD' && (
            <Flashcard
              key={id}
              content={elementInstance.elementData.content}
              explanation={elementInstance.elementData.explanation!}
              response={studentGrading}
              setResponse={setStudentGrading}
            />
          )}
      </div>
      <Button
        className={{ root: 'float-right mt-4 text-lg' }}
        disabled={!studentGrading}
        onClick={async () => {
          // TODO: loop over all instances in a stack to respond to them or implement backend endpoint, which allows answering multiple instances
          if (
            typeof elementInstance !== 'undefined' &&
            elementInstance.elementType === ElementType.Flashcard &&
            typeof studentGrading !== 'undefined'
          ) {
            setStepStatus({
              status: 'manuallyGraded',
              score: null,
            })
            setStudentGrading(undefined)

            const value = flashcardGradingMap[studentGrading]
            const result = await respondToFlashcardInstance({
              variables: {
                id: elementInstance.id,
                courseId: courseId,
                correctness: value,
              },
            })
            // TODO: somehow react to return value of result
            console.log(result)
          }

          // TODO: handle other types of questions / content elements in practice quiz

          handleNextElement()
        }}
      >
        {currentStep === totalSteps ? 'Finish' : 'Next'}
      </Button>
    </div>
  )
}

export default ElementStack
