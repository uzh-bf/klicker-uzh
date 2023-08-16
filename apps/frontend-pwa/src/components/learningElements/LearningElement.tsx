import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import {
  faBarsStaggered,
  faCheck,
  faCheckDouble,
  faInbox,
  faX,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { LearningElement } from '@klicker-uzh/graphql/dist/ops'
import { StepItem, StepProgress } from '@uzh-bf/design-system'
import * as R from 'ramda'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ElementOverview from './ElementOverview'
import ElementSummary from './ElementSummary'
import QuestionStack, { ItemStatus } from './QuestionStack'

const ICON_MAP: Record<string, IconDefinition> = {
  correct: faCheckDouble,
  incorrect: faX,
  partial: faCheck,
  unanswered: faInbox,
}
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
  const [itemStatus, setItemStatus] = useState<
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
      <StepProgress
        displayOffset={(element.stacks?.length ?? 0) > 15 ? 3 : undefined}
        value={currentIx}
        items={itemStatus}
        onItemClick={(ix: number) => setCurrentIx(ix)}
        data={{ cy: 'learning-element-progress' }}
        formatter={({ element, ix }) => {
          function render({
            className,
            element,
          }: {
            className: string
            element: StepItem
          }) {
            return {
              className,
              element: (
                <div className="flex w-full flex-row items-center justify-between px-2">
                  <div>{ix + 1}</div>
                  {typeof element.score !== 'undefined' &&
                  element.score !== null ? (
                    <div>{element.score}p</div>
                  ) : (
                    <div>
                      <FontAwesomeIcon icon={faBarsStaggered} />
                    </div>
                  )}
                  <FontAwesomeIcon icon={ICON_MAP[element.status]} />
                </div>
              ),
            }
          }

          if (element.status === 'correct') {
            return render({
              element,
              className: 'bg-green-600 bg-opacity-60 text-white',
            })
          }

          if (element.status === 'incorrect') {
            return render({
              element,
              className: 'bg-red-600 bg-opacity-60 text-white',
            })
          }

          if (element.status === 'partial') {
            return render({
              element,
              className: 'bg-uzh-red-100 bg-opacity-60 text-white',
            })
          }

          return render({
            element,
            className: '',
          })
        }}
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
            setItemStatus((prev) => {
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
