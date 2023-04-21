import { LearningElement } from '@klicker-uzh/graphql/dist/ops'
import { StepProgress } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'
import ElementOverview from './ElementOverview'
import ElementSummary from './ElementSummary'
import QuestionStack from './QuestionStack'

interface LearningElementProps {
  element: LearningElement
  currentIx: number
  setCurrentIx: (ix: number) => void
  handleNextQuestion: () => void
}

function LearningElement({
  element,
  currentIx,
  setCurrentIx,
  handleNextQuestion,
}: LearningElementProps) {
  const currentStack = element.stacks?.[currentIx]

  return (
    <div
      className={twMerge(
        'flex-1 space-y-4 md:max-w-6xl md:mx-auto md:mb-4 md:p-8 md:pt-6 md:border md:rounded',
        (currentIx === -1 || currentStack) && 'md:w-full'
      )}
    >
      {(currentIx === -1 || currentStack) && (
        <div>
          <StepProgress
            displayOffset={(element.stacks?.length ?? 0) > 15 ? 3 : undefined}
            value={currentIx}
            max={element.stacks?.length ?? 0}
            onItemClick={(ix: number) => setCurrentIx(ix)}
          />
        </div>
      )}

      {currentIx === -1 && (
        <ElementOverview
          displayName={element.displayName}
          description={element.description ?? undefined}
          numOfQuestions={element.numOfQuestions ?? undefined}
          orderType={element.orderType}
          resetTimeDays={element.resetTimeDays ?? undefined}
          previouslyAnswered={element.previouslyAnswered ?? undefined}
          stacksWithQuestions={element.stacksWithQuestions ?? undefined}
          pointsMultiplier={element.pointsMultiplier}
          setCurrentIx={setCurrentIx}
        />
      )}

      {currentStack && (
        <QuestionStack
          key={currentStack.id}
          elementId={element.id}
          stack={currentStack}
          currentStep={currentIx + 1}
          totalSteps={element.stacksWithQuestions ?? 0}
          handleNextQuestion={handleNextQuestion}
        />
      )}

      {currentIx >= 0 && !currentStack && (
        <ElementSummary
          displayName={element.displayName}
          stacks={element.stacks || []}
        />
      )}
    </div>
  )
}

export default LearningElement
