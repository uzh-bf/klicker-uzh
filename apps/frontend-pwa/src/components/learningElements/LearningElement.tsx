import { LearningElement } from '@klicker-uzh/graphql/dist/ops'
import * as R from 'ramda'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import StepProgressWithScoringOld from '../common/StepProgressWithScoringOld'
import ElementOverview from './ElementOverview'
import ElementSummary from './ElementSummary'
import QuestionStack, { ItemStatus } from './QuestionStack'

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
  const [items, setItems] = useState<
    {
      status: ItemStatus
      score?: number | null
    }[]
  >(R.repeat({ status: 'unanswered' }, element.stacks?.length ?? 0))

  return (
    <div
      className={twMerge(
        'flex-1 space-y-4 md:max-w-6xl md:mx-auto md:mb-4 md:p-8 md:pt-6 md:border md:rounded w-full'
      )}
    >
      <StepProgressWithScoringOld
        items={items}
        currentIx={currentIx}
        setCurrentIx={setCurrentIx}
      />

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
          setStepStatus={(value) =>
            setItems((prev) => {
              const next = [...prev]
              next[currentIx] = value
              return next
            })
          }
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
