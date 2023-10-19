import ElementOverview from '@components/learningElements/ElementOverview'
import { PracticeQuiz } from '@klicker-uzh/graphql/dist/ops'
import * as R from 'ramda'
import { useState } from 'react'
import StepProgressWithScoring from 'src/components/common/StepProgressWithScoring'
import { twMerge } from 'tailwind-merge'
import ElementStack, { InstanceStatus } from './ElementStack'

interface PracticeQuizProps {
  quiz: PracticeQuiz
  currentIx: number
  setCurrentIx: (ix: number) => void
  handleNextElement: () => void
}

function PracticeQuiz({
  quiz: quiz,
  currentIx,
  setCurrentIx,
  handleNextElement,
}: PracticeQuizProps) {
  const currentStack = quiz.stacks?.[currentIx]
  const [items, setItems] = useState<
    {
      status: InstanceStatus
      score?: number | null
    }[]
  >(R.repeat({ status: 'unanswered' }, quiz.stacks?.length ?? 0))

  return (
    <div
      className={twMerge(
        'flex-1 space-y-4 md:max-w-6xl md:mx-auto md:mb-4 md:p-8 md:pt-6 md:border md:rounded w-full'
      )}
    >
      <StepProgressWithScoring
        items={items}
        currentIx={currentIx}
        setCurrentIx={setCurrentIx}
      />

      {currentIx === -1 && (
        <ElementOverview
          displayName={quiz.displayName}
          description={quiz.description ?? undefined}
          numOfQuestions={quiz.stacks?.length ?? undefined}
          orderType={quiz.orderType}
          resetTimeDays={quiz.resetTimeDays ?? undefined}
          // previouslyAnswered={quiz.previouslyAnswered ?? undefined}
          // stacksWithQuestions={quiz.stacksWithQuestions ?? undefined}
          pointsMultiplier={quiz.pointsMultiplier}
          setCurrentIx={setCurrentIx}
        />
      )}

      {currentStack && (
        <ElementStack
          id={currentStack.id}
          courseId={quiz.course!.id}
          quizId={quiz.id}
          stack={currentStack}
          currentStep={currentIx + 1}
          totalSteps={quiz.stacks?.length ?? 0}
          setStepStatus={(value) => {
            setItems((prev) => {
              const next = [...prev]
              next[currentIx] = value
              return next
            })
          }}
          handleNextElement={handleNextElement}
        />
      )}

      {/* {currentIx >= 0 && !currentStack && (
        <ElementSummary
          displayName={quiz.displayName}
          stacks={quiz.stacks || []}
        />
      )} */}
    </div>
  )
}

export default PracticeQuiz
