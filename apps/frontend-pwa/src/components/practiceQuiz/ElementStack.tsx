import DynamicMarkdown from '@components/learningElements/DynamicMarkdown'
import { ElementStack } from '@klicker-uzh/graphql/dist/ops'
import { Button, H2 } from '@uzh-bf/design-system'
import { useEffect, useState } from 'react'
import Flashcard from './Flashcard'

interface ElementStackProps {
  id: number
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
  quizId,
  stack,
  currentStep,
  totalSteps,
  setStepStatus,
  handleNextElement,
}: ElementStackProps) {
  useEffect(() => {
    setStudentFeedback(undefined)
  }, [currentStep])

  // TODO: enable handling multiple elements in a stack / extend state and submission logic accordingly
  const elementInstance = stack.elements?.[0]

  const [studentFeedback, setStudentFeedback] = useState<
    'no' | 'partial' | 'yes' | undefined
  >(undefined)
  console.log('student feedback: ', studentFeedback)

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
              response={studentFeedback}
              setResponse={setStudentFeedback}
            />
          )}
      </div>
      <Button
        className={{ root: 'float-right mt-4 text-lg' }}
        disabled={!studentFeedback}
        onClick={() => {
          // TODO: adapt these changes depending on the element type
          setStepStatus({
            status: 'manuallyGraded',
            score: null,
          })
          setStudentFeedback(undefined)

          // TODO: save student response here

          handleNextElement()
        }}
      >
        {currentStep === totalSteps ? 'Finish' : 'Next'}
      </Button>
    </div>
  )
}

export default ElementStack
