import DynamicMarkdown from '@components/learningElements/DynamicMarkdown'
import { ElementStack } from '@klicker-uzh/graphql/dist/ops'
import { Button, H2 } from '@uzh-bf/design-system'
import { useState } from 'react'
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

export type InstanceStatus = 'unanswered' | 'answered'

function ElementStack({
  id,
  quizId,
  stack,
  currentStep,
  totalSteps,
  setStepStatus,
  handleNextElement,
}: ElementStackProps) {
  const elementInstance = stack.elements?.[0]

  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('')
  console.log('selectedDifficulty: ', selectedDifficulty)

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
              explanation={elementInstance.elementData.explanation}
              difficulty={selectedDifficulty}
              setDifficulty={setSelectedDifficulty}
            />
          )}
      </div>
      <Button
        className={{ root: 'float-right mt-4 text-lg' }}
        disabled={selectedDifficulty === ''}
        onClick={() => {
          setStepStatus({
            status: 'answered',
            score: null,
          })
          setSelectedDifficulty('')
          handleNextElement()
        }}
      >
        {currentStep === totalSteps ? 'Finish' : 'Next'}
      </Button>
    </div>
  )
}

export default ElementStack
