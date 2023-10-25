import { PracticeQuiz } from '@klicker-uzh/graphql/dist/ops'
import { useLocalStorage } from '@uidotdev/usehooks'
import { twMerge } from 'tailwind-merge'
import StepProgressWithScoring from '../common/StepProgressWithScoring'
import ElementOverview from '../learningElements/ElementOverview'
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

  const [progressState, setProgressState] = useLocalStorage<
    Record<
      string,
      {
        status: InstanceStatus
        score?: number | null
      }
    >
  >(
    `pq-${quiz.id}`,
    quiz.stacks?.reduce(
      (acc, stack) => ({
        ...acc,
        [stack.id]: {
          status: 'unanswered',
          score: null,
        },
      }),
      {}
    )
  )

  return (
    <div
      className={twMerge(
        'flex-1 space-y-4 md:max-w-6xl md:mx-auto md:mb-4 md:p-8 md:pt-6 md:border md:rounded w-full'
      )}
    >
      <StepProgressWithScoring
        items={
          quiz.stacks?.map((stack) => {
            return progressState?.[stack.id]
          }) || []
        }
        currentIx={currentIx}
        setCurrentIx={setCurrentIx}
      />

      {currentIx === -1 && (
        <ElementOverview
          displayName={quiz.displayName}
          description={quiz.description ?? undefined}
          numOfQuestions={quiz.stacks?.length ?? undefined}
          // orderType={quiz.orderType}
          // resetTimeDays={quiz.resetTimeDays ?? undefined}
          // previouslyAnswered={quiz.previouslyAnswered ?? undefined}
          // stacksWithQuestions={quiz.stacksWithQuestions ?? undefined}
          // pointsMultiplier={quiz.pointsMultiplier}
          setCurrentIx={setCurrentIx}
        />
      )}

      {currentStack && (
        <ElementStack
          parentId={quiz.id}
          courseId={quiz.course.id}
          stack={currentStack}
          currentStep={currentIx + 1}
          totalSteps={quiz.stacks?.length ?? 0}
          setStepStatus={(value) => {
            setProgressState((prev) => {
              const next = { ...prev }
              next[currentStack.id] = value
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
