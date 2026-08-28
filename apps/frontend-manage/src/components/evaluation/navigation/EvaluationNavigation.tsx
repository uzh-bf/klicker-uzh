import type { StackEvaluation } from '@klicker-uzh/graphql/dist/ops'
import type {
  ActiveStackType,
  ActivityEvaluationType,
} from '../ActivityEvaluation'
import useInstanceArrowNavigation from '../hooks/useInstanceArrowNavigation'
import useStackInstanceUpdates from '../hooks/useStackInstanceUpdates'
import InstanceNavigation from './InstanceNavigation'
import StackNavigation from './StackNavigation'

interface EvaluationNavigationProps {
  stacks: StackEvaluation[]
  stackInstanceMap: Record<number, { label: string; value: number }[]>
  activeStack: ActiveStackType
  setActiveStack: (stack: ActiveStackType) => void
  activeInstance: number
  setActiveInstance: (instance: number) => void
  numOfInstances: number
  type: ActivityEvaluationType
  leaderboardAvailable?: boolean
  feedbacksAvailable?: boolean
}

function EvaluationNavigation({
  stacks,
  stackInstanceMap,
  activeStack,
  setActiveStack,
  activeInstance,
  setActiveInstance,
  numOfInstances,
  type,
  leaderboardAvailable,
  feedbacksAvailable,
}: EvaluationNavigationProps) {
  // automatically switch the active stack based on the active instance
  useStackInstanceUpdates({
    activeInstance,
    stackInstanceMap,
    setActiveStack,
  })

  // enable navigation using keyboard arrows
  useInstanceArrowNavigation({
    activeInstance,
    setActiveInstance,
    numOfInstances,
  })

  return (
    <div className="flex w-full flex-row justify-between border-b-2 border-solid bg-white px-3 print:hidden">
      {typeof activeStack === 'number' ? (
        <InstanceNavigation
          stack={stacks[activeStack]}
          activeInstance={activeInstance ?? 0}
          setActiveInstance={setActiveInstance}
          numOfInstances={numOfInstances}
          instanceSelection={stackInstanceMap[activeStack]}
        />
      ) : (
        <div />
      )}
      <div className="flex flex-row items-center gap-4">
        <StackNavigation
          stacks={stacks}
          activeStack={activeStack}
          setActiveStack={setActiveStack}
          stackInstanceMap={stackInstanceMap}
          setActiveInstance={setActiveInstance}
          type={type}
          leaderboardAvailable={leaderboardAvailable}
          feedbacksAvailable={feedbacksAvailable}
        />
      </div>
    </div>
  )
}

export default EvaluationNavigation
